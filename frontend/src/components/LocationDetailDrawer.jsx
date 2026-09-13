/**
 * LocationDetailDrawer — Slide-in panel when a location is clicked
 * Shows: mini Leaflet map, full RiskCard, Gemini explanation, Rainfall chart
 */
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { X, MapPin, Brain, TrendingUp, Droplets, Activity, Thermometer, Wind, AlertTriangle, Users } from 'lucide-react';
import RainfallChart from './RainfallChart';
import { getRiskDetails } from '../utils/helpers';

function MetricRow({ icon, label, value }) {
  return (
    <div className="drawer-metric-row">
      <span className="drawer-metric-icon">{icon}</span>
      <span className="drawer-metric-label">{label}</span>
      <span className="drawer-metric-value">{value}</span>
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

  const riskScore = prediction?.risk_score ?? 0;
  const cfg = getRiskDetails(riskScore);
  const color = cfg.color;
  const f = prediction?.features;

  return (
    <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer-panel">
        {/* Header */}
        <div className="drawer-header" style={{ borderLeft: `4px solid ${color}` }}>
          <div>
            <div className="drawer-risk-badge" style={{ background: cfg.bg, color: color, border: `1px solid ${cfg.border}` }}>
              Risk Level: {cfg.level} ({(riskScore * 100).toFixed(1)}% score) · Model Confidence: {prediction ? (prediction.confidence * 100).toFixed(1) : '--'}%
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
                    {cfg.level} Risk — {(riskScore * 100).toFixed(1)}% score
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
                <div className="drawer-metrics-grid">
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
                  {f.population_density !== undefined && (
                    <MetricRow
                      icon={<Users size={14} color="#8b5cf6" />}
                      label="Pop. Density"
                      value={`${f.population_density} /km²`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Risk Score & Confidence Bars */}
            <div className="drawer-section">
              <div className="drawer-section-title">
                <AlertTriangle size={14} /> Risk Assessment
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  <span>Final Risk Score (Hybrid)</span>
                  <span style={{ color }}>{(riskScore * 100).toFixed(1)}%</span>
                </div>
                <div className="conf-bar-track">
                  <div
                    className="conf-bar-fill"
                    style={{ width: `${(riskScore * 100).toFixed(1)}%`, background: color }}
                  />
                </div>
              </div>

              {prediction.physics_fs !== undefined && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    <span>Geotechnical Factor of Safety (FS)</span>
                    <span style={{ color: prediction.physics_fs < 1.0 ? '#dc2626' : (prediction.physics_fs > 1.5 ? '#16a34a' : '#ea580c') }}>
                      {prediction.physics_fs.toFixed(2)} ({(prediction.physics_fs < 1.0 ? "Unstable" : (prediction.physics_fs > 1.5 ? "Stable" : "Marginal"))})
                    </span>
                  </div>
                  <div className="conf-bar-track" style={{ background: '#e5e7eb' }}>
                    <div
                      className="conf-bar-fill"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, (2.0 - prediction.physics_fs) * 100))}%`, 
                        background: prediction.physics_fs < 1.0 ? '#dc2626' : (prediction.physics_fs > 1.5 ? '#16a34a' : '#ea580c')
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  <span>Model Confidence (ML Certainty)</span>
                  <span style={{ color: '#475569' }}>{(prediction.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="conf-bar-track">
                  <div
                    className="conf-bar-fill"
                    style={{ width: `${(prediction.confidence * 100).toFixed(1)}%`, background: '#94a3b8' }}
                  />
                </div>
              </div>
            </div>

            {/* SHAP Explainability (Top Factors) */}
            {prediction.top_factors && prediction.top_factors.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <Brain size={14} /> SHAP Local Explainability
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>
                  Specific factors driving this location's risk (via SHAP values):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {prediction.top_factors.map((f, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                          {f.name.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#dc2626' }}>
                          {(Math.abs(f.importance) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, Math.abs(f.importance) * 100)}%`,
                            background: i === 0 ? '#dc2626' : i === 1 ? '#ea580c' : '#d97706',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Official Warnings Comparison (IMD Mock) */}
            <div className="drawer-section">
              <div className="drawer-section-title">
                <AlertTriangle size={14} color="#eab308" /> Official Warnings Comparison
              </div>
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>IMD Meteorological Bulletin</span>
                  <span style={{ color: f?.rainfall_intensity_mm > 50 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    {f?.rainfall_intensity_mm > 50 ? 'Active Alert' : 'Normal'}
                  </span>
                </div>
                <p style={{ color: '#64748b', margin: 0 }}>
                  {f?.rainfall_intensity_mm > 100 
                    ? "Red Alert: Extremely heavy rainfall expected in isolated places. Risk of localized flooding and landslides." 
                    : f?.rainfall_intensity_mm > 50 
                    ? "Orange Alert: Heavy to very heavy rainfall expected. Be prepared." 
                    : "No significant weather warnings for this region at this time."}
                </p>
                <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                  * Source: India Meteorological Department (IMD) - Mock Data
                </div>
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
