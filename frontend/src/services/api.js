/**
 * API Service — LandWatch NER Frontend
 * ======================================
 * All backend API calls go through this module.
 * Base URL comes from VITE_API_URL env var (falls back to Vite proxy).
 * 
 * In development: Vite proxies /api → http://localhost:8000
 * In production:  VITE_API_URL=https://your-backend.onrender.com
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
    // Network error (backend completely unreachable)
    throw new Error('Backend offline — start: uvicorn app.main:app --reload --port 8000');
  }

  if (!res.ok) {
    // Try to parse JSON error detail; fall back to status text
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `API error ${res.status}`);
    }
    // Non-JSON (e.g. Vite proxy HTML "Not Found" when backend is down)
    if (res.status === 404) throw new Error(`Endpoint not found: ${path}`);
    if (res.status >= 500) throw new Error('Backend error — check uvicorn logs');
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ── Prediction ───────────────────────────────────────────────────────────────

/**
 * POST /predict
 * Fetches live weather, seismic, satellite data and runs ML prediction.
 * @returns {Promise<PredictResponse>}
 */
export async function predictRisk(lat, lon, locationName = null) {
  return apiFetch('/predict', {
    method: 'POST',
    body: JSON.stringify({ lat, lon, location_name: locationName }),
  });
}

/**
 * GET /predict/weather-history
 * Returns 7-day daily rainfall trend from Open-Meteo Archive API.
 */
export async function getWeatherHistory(lat, lon, days = 7) {
  return apiFetch(`/predict/weather-history?lat=${lat}&lon=${lon}&days=${days}`);
}

// ── History & Alerts ─────────────────────────────────────────────────────────

/** GET /history — paginated prediction history */
export async function getHistory(limit = 50, riskLevel = null) {
  const params = new URLSearchParams({ limit });
  if (riskLevel) params.append('risk_level', riskLevel);
  return apiFetch(`/history?${params}`);
}

/** GET /history/high-risk-zones — distinct recent High/Critical locations */
export async function getHighRiskZones() {
  return apiFetch('/history/high-risk-zones');
}

/** GET /alerts — alert log (High/Critical events) */
export async function getAlerts(limit = 50) {
  return apiFetch(`/alerts?limit=${limit}`);
}

/** POST /alerts/notify — log authority notification */
export async function notifyAuthorities(predictionId) {
  return apiFetch('/alerts/notify', {
    method: 'POST',
    body: JSON.stringify({ prediction_id: predictionId, method: 'dashboard' }),
  });
}

// ── News ─────────────────────────────────────────────────────────────────────

/**
 * GET /news
 * Recent landslide news from GNews API or Google News RSS.
 * Works without any API key (falls back to free RSS).
 */
export async function getLandslideNews(limit = 6) {
  return apiFetch(`/news?limit=${limit}`);
}

// ── Satellite ─────────────────────────────────────────────────────────────────

/**
 * GET /satellite
 * Returns satellite tile URL (ESRI) or base64 PNG (Sentinel Hub).
 * Works without API key — ESRI tiles are always free.
 */
export async function getSatelliteData(lat, lon) {
  return apiFetch(`/satellite?lat=${lat}&lon=${lon}`);
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth() {
  return apiFetch('/health');
}
