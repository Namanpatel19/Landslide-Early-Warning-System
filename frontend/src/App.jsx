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



export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"       element={<CitizenPortal />} />
        <Route path="/admin"  element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}
