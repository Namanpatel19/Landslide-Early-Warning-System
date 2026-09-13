/**
 * getRiskDetails — Returns level, color, bg, border based STRICTLY on risk score (0-1).
 * 0-40% -> Low
 * 41-65% -> Medium
 * 66-85% -> High
 * 86-100% -> Critical
 */
export function getRiskDetails(riskScore) {
  // If undefined or invalid, default to Low
  if (typeof riskScore !== 'number') return { level: 'Pending', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' };
  
  const pct = Math.round(riskScore * 100);
  if (pct <= 40) return { level: 'Low',      color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
  if (pct <= 65) return { level: 'Medium',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  if (pct <= 85) return { level: 'High',     color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
  return                { level: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
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
