/**
 * CitizenPortal — Public photo reporting portal
 * Tourists and citizens can upload concern photos only.
 * No admin data is exposed here.
 */
import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Upload, MapPin, CheckCircle, AlertCircle, X, ArrowLeft } from 'lucide-react';
import { uploadReport } from '../services/api';

export default function CitizenPortal() {
  const [image, setImage]           = useState(null);
  const [preview, setPreview]       = useState(null);
  const [manualLat, setManualLat]   = useState('');
  const [manualLon, setManualLon]   = useState('');
  const [locationName, setLocationName] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) { setError('Please select an image first.'); return; }
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', image);
    if (manualLat) formData.append('lat', manualLat);
    if (manualLon) formData.append('lon', manualLon);
    formData.append('location_name', locationName || 'Unknown Location');

    try {
      const data = await uploadReport(formData);
      setResult(data);
      setImage(null);
      setPreview(null);
      setManualLat('');
      setManualLon('');
      setLocationName('');
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const SEVERITY_COLORS = { Critical: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#16a34a', Pending: '#6b7280' };

  return (
    <div className="portal-page">
      {/* Header */}
      <div className="portal-topbar">
        <Link to="/" className="portal-back">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="portal-logo">
          <img src="/logo.png" alt="LandWatch" style={{ width: 28, height: 28 }} />
          <span>LandWatch <strong>NER</strong></span>
        </div>
      </div>

      <div className="portal-hero">
        <div className="portal-hero-icon">
          <Camera size={28} color="#d97706" />
        </div>
        <h1 className="portal-hero-title">Report a Land Concern</h1>
        <p className="portal-hero-desc">
          Spotted cracks, erosion, or suspicious land movement? Upload a photo —
          our AI will assess the risk and alert local authorities.
        </p>
        <div className="portal-disclaimer">
          ⚠️ Reports are AI-assisted and must be verified by local authorities before any action is taken.
        </div>
      </div>

      <div className="portal-card">
        {result ? (
          /* ── Success State ───────────────────────────────────────────── */
          <div className="upload-success">
            <CheckCircle size={48} color="#16a34a" />
            <h3>Report Submitted Successfully!</h3>
            <p>Your concern has been recorded and will be reviewed by authorities.</p>

            {result.gemini_analysis && (
              <div className="result-analysis" style={{ borderColor: SEVERITY_COLORS[result.severity] || '#6b7280' }}>
                <div className="result-severity" style={{ color: SEVERITY_COLORS[result.severity] }}>
                  AI Assessment: <strong>{result.severity} Risk</strong>
                </div>
                <p className="result-text">{result.gemini_analysis}</p>
              </div>
            )}

            {!result.gemini_analysis && (
              <div className="result-analysis">
                <p style={{ color: '#6b7280' }}>
                  AI analysis is being processed. Check back soon.
                </p>
              </div>
            )}

            <div className="result-meta">
              <MapPin size={13} /> {result.location_name}
              {result.has_exif_gps
                ? <span className="gps-tag gps-tag-verified"> · 📍 GPS from photo</span>
                : <span className="gps-tag"> · ✏️ Manual location</span>}
            </div>

            <button className="btn-primary" onClick={() => setResult(null)}>
              Submit Another Report
            </button>
          </div>
        ) : (
          /* ── Upload Form ─────────────────────────────────────────────── */
          <form onSubmit={handleSubmit}>
            <h2 className="form-section-title">
              <Camera size={16} /> Upload Photo
            </h2>

            {/* Drop Zone */}
            <div
              className={`drop-zone ${preview ? 'drop-zone-filled' : ''}`}
              onClick={() => fileRef.current.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              {preview ? (
                <div className="preview-wrapper">
                  <img src={preview} alt="Preview" className="preview-img" />
                  <button
                    type="button"
                    className="preview-remove"
                    onClick={e => { e.stopPropagation(); setImage(null); setPreview(null); }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={32} color="#d97706" />
                  <p className="drop-zone-text">
                    <strong>Click to upload</strong> or drag & drop
                  </p>
                  <p className="drop-zone-subtext">
                    JPG, PNG, HEIC · GPS metadata will be auto-extracted
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              style={{ display: 'none' }}
            />

            {/* Location Info */}
            <div className="form-section-divider">
              <h2 className="form-section-title">
                <MapPin size={16} /> Location (Optional — if GPS not in photo)
              </h2>
              <p className="form-hint">
                If your photo has GPS metadata, we'll extract it automatically.
                Otherwise, enter coordinates manually.
              </p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 25.57"
                  value={manualLat}
                  onChange={e => setManualLat(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 91.88"
                  value={manualLon}
                  onChange={e => setManualLon(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Location Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Near Cherrapunji road, Meghalaya"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                className="form-input"
              />
            </div>

            {error && (
              <div className="form-error">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button type="submit" className="btn-primary btn-submit" disabled={uploading || !image}>
              {uploading ? (
                <><span className="spinner-sm" /> Analyzing with AI…</>
              ) : (
                <><Upload size={16} /> Submit Report</>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="portal-footer">
        This service is provided by the LandWatch NER Early Warning System for Northeast India.
        For emergencies, contact local disaster management authorities immediately.
      </div>
    </div>
  );
}
