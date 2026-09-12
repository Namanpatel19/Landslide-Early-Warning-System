/**
 * RiskCard — Displays prediction result for a clicked location.
 * Shows: risk level, confidence, feature breakdown, top factors.
 */

import React from 'react';
import {
  Thermometer, Droplets, Wind, Mountain, Activity,
  MapPin, Clock, AlertTriangle, CheckCircle2, Info, Cpu
} from 'lucide-react';
import { useRiskColor, formatConfidence, formatDateTime, featureDisplayName } from '../utils/helpers';

function MetricRow({ icon, label, value, unit = '' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.5rem 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'var(--color-text-secondary)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
        {value}{unit}
      </span>
    </div>
  );
}

export default function RiskCard({ prediction }) {
  if (!prediction) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🗺️</div>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No Location Selected</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Click on the map to analyze landslide risk
        </div>
      </div>
    );
  }

  const { color, bg, border } = useRiskColor(prediction.risk_level);
  const conf = prediction.confidence;
  const riskIcon = {
    Low: <CheckCircle2 size={18} color={color} />,
    Medium: <Info size={18} color={color} />,
    High: <AlertTriangle size={18} color={color} />,
    Critical: <AlertTriangle size={18} color={color} />,
  }[prediction.risk_level];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      {/* ─── Risk Level Header ─── */}
      <div className="card" style={{
        background: bg,
        borderColor: border,
        padding: '1.125rem 1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {riskIcon}
            <span style={{ fontWeight: 700, fontSize: '1rem', color }}>
              {prediction.risk_level} Risk
            </span>
          </div>
          <span className={`risk-badge ${prediction.risk_level}`}>
            {prediction.risk_level}
          </span>
        </div>

        {/* Location */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', marginBottom: '0.75rem' }}>
          <MapPin size={13} color="var(--color-text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {prediction.location_name}
          </span>
        </div>

        {/* Confidence bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Model Confidence
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color }}>
              {formatConfidence(conf)}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${conf * 100}%`, background: color }}
            />
          </div>
        </div>
      </div>

      {/* ─── Live Weather Conditions ─── */}
      {prediction.features && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em',
            color: 'var(--color-text-secondary)', textTransform: 'uppercase',
            marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem',
          }}>
            <Activity size={13} />
            Live Conditions
          </div>
          <MetricRow
            icon={<Droplets size={14} />}
            label="Rainfall"
            value={prediction.features.rainfall_intensity_mm?.toFixed(1)}
            unit=" mm/day"
          />
          <MetricRow
            icon={<Wind size={14} />}
            label="Humidity"
            value={prediction.features.humidity?.toFixed(0)}
            unit="%"
          />
          <MetricRow
            icon={<Thermometer size={14} />}
            label="Temperature"
            value={prediction.features.temperature?.toFixed(1)}
            unit="°C"
          />
          <MetricRow
            icon={<Droplets size={14} />}
            label="Soil Moisture"
            value={(prediction.features.soil_moisture * 100)?.toFixed(0)}
            unit="%"
          />
          <MetricRow
            icon={<Activity size={14} />}
            label="Seismic Activity"
            value={prediction.features.seismic_activity?.toFixed(2)}
            unit=" mag"
          />
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={14} color="var(--color-text-secondary)" />
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  Vibration (IoT sim.)
                </span>
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                {prediction.features.vibration_level?.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Static Geology ─── */}
      {prediction.features && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em',
            color: 'var(--color-text-secondary)', textTransform: 'uppercase',
            marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem',
          }}>
            <Mountain size={13} />
            Geological Profile
          </div>
          <MetricRow
            icon={<Mountain size={14} />}
            label="Slope"
            value={prediction.features.slope_angle?.toFixed(1)}
            unit="°"
          />
          <MetricRow
            icon={<Mountain size={14} />}
            label="Elevation"
            value={prediction.features.elevation?.toFixed(0)}
            unit=" m"
          />
          <MetricRow
            icon={<span>🌿</span>}
            label="NDVI (vegetation)"
            value={(prediction.features.vegetation_index * 100)?.toFixed(0)}
            unit="%"
          />
          <MetricRow
            icon={<span>🪨</span>}
            label="Soil Type"
            value={prediction.features.soil_type?.replace(/_/g, ' ')}
          />
        </div>
      )}

      {/* Explainability Section */}
      {prediction.gemini_explanation && (
        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-sm font-semibold text-blue-700 mb-1 flex items-center gap-2">
            ✨ Gemini AI Assessment
          </h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            {prediction.gemini_explanation}
          </p>
        </div>
      )}

      {/* ─── Timestamp ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        padding: '0 0.25rem',
      }}>
        <Clock size={12} color="var(--color-text-muted)" />
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {formatDateTime(prediction.timestamp)}
          {prediction.cached && ' · cached'}
        </span>
      </div>
    </div>
  );
}
