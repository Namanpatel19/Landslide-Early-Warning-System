/**
 * SatellitePreview — Shows satellite imagery for selected location
 * Displays ESRI World Imagery tile or Sentinel Hub PNG.
 * Overlay shows NDVI estimate and image source.
 */

import { useState, useEffect } from 'react';
import { getSatelliteData } from '../services/api';

const sourceLabels = {
  sentinel_hub:       'Sentinel-2 L2A',
  esri_world_imagery: 'ESRI World Imagery',
  opentopomap:        'OpenTopoMap',
};

export default function SatellitePreview({ lat, lon, locationName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lon) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    getSatelliteData(lat, lon)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [lat, lon]);

  const ndviColor = (v) => {
    if (!v) return '#94a3b8';
    if (v > 0.65) return '#22c55e';
    if (v > 0.45) return '#84cc16';
    if (v > 0.25) return '#eab308';
    return '#ef4444';
  };

  const ndviLabel = (v) => {
    if (!v) return 'N/A';
    if (v > 0.65) return 'Dense vegetation';
    if (v > 0.45) return 'Moderate vegetation';
    if (v > 0.25) return 'Sparse vegetation';
    return 'Bare / eroded soil';
  };

  return (
    <div className="satellite-panel">
      <div className="satellite-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>Satellite View</span>
        {data && (
          <span className="satellite-source-badge">
            {sourceLabels[data.source] || data.source}
          </span>
        )}
      </div>

      <div className="satellite-image-container">
        {loading && (
          <div className="satellite-loading">
            <div className="satellite-spinner" />
            <span>Loading imagery…</span>
          </div>
        )}

        {!loading && !data && !error && (
          <div className="satellite-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>Click map to load satellite view</span>
          </div>
        )}

        {error && (
          <div className="satellite-placeholder">
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              Image unavailable — using tile view
            </span>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Sentinel Hub: base64 PNG */}
            {data.image_b64 && (
              <img
                src={`data:image/png;base64,${data.image_b64}`}
                alt={`Satellite imagery of ${locationName || 'selected location'}`}
                className="satellite-image"
              />
            )}

            {/* ESRI tile: direct URL */}
            {data.tile_url && !data.image_b64 && (
              <img
                src={data.tile_url}
                alt={`Satellite tile for ${locationName || 'selected location'}`}
                className="satellite-image"
                crossOrigin="anonymous"
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}

            {/* NDVI overlay */}
            <div className="satellite-ndvi-overlay">
              <div className="ndvi-badge"
                   style={{ borderColor: ndviColor(data.ndvi_estimate) }}>
                <span className="ndvi-dot"
                      style={{ background: ndviColor(data.ndvi_estimate) }} />
                <span>{ndviLabel(data.ndvi_estimate)}</span>
                {data.ndvi_estimate && (
                  <span className="ndvi-value">
                    NDVI≈{data.ndvi_estimate.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {data && (
        <div className="satellite-meta">
          <span>{data.description}</span>
          {data.acquired_date && <span>{data.acquired_date}</span>}
        </div>
      )}
    </div>
  );
}
