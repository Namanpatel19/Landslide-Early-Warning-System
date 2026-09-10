/**
 * Map Component — Interactive Leaflet Map of Northeast India
 * ===========================================================
 * - Centered on NER (26°N, 92°E), zoom 7
 * - Click anywhere → triggers /predict API call
 * - Color-coded circle markers for predictions
 * - Lazy-loads map tiles from OpenStreetMap (free)
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import { formatConfidence, formatDateTime } from '../utils/helpers';

// NER bounds for map view
const NER_CENTER = [26.2, 92.5];
const NER_ZOOM = 7;

// Risk color mapping for markers
const RISK_COLORS = {
  Low: '#16a34a',
  Medium: '#d97706',
  High: '#ea580c',
  Critical: '#dc2626',
};

/**
 * MapClickHandler — invisible component that captures map click events.
 * Passes lat/lon to parent onLocationClick handler.
 */
function MapClickHandler({ onLocationClick, isLoading }) {
  useMapEvents({
    click(e) {
      if (isLoading) return; // Prevent double-clicks during loading
      const { lat, lng } = e.latlng;
      // Validate NER bounds
      if (lat >= 20 && lat <= 30 && lng >= 88 && lng <= 98) {
        onLocationClick(lat, lng);
      } else {
        console.warn('Clicked outside NER bounds. Please click within Northeast India.');
      }
    },
  });
  return null;
}

export default function Map({ predictions, onLocationClick, isLoading }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 999,
          background: 'rgba(255,255,255,0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-lg)',
          gap: '0.5rem',
        }}>
          <div className="spinner" />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Analyzing location…
          </span>
        </div>
      )}

      {/* Instruction hint */}
      {predictions.length === 0 && !isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 500,
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1.25rem',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '1.25rem', marginBottom: 4 }}>👆</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
            Click anywhere on the map
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            to analyze landslide risk
          </div>
        </div>
      )}

      <MapContainer
        center={NER_CENTER}
        zoom={NER_ZOOM}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        minZoom={5}
        maxZoom={16}
        // Lazy load: tiles are requested only when visible
      >
        {/* OpenStreetMap tiles — free, no key required */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          // Load tiles only when near viewport (built into Leaflet)
        />

        <MapClickHandler onLocationClick={onLocationClick} isLoading={isLoading} />

        {/* Render all prediction markers */}
        {predictions.map((pred, idx) => {
          const color = RISK_COLORS[pred.risk_level] || '#94a3b8';
          const isCritical = pred.risk_level === 'Critical';
          const isHigh = pred.risk_level === 'High';
          return (
            <CircleMarker
              key={idx}
              center={[pred.lat, pred.lon]}
              radius={isCritical ? 14 : isHigh ? 11 : 9}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.85,
                color: '#ffffff',
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 200 }}>
                  {/* Risk level header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: color,
                    }} />
                    <strong style={{ color, fontSize: '0.9375rem' }}>
                      {pred.risk_level} Risk
                    </strong>
                  </div>

                  {/* Location */}
                  <div style={{ fontSize: '0.8125rem', color: '#374151', marginBottom: '0.375rem' }}>
                    📍 {pred.location_name?.split('(')[0]?.trim()}
                  </div>

                  {/* Confidence */}
                  <div style={{ fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#6b7280' }}>Confidence: </span>
                    <strong style={{ color }}>{formatConfidence(pred.confidence)}</strong>
                  </div>

                  {/* Key metrics */}
                  {pred.features && (
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        🌧️ {pred.features.rainfall_intensity_mm?.toFixed(1)} mm/day rain
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        ⛰️ {pred.features.slope_angle?.toFixed(1)}° slope
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        💧 {(pred.features.soil_moisture * 100)?.toFixed(0)}% soil moisture
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.375rem' }}>
                    {formatDateTime(pred.timestamp)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Map legend */}
      <div style={{
        position: 'absolute',
        bottom: 28,
        right: 12,
        zIndex: 500,
        background: 'rgba(255,255,255,0.96)',
        borderRadius: 'var(--radius-md)',
        padding: '0.625rem 0.875rem',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        fontSize: '0.75rem',
      }}>
        <div style={{ fontWeight: 700, marginBottom: '0.375rem', color: 'var(--color-text-secondary)' }}>
          RISK LEVEL
        </div>
        {Object.entries(RISK_COLORS).map(([level, color]) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: 2 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            <span style={{ color: 'var(--color-text)' }}>{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
