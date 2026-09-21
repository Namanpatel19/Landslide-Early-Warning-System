/**
 * API Service — LandWatch NER Frontend
 * ======================================
 * All backend API calls go through this module.
 * Base URL comes from VITE_API_URL env var (falls back to Vite proxy).
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkErr) {
    throw new Error('Backend offline — start: uvicorn app.main:app --reload --port 8000');
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `API error ${res.status}`);
    }
    if (res.status === 404) throw new Error(`Endpoint not found: ${path}`);
    if (res.status >= 500) throw new Error('Backend error — check uvicorn logs');
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ── Prediction ────────────────────────────────────────────────────────────────

/** POST /predict — live data fetch + ML prediction */
export async function predictRisk(lat, lon, locationName = null) {
  return apiFetch('/predict', {
    method: 'POST',
    body: JSON.stringify({ lat, lon, location_name: locationName }),
  });
}

/** GET /predict/weather-history — 7-day rainfall trend */
export async function getWeatherHistory(lat, lon, days = 7) {
  return apiFetch(`/predict/weather-history?lat=${lat}&lon=${lon}&days=${days}`);
}

// ── History & Alerts ──────────────────────────────────────────────────────────

export async function getHistory(limit = 50, riskLevel = null) {
  const params = new URLSearchParams({ limit });
  if (riskLevel) params.append('risk_level', riskLevel);
  return apiFetch(`/history?${params}`);
}

export async function getHighRiskZones() {
  return apiFetch('/history/high-risk-zones');
}

export async function getAlerts(limit = 50) {
  return apiFetch(`/alerts?limit=${limit}`);
}

export async function getPublicAlerts() {
  return apiFetch('/alerts/public');
}

export async function notifyAuthorities(predictionId) {
  return apiFetch('/alerts/notify', {
    method: 'POST',
    body: JSON.stringify({ prediction_id: predictionId, method: 'dashboard' }),
  });
}

// ── News ──────────────────────────────────────────────────────────────────────

export async function getLandslideNews(limit = 6) {
  return apiFetch(`/news?limit=${limit}`);
}

// ── Satellite ─────────────────────────────────────────────────────────────────

export async function getSatelliteData(lat, lon) {
  return apiFetch(`/satellite?lat=${lat}&lon=${lon}`);
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth() {
  return apiFetch('/health');
}

// ── Sweeper ───────────────────────────────────────────────────────────────────

export async function getAutoScanned() {
  return apiFetch('/sweeper/latest');
}

export async function forceSweep() {
  return apiFetch('/sweeper/force', { method: 'POST' });
}

// ── Public Reporting ──────────────────────────────────────────────────────────

/** Upload a public concern report (multipart/form-data) */
export async function uploadReport(formData) {
  const url = `${BASE_URL}/reports/upload`;
  let res;
  try {
    // NOTE: Do NOT set Content-Type — browser sets it automatically with boundary for FormData
    res = await fetch(url, { method: 'POST', body: formData });
  } catch (networkErr) {
    throw new Error('Backend offline — cannot upload report.');
  }
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload failed: ${errorText}`);
  }
  return res.json();
}

export async function getReports() {
  return apiFetch('/reports');
}

export async function updateReportStatus(id, status) {
  return apiFetch(`/reports/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}
