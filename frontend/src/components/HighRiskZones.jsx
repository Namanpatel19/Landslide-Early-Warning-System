/**
 * HighRiskZones — Panel showing current High/Critical locations
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, MapPin } from 'lucide-react';
import { getHighRiskZones } from '../services/api';
import { useRiskColor } from '../utils/helpers';

function ZoneRow({ zone }) {
  const { color, bg } = useRiskColor(zone.risk_level);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      padding: '0.625rem 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.8125rem', fontWeight: 600,
          color: 'var(--color-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {zone.location_name?.split('(')[0]?.trim() || 'Unknown'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          {zone.lat?.toFixed(3)}°N, {zone.lon?.toFixed(3)}°E
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span className={`risk-badge ${zone.risk_level}`} style={{ fontSize: '0.65rem' }}>
          {zone.risk_level}
        </span>
        <div style={{ fontSize: '0.7rem', color, fontWeight: 700, marginTop: 2 }}>
          {zone.confidence}%
        </div>
      </div>
    </div>
  );
}

export default function HighRiskZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchZones = () => {
    setLoading(true);
    getHighRiskZones()
      .then((res) => setZones(res.zones || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchZones();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchZones, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.875rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} color="var(--risk-high)" />
          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>High-Risk Zones</span>
        </div>
        <button
          id="btn-refresh-zones"
          onClick={fetchZones}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', padding: '0.25rem',
            borderRadius: 'var(--radius-sm)',
          }}
          title="Refresh"
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <div className="spinner" />
        </div>
      ) : zones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            No high-risk zones detected
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Click on the map to analyze locations
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {zones.map((zone) => <ZoneRow key={zone.id} zone={zone} />)}
        </div>
      )}
    </div>
  );
}
