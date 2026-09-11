/**
 * LandWatch NER — Main Application
 * ====================================
 * Layout:
 *   Header (nav + API status)
 *   Body:
 *     Left panel:   RiskCard → SatellitePreview → RainfallChart
 *     Center:       Interactive Leaflet Map (NER-locked)
 *     Right panel:  HighRiskZones → AlertHistory → NewsPanel
 *   Critical Alert Modal (fires at confidence > 90%)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Mountain, Wifi, WifiOff, Satellite, Newspaper, Camera, ShieldCheck, AlertTriangle } from 'lucide-react';

import Map from './components/Map';
import RiskCard from './components/RiskCard';
import RainfallChart from './components/RainfallChart';
import AutoScannedList from './components/AutoScannedList';
import AlertHistory from './components/AlertHistory';
import AlertModal from './components/AlertModal';
import SatellitePreview from './components/SatellitePreview';
import NewsPanel from './components/NewsPanel';

import ReportPortal from './pages/ReportPortal';
import AdminDashboard from './pages/AdminDashboard';

import { predictRisk, getHealth } from './services/api';

const CRITICAL_CONFIDENCE_THRESHOLD = 0.90;

function MainDashboard() {
  const [predictions, setPredictions]         = useState([]);
  const [activePrediction, setActivePrediction] = useState(null);
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState(null);
  const [apiStatus, setApiStatus]             = useState('unknown');
  const [criticalAlert, setCriticalAlert]     = useState(null);
  const [alertRefreshTrigger, setAlertRefreshTrigger] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // ── API health check every 30s ──────────────────────────────────────────────
  useEffect(() => {
    const check = () =>
      getHealth()
        .then(r => setApiStatus(r.model_loaded ? 'up' : 'model_missing'))
        .catch(() => setApiStatus('down'));
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Map click handler ───────────────────────────────────────────────────────
  const handleLocationClick = useCallback(async (lat, lon) => {
    setIsLoading(true);
    setError(null);
    setSelectedLocation({ lat, lon });

    try {
      const result = await predictRisk(lat, lon);
      setActivePrediction(result);
      setPredictions(prev => [result, ...prev].slice(0, 50));

      // Trigger critical alert modal
      if (result.confidence >= CRITICAL_CONFIDENCE_THRESHOLD &&
          result.risk_level !== 'Low') {
        setCriticalAlert(result);
      }

      // Refresh alert history panel
      if (['High', 'Critical'].includes(result.risk_level)) {
        setAlertRefreshTrigger(t => t + 1);
      }
    } catch (err) {
      setError(err.message || 'Prediction failed. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const statusBadge = {
    up:            { text: 'Live', color: '#22c55e', icon: <Wifi size={12}/> },
    down:          { text: 'Backend offline', color: '#ef4444', icon: <WifiOff size={12}/> },
    model_missing: { text: 'Model not trained', color: '#f59e0b', icon: <WifiOff size={12}/> },
    unknown:       { text: 'Connecting…', color: '#94a3b8', icon: <Wifi size={12}/> },
  }[apiStatus];

  return (
    <div className="app-root">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="flex items-center gap-6">
          <h1 className="logo">
            <Mountain className="text-yellow-400 w-6 h-6" />
            LandWatch <span className="text-yellow-400">NER</span>
          </h1>
          <span className="text-sm font-medium opacity-60 hidden sm:inline">
            Landslide Early Warning System
          </span>
        </div>

        <div className="flex-1 text-center hidden md:block text-xs font-semibold tracking-wider opacity-50 uppercase">
          Northeast India · Real-Time AI Monitoring
        </div>

        <div className="flex items-center gap-4">
          <Link to="/report" className="flex items-center gap-1 text-sm font-medium text-blue-200 hover:text-white transition">
            <Camera className="w-4 h-4" /> Report Concern
          </Link>
          <Link to="/admin" className="flex items-center gap-1 text-sm font-medium text-emerald-200 hover:text-white transition">
            <ShieldCheck className="w-4 h-4" /> Admin
          </Link>
          
          <div className={`status-badge ${apiStatus}`}>
            {apiStatus === 'up' && <><Wifi className="w-4 h-4" /> System Live</>}
            {apiStatus === 'down' && <><WifiOff className="w-4 h-4" /> Backend offline</>}
            {apiStatus === 'model_missing' && <><AlertTriangle className="w-4 h-4" /> Model Missing</>}
            {apiStatus === 'unknown' && 'Connecting...'}
          </div>
        </div>
      </header>

      {/* ── Loading bar ────────────────────────────────────────────────────── */}
      {isLoading && <div className="loading-bar" />}

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="error-banner">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <main className="app-body">

        {/* LEFT PANEL */}
        <aside className="sidebar sidebar-left">
          <RiskCard prediction={activePrediction} isLoading={isLoading} />

          {/* Satellite image — updates on each click */}
          {selectedLocation && (
            <SatellitePreview
              lat={selectedLocation.lat}
              lon={selectedLocation.lon}
              locationName={activePrediction?.location_name}
            />
          )}

          <RainfallChart
            lat={activePrediction?.lat}
            lon={activePrediction?.lon}
          />
        </aside>

        {/* CENTER — MAP (NER-locked) */}
        <section className="map-section">
          <Map
            predictions={predictions}
            onLocationClick={handleLocationClick}
            isLoading={isLoading}
          />
          <div className="map-hint">
            {isLoading
              ? '⏳ Fetching live data & running AI prediction…'
              : '📍 Click anywhere on the NER map to predict landslide risk'}
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="sidebar sidebar-right">
          <AutoScannedList onLocationClick={handleLocationClick} />
          <AlertHistory refreshTrigger={alertRefreshTrigger} />
          <NewsPanel />
        </aside>

      </main>

      {/* ── Critical Alert Modal ────────────────────────────────────────────── */}
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
        <Route path="/" element={<MainDashboard />} />
        <Route path="/report" element={<ReportPortal />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}
