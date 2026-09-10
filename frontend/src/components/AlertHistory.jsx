/**
 * AlertHistory — Scrollable log of all triggered alerts
 * Persisted in SQLite via /alerts endpoint.
 */

import React, { useEffect, useState } from 'react';
import { Bell, Clock, CheckCircle2 } from 'lucide-react';
import { getAlerts } from '../services/api';
import { formatDateTime, useRiskColor } from '../utils/helpers';

function AlertRow({ alert }) {
  const { color, bg } = useRiskColor(alert.risk_level);
  return (
    <div style={{
      padding: '0.75rem',
      borderRadius: 'var(--radius-md)',
      background: bg,
      border: `1px solid`,
      borderColor: alert.risk_level === 'Critical' ? '#fecaca' : '#fed7aa',
      marginBottom: '0.5rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '0.5rem',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.8125rem', color, marginBottom: 2 }}>
            {alert.risk_level} Risk Alert
          </div>
          <div style={{
            fontSize: '0.75rem', color: 'var(--color-text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {alert.location_name?.split('(')[0]?.trim()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 4 }}>
            <Clock size={11} color="var(--color-text-muted)" />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              {formatDateTime(alert.timestamp)}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 800, color }}>
            {(alert.confidence * 100).toFixed(0)}%
          </div>
          {alert.notified && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 2 }}>
              <CheckCircle2 size={11} color="#16a34a" />
              <span style={{ fontSize: '0.65rem', color: '#16a34a' }}>Notified</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertHistory({ refreshTrigger }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = () => {
    getAlerts(20)
      .then((res) => setAlerts(res.alerts || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
  }, [refreshTrigger]);

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '0.875rem',
      }}>
        <Bell size={16} color="var(--risk-critical)" />
        <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Alert History</span>
        {alerts.length > 0 && (
          <span style={{
            background: 'var(--risk-critical)',
            color: '#fff',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.1rem 0.4rem',
            marginLeft: 'auto',
          }}>
            {alerts.length}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <div className="spinner" />
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>🔔</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            No alerts yet
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            High/Critical risk events will appear here
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)}
        </div>
      )}
    </div>
  );
}
