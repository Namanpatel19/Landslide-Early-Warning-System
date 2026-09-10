/**
 * useRiskColor — Returns color tokens for a given risk level.
 */
export function useRiskColor(riskLevel) {
  const map = {
    Low:      { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    Medium:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    High:     { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
    Critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  };
  return map[riskLevel] || map['Low'];
}

/**
 * getRiskDotColor — Returns the Leaflet marker color for risk level.
 */
export function getRiskDotColor(riskLevel) {
  const map = {
    Low: '#16a34a',
    Medium: '#d97706',
    High: '#ea580c',
    Critical: '#dc2626',
  };
  return map[riskLevel] || '#94a3b8';
}

/**
 * formatConfidence — e.g. 0.923 → "92.3%"
 */
export function formatConfidence(conf) {
  return `${(conf * 100).toFixed(1)}%`;
}

/**
 * formatDateTime — ISO string → "Sep 9, 20:15"
 */
export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-IN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

/**
 * featureDisplayName — snake_case → "Rainfall Intensity"
 */
export function featureDisplayName(key) {
  const map = {
    rainfall_intensity_mm: 'Rainfall Intensity',
    soil_moisture: 'Soil Moisture',
    slope_angle: 'Slope Angle',
    vegetation_index: 'Vegetation (NDVI)',
    seismic_activity: 'Seismic Activity',
    vibration_level: 'Vibration Level',
    soil_type_enc: 'Soil Type',
    historical_landslide_zone: 'Historical Landslide Zone',
    humidity: 'Humidity',
    temperature: 'Temperature',
    elevation: 'Elevation',
    distance_to_mining_area: 'Distance to Mining',
    distance_to_construction_area: 'Distance to Construction',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
