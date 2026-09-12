/**
 * LocationDetailDrawer — Slide-in panel when a location is clicked
 * Shows: mini Leaflet map, full RiskCard, Gemini explanation, Rainfall chart
 */
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { X, MapPin, Brain, TrendingUp, Droplets, Activity, Thermometer, Wind } from 'lucide-react';
import RainfallChart from './RainfallChart';

const RISK_COLORS = {
  Low: '#16a34a',
  Medium: '#d97706',
  High: '#ea580c',
  Critical: '#dc2626',
};

function MetricRow({ icon, label, value }) {
  return (
    <div className="metric-row">
      <span className="metric-icon">{icon}</span>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

export default function LocationDetailDrawer({ prediction, onClose, isLoading }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const color = RISK_COLORS[prediction?.risk_level] || '#94a3b8';
  const f = prediction?.features;

  return (
    <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer-panel">
        {/* Header */}
        <div className="drawer-header" style={{ borderLeft: `4px solid ${color}` }}>
          <div>
            <div className="drawer-risk-badge" style={{ background: color + '22', color }}>
              {prediction?.risk_level} Risk — {prediction ? (prediction.confidence * 100).toFixed(1) : '--'}% confidence
            </div>
            <h2 className="drawer-title">{prediction?.location_name || 'Loading…'}</h2>
            {prediction && (
              <p className="drawer-coords">
                <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                {prediction.lat?.toFixed(4)}°N, {prediction.lon?.toFixed(4)}°E
              </p>
            )}
          </div>
          <button className="drawer-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isLoading && (
          <div className="drawer-loading">
            <div className="spinner" />
            <span>Fetching live data & running AI prediction…</span>
          </div>
        )}

        {prediction && !isLoading && (
          <div className="drawer-body">
            {/* Mini Map */}
            <div className="drawer-map-wrapper">
              <MapContainer
                center={[prediction.lat, prediction.lon]}
                zoom={10}
                style={{ width: '100%', height: '220px', borderRadius: '10px', zIndex: 1 }}
                zoomControl={true}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <CircleMarker
                  center={[prediction.lat, prediction.lon]}
                  radius={14}
                  pathOptions={{ fillColor: color, fillOpacity: 0.85, color: '#fff', weight: 3 }}
                >
                  <Popup>
                    <strong>{prediction.location_name}</strong><br />
                    {prediction.risk_level} Risk — {(prediction.confidence * 100).toFixed(1)}%
                  </Popup>
                </CircleMarker>
              </MapContainer>
            </div>

            {/* Gemini AI Explanation */}
            {prediction.gemini_explanation && (
              <div className="drawer-gemini">
                <div className="drawer-section-title">
                  <Brain size={14} /> AI Risk Explanation
                </div>
                <p className="drawer-gemini-text">{prediction.gemini_explanation}</p>
              </div>
            )}

            {/* Live Conditions Grid */}
            {f && (
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <Activity size={14} /> Live Conditions
                </div>
                <div className="metrics-grid">
                  <MetricRow
                    icon={<Droplets size={14} color="#3b82f6" />}
                    label="Rainfall"
                    value={`${f.rainfall_intensity_mm?.toFixed(1)} mm/day`}
                  />
                  <MetricRow
                    icon={<Thermometer size={14} color="#f97316" />}
                    label="Temperature"
                    value={`${f.temperature?.toFixed(1)}°C`}
                  />
                  <MetricRow
                    icon={<Wind size={14} color="#6366f1" />}
                    label="Humidity"
                    value={`${f.humidity?.toFixed(0)}%`}
                  />
                  <MetricRow
                    icon={<Droplets size={14} color="#0ea5e9" />}
                    label="Soil Moisture"
                    value={`${(f.soil_moisture * 100)?.toFixed(0)}%`}
                  />
                  <MetricRow
                    icon={<Activity size={14} color="#dc2626" />}
                    label="Seismic Activity"
                    value={`${f.seismic_activity?.toFixed(2)} mag`}
                  />
                  <MetricRow
                    icon={<TrendingUp size={14} color="#78716c" />}
                    label="Slope Angle"
                    value={`${f.slope_angle?.toFixed(1)}°`}
                  />
                </div>
              </div>
            )}

            {/* Confidence Bar */}
            <div className="drawer-section">
              <div className="drawer-section-title">
                <TrendingUp size={14} /> Model Confidence
              </div>
              <div className="conf-bar-track">
                <div
                  className="conf-bar-fill"
                  style={{ width: `${(prediction.confidence * 100).toFixed(1)}%`, background: color }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#6b7280', marginTop: 4 }}>
                <span>0%</span>
                <span style={{ fontWeight: 700, color }}>{(prediction.confidence * 100).toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Rainfall Trend Chart */}
            <div className="drawer-section">
              <RainfallChart lat={prediction.lat} lon={prediction.lon} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
