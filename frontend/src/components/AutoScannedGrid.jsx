/**
 * AutoScannedGrid — Main city risk dashboard grid
 * Displays all 20 monitored NER locations sorted by risk score (Critical first)
 * Auto-refreshes every 2 minutes matching the backend sweeper interval
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getAutoScanned, forceSweep } from '../services/api';
import GlobalAlertModal from './GlobalAlertModal';
import { RefreshCw, AlertTriangle, ShieldCheck, Shield, Clock, MapPin } from 'lucide-react';

const RISK_CONFIG = {
  Critical: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'CRITICAL', order: 0 },
  High:     { color: '#ea580c', bg: '#fff7ed', border: '#fdba74', label: 'HIGH',     order: 1 },
  Medium:   { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: 'MEDIUM',   order: 2 },
  Low:      { color: '#16a34a', bg: '#f0fdf4', border: '#86efac', label: 'LOW',      order: 3 },
};

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function RiskBadge({ level }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.Low;
  return (
    <span className="risk-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

function ConfBar({ value, color }) {
  return (
    <div className="conf-bar-track" style={{ marginTop: 4 }}>
      <div className="conf-bar-fill" style={{ width: `${(value * 100).toFixed(0)}%`, background: color }} />
    </div>
  );
}

export default function AutoScannedGrid({ onLocationClick }) {
  const [locations, setLocations]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [filter, setFilter]         = useState('All');

  const fetchLocations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await getAutoScanned();
      // Sort by risk order then confidence
      const sorted = [...data].sort((a, b) => {
        const orderA = RISK_CONFIG[a.risk_level]?.order ?? 4;
        const orderB = RISK_CONFIG[b.risk_level]?.order ?? 4;
        if (orderA !== orderB) return orderA - orderB;
        return b.confidence - a.confidence;
      });
      setLocations(sorted);
      setLastSynced(new Date());
    } catch (e) {
      console.error('Failed to load scanned locations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on mount and every 2 minutes (matches sweeper interval)
  useEffect(() => {
    fetchLocations();
    const id = setInterval(() => fetchLocations(true), 120000);
    return () => clearInterval(id);
  }, [fetchLocations]);

  const handleForceSweep = async () => {
    setRefreshing(true);
    try {
      await forceSweep();
      // Wait a few seconds for sweep to produce results
      setTimeout(() => fetchLocations(true), 8000);
    } catch (e) {
      console.error(e);
      setRefreshing(false);
    }
  };

  const FILTERS = ['All', 'Critical', 'High', 'Medium', 'Low'];
  const filtered = filter === 'All'
    ? locations
    : locations.filter(l => l.risk_level === filter);

  const critCount  = locations.filter(l => l.risk_level === 'Critical').length;
  const highCount  = locations.filter(l => l.risk_level === 'High').length;

  return (
    <div className="autoscan-container">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="autoscan-header">
        <div>
          <h2 className="autoscan-title">
            <Shield size={18} style={{ color: '#d97706' }} />
            Live NER Risk Monitor
          </h2>
          <p className="autoscan-subtitle">
            {locations.length} locations · Auto-syncs every 2 min
            {lastSynced && (
              <span style={{ marginLeft: 8 }}>
                · <Clock size={11} style={{ display: 'inline', marginBottom: -2 }} />
                {' '}Last sync: {timeAgo(lastSynced)}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Summary pills */}
          {critCount > 0 && (
            <span className="summary-pill" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={12} /> {critCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="summary-pill" style={{ background: '#fff7ed', color: '#ea580c' }}>
              {highCount} High
            </span>
          )}
          <button
            onClick={handleForceSweep}
            disabled={refreshing}
            className="refresh-btn"
            title="Refresh all locations now"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Scanning…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ──────────────────────────────────────────────────── */}
      <div className="filter-tabs">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            style={filter === f && f !== 'All' ? {
              background: RISK_CONFIG[f]?.bg,
              color: RISK_CONFIG[f]?.color,
              borderColor: RISK_CONFIG[f]?.border,
            } : {}}
          >
            {f}
            {f !== 'All' && (
              <span className="tab-count">
                {locations.filter(l => l.risk_level === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Location Cards ──────────────────────────────────────────────── */}
      <GlobalAlertModal locations={locations} />
      <div className="locations-grid">
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Scanning critical zones across Northeast India…</p>
            <p style={{ fontSize: '0.75rem', color: '#a8a29e', marginTop: 4 }}>
              First scan may take up to 30 seconds
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={32} color="#16a34a" />
            <p>No {filter !== 'All' ? filter : ''} risk locations found</p>
            <button className="refresh-btn" onClick={handleForceSweep}>
              <RefreshCw size={14} /> Scan Now
            </button>
          </div>
        ) : (
          filtered.map((loc, idx) => {
            const cfg = RISK_CONFIG[loc.risk_level] || RISK_CONFIG.Low;
            const isCritical = loc.risk_level === 'Critical';
            return (
              <div
                key={loc.id || idx}
                className={`location-card ${isCritical ? 'location-card-critical' : ''}`}
                style={{ borderTop: `3px solid ${cfg.color}` }}
                onClick={() => onLocationClick(loc.lat, loc.lon, {
                  lat: loc.lat, lon: loc.lon,
                  location_name: loc.location_name,
                  risk_level: loc.risk_level,
                  confidence: loc.confidence,
                  risk_score: loc.risk_score,
                  features: loc.features_json ? JSON.parse(loc.features_json) : null,
                  gemini_explanation: loc.gemini_explanation,
                  timestamp: loc.timestamp,
                })}
              >
                {/* Rank indicator */}
                <div className="card-rank" style={{ color: cfg.color }}>
                  #{idx + 1}
                </div>

                {/* Location name & badge */}
                <div className="card-top">
                  <div className="card-name">
                    <MapPin size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                    {loc.location_name}
                  </div>
                  <RiskBadge level={loc.risk_level} />
                </div>

                {/* Confidence */}
                <div className="card-conf">
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: cfg.color }}>
                    {(loc.confidence * 100).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#78716c' }}>confidence</span>
                </div>
                <ConfBar value={loc.confidence} color={cfg.color} />

                {/* Gemini snippet */}
                {loc.gemini_explanation && (
                  <div className="card-gemini">
                    <span className="card-gemini-label">✨ AI:</span>
                    {loc.gemini_explanation.length > 90
                      ? loc.gemini_explanation.substring(0, 90) + '…'
                      : loc.gemini_explanation}
                  </div>
                )}

                {/* Footer */}
                <div className="card-footer">
                  <Clock size={11} />
                  {timeAgo(loc.timestamp)}
                  <span className="card-click-hint">Click for details →</span>
                </div>

                {isCritical && <div className="critical-pulse-ring" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
