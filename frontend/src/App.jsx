/**
 * LandWatch NER — Main Application (Redesigned)
 * ===============================================
 * Layout:
 *   Header (nav + status)
 *   Main body: Header stats bar + Sorted City Risk Grid
 *   Clicking a city → LocationDetailDrawer (mini map + full details)
 *
 * Two portals:
 *   /report  → Citizen/Tourist: photo upload only
 *   /admin   → Authority: full access (requires authority login in future)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import {
  Wifi, WifiOff, AlertTriangle, Camera, ShieldCheck,
  RefreshCw, Bell, TrendingUp, MapPin, Clock
} from 'lucide-react';

import AutoScannedGrid from './components/AutoScannedGrid';
import AlertModal from './components/AlertModal';
import AlertHistory from './components/AlertHistory';
import NewsPanel from './components/NewsPanel';
import LocationDetailDrawer from './components/LocationDetailDrawer';

import CitizenPortal from './pages/CitizenPortal';
import AdminDashboard from './pages/AdminDashboard';

import { predictRisk, getHealth, getAlerts } from './services/api';

const CRITICAL_CONFIDENCE_THRESHOLD = 0.90;

function MainDashboard() {
  const [activePrediction, setActivePrediction]   = useState(null);
  const [isLoading, setIsLoading]                 = useState(false);
  const [apiStatus, setApiStatus]                 = useState('unknown');
  const [criticalAlert, setCriticalAlert]         = useState(null);
  const [alertRefreshTrigger, setAlertRefreshTrigger] = useState(0);
  const [drawerOpen, setDrawerOpen]               = useState(false);
  const [alertCount, setAlertCount]               = useState(0);

  // API health check every 30s
  useEffect(() => {
    const check = () =>
      getHealth()
        .then(r => setApiStatus(r.model_loaded ? 'up' : 'model_missing'))
        .catch(() => setApiStatus('down'));
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  // Alert count badge
  useEffect(() => {
    getAlerts(100).then(a => setAlertCount(a.length)).catch(() => {});
    const id = setInterval(() => {
      getAlerts(100).then(a => setAlertCount(a.length)).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [alertRefreshTrigger]);

  const handleLocationClick = useCallback(async (lat, lon, preloadedData = null) => {
    setDrawerOpen(true);
    setIsLoading(true);

    if (preloadedData) {
      // If clicking a pre-scanned location, show it instantly then optionally refresh
      setActivePrediction(preloadedData);
      setIsLoading(false);
      return;
    }

    try {
      const result = await predictRisk(lat, lon);
      setActivePrediction(result);

      if (result.confidence >= CRITICAL_CONFIDENCE_THRESHOLD && result.risk_level !== 'Low') {
        setCriticalAlert(result);
      }
      if (['High', 'Critical'].includes(result.risk_level)) {
        setAlertRefreshTrigger(t => t + 1);
      }
    } catch (err) {
      console.error('Prediction failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const statusInfo = {
    up:            { label: 'System Live', color: '#16a34a', icon: <Wifi size={13} /> },
    down:          { label: 'Backend Offline', color: '#dc2626', icon: <WifiOff size={13} /> },
    model_missing: { label: 'Model Missing', color: '#f59e0b', icon: <AlertTriangle size={13} /> },
    unknown:       { label: 'Connecting…', color: '#94a3b8', icon: <Wifi size={13} /> },
  }[apiStatus];

  return (
    <div className="app-root">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.png" alt="LandWatch" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1c1917', lineHeight: 1.1 }}>
              LandWatch <span style={{ color: '#d97706' }}>NER</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#78716c', fontWeight: 500 }}>
              AI Landslide Early Warning · Northeast India
            </div>
          </div>
        </div>

        <div className="header-nav">
          <Link to="/report" className="nav-link nav-link-blue">
            <Camera size={14} /> Report Concern
          </Link>
          <Link to="/admin" className="nav-link nav-link-green">
            <ShieldCheck size={14} /> Authority Portal
          </Link>
          <div className="status-pill" style={{ background: statusInfo.color + '18', color: statusInfo.color }}>
            {statusInfo.icon} {statusInfo.label}
          </div>
          {alertCount > 0 && (
            <div className="alert-count-badge">
              <Bell size={12} /> {alertCount} alerts
            </div>
          )}
        </div>
      </header>

      {/* ── Main Body ──────────────────────────────────────────────────────── */}
      <main className="dashboard-main">
        {/* Left column: sorted location grid */}
        <div className="dashboard-left">
          <AutoScannedGrid onLocationClick={handleLocationClick} />
        </div>

        {/* Right column: alert history + news */}
        <div className="dashboard-right">
          <AlertHistory refreshTrigger={alertRefreshTrigger} />
          <NewsPanel />
        </div>
      </main>

      {/* ── Location Detail Drawer ─────────────────────────────────────────── */}
      {drawerOpen && (
        <LocationDetailDrawer
          prediction={activePrediction}
          isLoading={isLoading}
          onClose={() => { setDrawerOpen(false); setActivePrediction(null); }}
        />
      )}

      {/* ── Critical Alert Modal ───────────────────────────────────────────── */}
      {criticalAlert && (
        <AlertModal
          prediction={criticalAlert}
          onDismiss={() => setCriticalAlert(null)}
          onNotify={() => setCriticalAlert(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"       element={<MainDashboard />} />
        <Route path="/report" element={<CitizenPortal />} />
        <Route path="/admin"  element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}
