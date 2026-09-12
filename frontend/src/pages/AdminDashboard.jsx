/**
 * AdminDashboard — Authority-only full access portal
 * Shows: all reports sorted by AI severity, verify/reject controls, alert history
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReports, updateReportStatus, getAlerts } from '../services/api';
import { ShieldCheck, XCircle, Clock, MapPin, Bell, ArrowLeft, RefreshCw, Eye } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Pending: 4 };
const SEV_STYLE = {
  Critical: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  High:     { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  Medium:   { bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
  Low:      { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  Pending:  { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
};

function SevBadge({ severity }) {
  const s = SEV_STYLE[severity] || SEV_STYLE.Pending;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {severity?.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    verified: { icon: <ShieldCheck size={13} />, color: '#16a34a', label: 'Verified' },
    rejected: { icon: <XCircle size={13} />,    color: '#dc2626', label: 'Rejected' },
    pending:  { icon: <Clock size={13} />,       color: '#64748b', label: 'Pending' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: s.color, fontSize: 13, fontWeight: 600 }}>
      {s.icon} {s.label}
    </span>
  );
}

export default function AdminDashboard() {
  const [reports, setReports]   = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('reports');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async () => {
    setRefreshing(true);
    try {
      const [r, a] = await Promise.all([getReports(), getAlerts(100)]);
      // Sort reports by severity
      const sorted = [...r].sort((a, b) => (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5));
      setReports(sorted);
      setAlerts(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleStatus = async (id, status) => {
    try {
      await updateReportStatus(id, status);
      fetchAll();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  return (
    <div className="admin-page">
      {/* Topbar */}
      <div className="portal-topbar">
        <Link to="/" className="portal-back">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="portal-logo">
          <img src="/logo.png" alt="LandWatch" style={{ width: 28, height: 28 }} />
          <span>LandWatch <strong>NER</strong> · Authority Portal</span>
        </div>
        <button className="refresh-btn" onClick={fetchAll} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Authority Badge */}
      <div className="admin-hero">
        <ShieldCheck size={24} color="#16a34a" />
        <div>
          <h1 className="admin-hero-title">Authority Control Panel</h1>
          <p className="admin-hero-sub">
            Review public reports, verify threats, and manage alert history.
            <span style={{ color: '#dc2626', fontWeight: 600 }}> Restricted access.</span>
          </p>
        </div>
        <div className="admin-stats">
          <div className="stat-box">
            <div className="stat-num">{reports.length}</div>
            <div className="stat-label">Total Reports</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: '#dc2626' }}>
              {reports.filter(r => r.severity === 'Critical' || r.severity === 'High').length}
            </div>
            <div className="stat-label">High Priority</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: '#d97706' }}>
              {reports.filter(r => r.status === 'pending').length}
            </div>
            <div className="stat-label">Pending Review</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: '#ea580c' }}>
              {alerts.length}
            </div>
            <div className="stat-label">System Alerts</div>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          <Eye size={14} /> Public Reports ({reports.length})
        </button>
        <button className={`admin-tab ${tab === 'alerts' ? 'active' : ''}`} onClick={() => setTab('alerts')}>
          <Bell size={14} /> System Alerts ({alerts.length})
        </button>
      </div>

      <div className="admin-body">
        {/* ── Reports Tab ─────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div>
            {loading ? (
              <div className="empty-state"><div className="spinner" /><p>Loading reports…</p></div>
            ) : reports.length === 0 ? (
              <div className="empty-state"><ShieldCheck size={32} color="#16a34a" /><p>No public reports yet.</p></div>
            ) : (
              reports.map(report => (
                <div key={report.id} className="admin-report-card">
                  <div className="admin-report-image">
                    <img
                      src={`${API_BASE}/uploads/${report.image_path}`}
                      alt="Report"
                      onError={e => { e.target.src = '/logo.png'; }}
                    />
                  </div>

                  <div className="admin-report-content">
                    <div className="admin-report-top">
                      <div>
                        <div className="admin-report-name">
                          <MapPin size={13} style={{ color: '#3b82f6' }} />
                          {report.location_name}
                        </div>
                        <div className="admin-report-meta">
                          {report.has_exif_gps ? '📍 GPS verified' : '✏️ Manual location'}
                          {report.lat && report.lon
                            ? ` · (${report.lat.toFixed(4)}°N, ${report.lon.toFixed(4)}°E)`
                            : ''}
                          {' · '}{new Date(report.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <SevBadge severity={report.severity} />
                    </div>

                    {report.gemini_analysis && (
                      <div className="admin-gemini-box">
                        <div className="admin-gemini-title">✨ Gemini Vision Analysis</div>
                        <p>{report.gemini_analysis}</p>
                      </div>
                    )}

                    <div className="admin-report-disclaimer">
                      ⚠️ AI-assisted assessment — verify with field inspection before action
                    </div>
                  </div>

                  <div className="admin-report-actions">
                    <StatusBadge status={report.status} />
                    {report.status === 'pending' && (
                      <>
                        <button
                          className="action-btn action-btn-verify"
                          onClick={() => handleStatus(report.id, 'verified')}
                        >
                          <ShieldCheck size={13} /> Verify Threat
                        </button>
                        <button
                          className="action-btn action-btn-reject"
                          onClick={() => handleStatus(report.id, 'rejected')}
                        >
                          <XCircle size={13} /> False Report
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Alerts Tab ──────────────────────────────────────────────────── */}
        {tab === 'alerts' && (
          <div>
            {alerts.length === 0 ? (
              <div className="empty-state">
                <Bell size={32} color="#d97706" />
                <p>No system alerts yet. High/Critical predictions will appear here.</p>
              </div>
            ) : (
              alerts.map(alert => {
                const sev = SEV_STYLE[alert.risk_level] || SEV_STYLE.Pending;
                return (
                  <div key={alert.id} className="alert-row" style={{ borderLeft: `4px solid ${sev.color}` }}>
                    <div style={{ flex: 1 }}>
                      <div className="alert-row-name">
                        <MapPin size={13} style={{ color: sev.color }} />
                        {alert.location_name}
                      </div>
                      <div className="alert-row-meta">
                        {alert.risk_level} Risk · {(alert.confidence * 100).toFixed(1)}% confidence
                        {' · '}{new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <SevBadge severity={alert.risk_level} />
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
