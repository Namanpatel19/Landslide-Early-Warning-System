/**
 * AlertHistory — Scrollable log of all triggered alerts
 */
import React, { useEffect, useState } from 'react';
import { Bell, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { getAlerts } from '../services/api';

const RISK_COLORS = {
  Critical: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#16a34a',
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AlertHistory({ refreshTrigger }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = () => {
    getAlerts(30)
      .then(res => setAlerts(Array.isArray(res) ? res : (res.alerts || [])))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(); }, [refreshTrigger]);

  return (
    <div className="alert-history-card">
      <div className="alert-history-header">
        <div className="alert-history-title">
          <Bell size={14} color="#dc2626" />
          Alert History
          {alerts.length > 0 && (
            <span style={{
              background: '#dc2626', color: '#fff',
              borderRadius: 99, fontSize: 10, fontWeight: 800, padding: '1px 7px',
            }}>
              {alerts.length}
            </span>
          )}
        </div>
        <button
          className="refresh-btn"
          onClick={fetchAlerts}
          style={{ padding: '4px 8px', fontSize: 11 }}
        >
          <RefreshCw size={11} />
        </button>
      </div>

      <div className="alert-history-body">
        {loading ? (
          <div className="alert-empty"><div className="spinner" /></div>
        ) : alerts.length === 0 ? (
          <div className="alert-empty">
            <div style={{ fontSize: 22, marginBottom: 4 }}>🔔</div>
            <div>No alerts yet</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>High/Critical risk events will appear here</div>
          </div>
        ) : (
          alerts.map(alert => {
            const color = RISK_COLORS[alert.risk_level] || '#94a3b8';
            return (
              <div key={alert.id} className="alert-item">
                <div className="alert-dot" style={{ background: color }} />
                <div>
                  <div className="alert-item-name" style={{ color }}>
                    {alert.risk_level} Risk
                  </div>
                  <div className="alert-item-meta">
                    {alert.location_name?.split('(')[0]?.trim()}
                  </div>
                  <div className="alert-item-meta" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Clock size={10} />
                    {timeAgo(alert.timestamp)} · {(alert.confidence * 100).toFixed(0)}%
                    {alert.notified && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#16a34a', marginLeft: 4 }}>
                        <CheckCircle2 size={10} /> Notified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
