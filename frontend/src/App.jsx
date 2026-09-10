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
import { Mountain, Wifi, WifiOff, Satellite, Newspaper } from 'lucide-react';

import Map from './components/Map';
import RiskCard from './components/RiskCard';
import RainfallChart from './components/RainfallChart';
import HighRiskZones from './components/HighRiskZones';
import AlertHistory from './components/AlertHistory';
import AlertModal from './components/AlertModal';
import SatellitePreview from './components/SatellitePreview';
import NewsPanel from './components/NewsPanel';

import { predictRisk, getHealth } from './services/api';

const CRITICAL_CONFIDENCE_THRESHOLD = 0.90;

export default function App() {
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
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand">
          <Mountain size={20} className="brand-icon" />
          <span className="brand-name">LandWatch <em>NER</em></span>
          <span className="brand-sub">Landslide Early Warning System</span>
        </div>

        <div className="header-center">
          <span className="header-region">Northeast India · Real-Time AI Monitoring</span>
        </div>

        <div className="header-right">
          <div className="api-status-badge" style={{ borderColor: statusBadge.color }}>
            <span style={{ color: statusBadge.color }}>{statusBadge.icon}</span>
            <span style={{ color: statusBadge.color, fontSize: 11 }}>
              {statusBadge.text}
            </span>
          </div>
          <a href="http://localhost:8000/docs" target="_blank"
             rel="noopener noreferrer" className="api-docs-link">
            API Docs ↗
          </a>
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
          <HighRiskZones />
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
