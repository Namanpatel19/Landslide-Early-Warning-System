/**
 * AdminDashboard — Authority-only full access portal
 * Shows: all reports sorted by AI severity, verify/reject controls, alert history
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReports, updateReportStatus, getAlerts } from '../services/api';
import { ShieldCheck, XCircle, Clock, MapPin, Bell, ArrowLeft, RefreshCw, Eye, CheckCircle } from 'lucide-react';

import AutoScannedGrid from '../components/AutoScannedGrid';
import LocationDetailDrawer from '../components/LocationDetailDrawer';
import EmergencyPriorityPanel from '../components/EmergencyPriorityPanel';
import { predictRisk } from '../services/api';
import { getRiskDetails } from '../utils/helpers';
import { translations } from '../utils/translations';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const CRITICAL_CONFIDENCE_THRESHOLD = 0.90;

const SEV_ORDER = { 
  'Verified - Critical': 0, 'Verified - High': 1, 'Verified - Medium': 2, 'Verified - Low': 3, 
  Critical: 4, High: 5, Medium: 6, Low: 7, 'Needs Manual Review': 8, Pending: 9 
};
const SEV_STYLE = {
  'Verified - Critical': { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  'Verified - High':     { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  'Verified - Medium':   { bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
  'Verified - Low':      { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  'Needs Manual Review': { bg: '#fefce8', color: '#ca8a04', border: '#fde047' },
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
  const [tab, setTab]           = useState('map'); // Default to map now
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Map state
  const [activePrediction, setActivePrediction] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [lang, setLang] = useState('English');
  const t = translations[lang] || translations['English'];

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid authority password');
    }
  };

  const fetchAll = async () => {
    setRefreshing(true);
    try {
      const [r, aRes] = await Promise.all([getReports(), getAlerts(100)]);
      const sorted = [...r].sort((a, b) => (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5));
      setReports(sorted);
      
      const alertsArray = Array.isArray(aRes) ? aRes : (aRes.alerts || []);
      setAlerts(alertsArray);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleLocationClick = async (lat, lon, preloadedData = null) => {
    setDrawerOpen(true);
    setMapLoading(true);
    if (preloadedData) {
      setActivePrediction(preloadedData);
      setMapLoading(false);
      return;
    }
    try {
      const result = await predictRisk(lat, lon);
      setActivePrediction(result);
    } catch (err) {
      console.error('Prediction failed:', err);
    } finally {
      setMapLoading(false);
    }
  };

  const handleStatus = async (id, status) => {
    try {
      await updateReportStatus(id, status);
      fetchAll();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handleTruePositive = async (alertId) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${alertId}/true_positive`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('Alert marked as True Positive. Data saved for model RAG retraining.');
      } else {
        alert('Failed to mark true positive.');
      }
    } catch (e) {
      console.error(e);
      alert('Error confirming true positive.');
    }
  };

  const handleFalsePositive = async (alertId) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${alertId}/false_positive`, { method: 'POST' });
      if (res.ok) {
        alert('False alarm recorded! Model weights will adjust over time (RLHF).');
        fetchAll(); // Refresh to hide or update status (if needed)
      } else {
        alert('Failed to mark false alarm.');
      }
    } catch (e) {
      console.error(e);
      alert('Error confirming false alarm.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <select value={lang} onChange={e => setLang(e.target.value)} className="form-input" style={{ padding: '4px 12px', background: '#fff' }}>
            <option value="English">English</option>
            <option value="Hindi">हिंदी (Hindi)</option>
            <option value="Assamese">অসমীয়া (Assamese)</option>
          </select>
        </div>
        <div className="portal-card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <ShieldCheck size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ marginBottom: 8 }}>{t.authRestricted}</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
            {t.pleaseEnterPass}
          </p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              className="form-input" 
              placeholder={t.enterPassword} 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', marginBottom: 12, textAlign: 'center', letterSpacing: 4 }}
            />
            {loginError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{loginError}</div>}
            <button type="submit" className="btn-primary" style={{ background: '#dc2626' }}>
              {t.authenticate}
            </button>
          </form>
          <div style={{ marginTop: 24 }}>
            <Link to="/" className="portal-back" style={{ display: 'inline-flex', border: 'none' }}>
              <ArrowLeft size={14} /> {t.backToCitizen}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="portal-topbar">
        <Link to="/" className="portal-back">
          <ArrowLeft size={16} /> {t.backToCitizen}
        </Link>
        <div className="portal-logo">
          <img src="/logo.png" alt="Logo" style={{ width: 28, height: 28 }} />
          <span>AI-Based Risk Monitoring <strong>NER</strong></span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select value={lang} onChange={e => setLang(e.target.value)} className="form-input" style={{ padding: '4px 12px', background: '#fff', fontSize: '0.8rem', height: 32 }}>
            <option value="English">English</option>
            <option value="Hindi">हिंदी</option>
            <option value="Assamese">অসমীয়া</option>
          </select>
          <button className="refresh-btn" onClick={fetchAll} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {t.refresh}
          </button>
        </div>
      </div>

      <div className="admin-hero">
        <ShieldCheck size={24} color="#16a34a" />
        <div>
          <h1 className="admin-hero-title">{t.authControlPanel}</h1>
          <p className="admin-hero-sub">
            {t.authSub}
            <span style={{ color: '#dc2626', fontWeight: 600 }}> {t.restrictedAccess}</span>
          </p>
        </div>
        <div className="admin-stats">
          <div className="stat-box">
            <div className="stat-num">{reports.length}</div>
            <div className="stat-label">{t.totalReports}</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: '#dc2626' }}>
              {reports.filter(r => r.severity === 'Critical' || r.severity === 'High').length}
            </div>
            <div className="stat-label">{t.highPriority}</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: '#d97706' }}>
              {reports.filter(r => r.status === 'pending').length}
            </div>
            <div className="stat-label">{t.pendingReview}</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: '#ea580c' }}>
              {alerts.length}
            </div>
            <div className="stat-label">{t.systemAlerts}</div>
          </div>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>
          <MapPin size={14} /> {t.liveRiskMap}
        </button>
        <button className={`admin-tab ${tab === 'triage' ? 'active' : ''}`} onClick={() => setTab('triage')}>
          <ShieldCheck size={14} /> Emergency Prioritization
        </button>
        <button className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          <Eye size={14} /> {t.publicReports} ({reports.length})
        </button>
        <button className={`admin-tab ${tab === 'alerts' ? 'active' : ''}`} onClick={() => setTab('alerts')}>
          <Bell size={14} /> {t.systemAlerts} ({alerts.length})
        </button>
      </div>

      <div className="admin-body">
        {tab === 'map' && (
          <div style={{ position: 'relative' }}>
            <AutoScannedGrid onLocationClick={handleLocationClick} t={t} />
            {drawerOpen && (
              <LocationDetailDrawer
                prediction={activePrediction}
                isLoading={mapLoading}
                onClose={() => { setDrawerOpen(false); setActivePrediction(null); }}
                t={t}
              />
            )}
          </div>
        )}

        {tab === 'triage' && (
          <EmergencyPriorityPanel t={t} />
        )}

        {tab === 'reports' && (
          <div>
            {loading ? (
              <div className="empty-state"><div className="spinner" /><p>{t.loadingReports}</p></div>
            ) : reports.length === 0 ? (
              <div className="empty-state"><ShieldCheck size={32} color="#16a34a" /><p>{t.noPublicReports}</p></div>
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
                          {report.has_exif_gps ? `📍 ${t.gpsVerified}` : `✏️ ${t.manualLocation}`}
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
                          <ShieldCheck size={13} /> {t.verifyThreat}
                        </button>
                        <button
                          className="action-btn action-btn-reject"
                          onClick={() => handleStatus(report.id, 'rejected')}
                        >
                          <XCircle size={13} /> {t.falseReport}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'alerts' && (
          <div>
            {alerts.length === 0 ? (
              <div className="empty-state">
                <Bell size={32} color="#d97706" />
                <p>{t.noSystemAlerts}</p>
              </div>
            ) : (
              alerts.map(alert => {
                const cfg = getRiskDetails(alert.risk_score || 0);
                return (
                  <div key={alert.id} className="alert-row" style={{ borderLeft: `4px solid ${cfg.color}` }}>
                    <div style={{ flex: 1 }}>
                      <div className="alert-row-name">
                        <MapPin size={13} style={{ color: cfg.color }} />
                        {alert.location_name}
                      </div>
                      <div className="alert-row-meta">
                        {t[cfg.level.toLowerCase()] || cfg.level} Risk · {(alert.risk_score * 100).toFixed(1)}% score
                        {' · '}{new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      }}>
                        {(t[cfg.level.toLowerCase()] || cfg.level).toUpperCase()}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          className="action-btn" 
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '4px 8px', fontSize: 10, width: 'auto' }}
                          onClick={() => handleTruePositive(alert.id)}
                        >
                          <CheckCircle size={10} style={{ marginRight: 2 }} /> {t.confirmLandslide}
                        </button>
                        <button 
                          className="action-btn" 
                          style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', padding: '4px 8px', fontSize: 10, width: 'auto' }}
                          onClick={() => handleFalsePositive(alert.id)}
                        >
                          <XCircle size={10} style={{ marginRight: 2 }} /> {t.falseAlarm}
                        </button>
                      </div>
                    </div>
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
