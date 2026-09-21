/**
 * AutoScannedGrid — Main city risk dashboard grid
 * Displays all 20 monitored NER locations sorted by risk score (Critical first)
 * Auto-refreshes every 2 minutes matching the backend sweeper interval
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getAutoScanned, forceSweep } from '../services/api';
import { getRiskDetails } from '../utils/helpers';
import GlobalAlertModal from './GlobalAlertModal';
import Map from './Map';
import { RefreshCw, AlertTriangle, ShieldCheck, Shield, Clock, MapPin, Grid, Map as MapIcon, Layers, Route } from 'lucide-react';

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function ConfBar({ value, color }) {
  return (
    <div className="conf-bar-track" style={{ marginTop: 4 }}>
      <div className="conf-bar-fill" style={{ width: `${(value * 100).toFixed(0)}%`, background: color }} />
    </div>
  );
}

export default function AutoScannedGrid({ onLocationClick, t }) {
  const [locations, setLocations]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [filter, setFilter]         = useState('All');
  const [regionFilter, setRegionFilter] = useState('All Regions');
  const [viewMode, setViewMode]     = useState('grid');
  const [showRoads, setShowRoads]   = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, regionFilter]);

  const fetchLocations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await getAutoScanned();
      // Sort by risk score descending
      const sorted = [...data].sort((a, b) => b.risk_score - a.risk_score);
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
  
  const regions = ['All Regions', ...new Set(locations.map(l => l.location_name?.split('(')[0]?.trim()).filter(Boolean))];

  let filtered = locations;
  if (filter !== 'All') {
    filtered = filtered.filter(l => getRiskDetails(l.risk_score).level === filter);
  }
  if (regionFilter !== 'All Regions') {
    filtered = filtered.filter(l => l.location_name?.split('(')[0]?.trim() === regionFilter);
  }

  const critCount  = locations.filter(l => getRiskDetails(l.risk_score).level === 'Critical').length;
  const highCount  = locations.filter(l => getRiskDetails(l.risk_score).level === 'High').length;
  
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
            {refreshing ? t.scanning : t.refresh}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 1.25rem', marginBottom: '1rem', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="filter-tabs" style={{ background: '#f5f5f4', padding: '4px', borderRadius: '9999px', display: 'inline-flex' }}>
              <button 
                 className={`filter-tab ${viewMode === 'grid' ? 'active' : ''}`}
                 onClick={() => setViewMode('grid')}
                 style={{ border: 'none', background: viewMode === 'grid' ? '#1c1917' : 'transparent' }}
              >
                 <Grid size={14} /> {t.gridView || "Grid View"}
              </button>
              <button 
                 className={`filter-tab ${viewMode === 'map' ? 'active' : ''}`}
                 onClick={() => setViewMode('map')}
                 style={{ border: 'none', background: viewMode === 'map' ? '#1c1917' : 'transparent' }}
              >
                 <MapIcon size={14} /> {t.mapView || "Map View"}
              </button>
          </div>

          {viewMode === 'map' && (
              <div className="filter-tabs" style={{ marginLeft: '8px' }}>
                 <button 
                    className={`filter-tab ${showRoads ? 'active' : ''}`}
                    onClick={() => setShowRoads(!showRoads)}
                    style={{ padding: '5px 12px', background: showRoads ? '#16a34a' : '', borderColor: showRoads ? '#16a34a' : '' }}
                 >
                    <Route size={14} /> {t.connectivities || "Connectivities"}
                 </button>
                 <button 
                    className={`filter-tab ${showHeatmap ? 'active' : ''}`}
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    style={{ padding: '5px 12px', background: showHeatmap ? '#ea580c' : '', borderColor: showHeatmap ? '#ea580c' : '' }}
                 >
                    <Layers size={14} /> {t.riskHeatmap || "Risk Heatmap"}
                 </button>
              </div>
          )}

          {viewMode === 'grid' && (
              <select 
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  outline: 'none'
                }}
              >
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
          )}
      </div>

      {/* ── Filter Tabs ──────────────────────────────────────────────────── */}
      <div className="filter-tabs">
        {FILTERS.map(f => {
          // Mock score to get colors for tabs
          const scoreMap = { Critical: 1.0, High: 0.80, Medium: 0.50, Low: 0.20 };
          const mockStyle = getRiskDetails(scoreMap[f] || 0);
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              style={filter === f && f !== 'All' ? {
                background: mockStyle.bg,
                color: mockStyle.color,
                borderColor: mockStyle.border,
              } : {}}
            >
              {f}
              {f !== 'All' && (
                <span className="tab-count">
                  {locations.filter(l => getRiskDetails(l.risk_score).level === f).length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Location Cards or Map ──────────────────────────────────────────────── */}
      <GlobalAlertModal locations={locations} />
      
      {viewMode === 'map' ? (
          <div style={{ height: 'calc(100vh - 250px)', width: '100%', padding: '0 1.25rem', paddingBottom: '1.25rem' }}>
              <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <Map 
                     predictions={filtered} 
                     onLocationClick={(lat, lon, data) => onLocationClick(lat, lon, data)} 
                     isLoading={loading} 
                     showRoads={showRoads}
                     showHeatmap={showHeatmap}
                  />
              </div>
          </div>
      ) : (
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
            <p>{t.noRiskLocations || "No risk locations found"}</p>
            <button className="refresh-btn" onClick={handleForceSweep}>
              <RefreshCw size={14} /> {t.scanNow || "Scan Now"}
            </button>
          </div>
        ) : (
          paginated.map((loc, idx) => {
            const cfg = getRiskDetails(loc.risk_score);
            const isCritical = cfg.level === 'Critical';
            // True index based on pagination for rank indicator
            const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
            return (
              <div
                key={loc.id || globalIdx}
                className={`location-card ${isCritical ? 'location-card-critical' : ''}`}
                style={{ borderTop: `3px solid ${cfg.color}` }}
                onClick={() => onLocationClick(loc.lat, loc.lon, {
                  lat: loc.lat, lon: loc.lon,
                  location_name: loc.location_name,
                  risk_level: loc.risk_level, // Keep original or use cfg.level? Use cfg.level below
                  confidence: loc.confidence,
                  risk_score: loc.risk_score,
                  features: loc.features_json ? JSON.parse(loc.features_json) : null,
                  gemini_explanation: loc.gemini_explanation,
                  timestamp: loc.timestamp,
                })}
              >
                {/* Rank indicator */}
                <div className="card-rank" style={{ color: cfg.color }}>
                  #{globalIdx + 1}
                </div>

                {/* Location name & badge */}
                <div className="card-top">
                  <div className="card-name">
                    <MapPin size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                    {loc.location_name}
                  </div>
                  <span className="risk-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {(t[cfg.level.toLowerCase()] || cfg.level).toUpperCase()}
                  </span>
                </div>

                {/* Values Display */}
                <div style={{ marginTop: 12, marginBottom: 8, display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: cfg.color }}>
                      {(loc.risk_score * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#78716c', fontWeight: 600, textTransform: 'uppercase' }}>{t.riskScore || "Risk Score"}</div>
                  </div>

                </div>
                <ConfBar value={loc.risk_score} color={cfg.color} />

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
                  <div style={{ flex: 1 }} />
                  <span className="card-click-hint">Click for details →</span>
                </div>

                {isCritical && <div className="critical-pulse-ring" />}
              </div>
            );
          })
        )}
      </div>
      )}

      {/* Pagination Controls */}
      {viewMode === 'grid' && totalPages > 1 && (
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '1rem' }}>
           <button 
             className="refresh-btn"
             disabled={currentPage === 1}
             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
           >
             Previous
           </button>
           <span style={{ fontSize: '14px', fontWeight: 600, color: '#4b5563' }}>
             Page {currentPage} of {totalPages}
           </span>
           <button 
             className="refresh-btn"
             disabled={currentPage === totalPages}
             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
           >
             Next
           </button>
        </div>
      )}
    </div>
  );
}
