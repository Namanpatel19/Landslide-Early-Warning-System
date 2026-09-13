/**
 * CitizenPortal — Public photo reporting portal
 * Tourists and citizens can upload concern photos only.
 * No admin data is exposed here.
 */
import React, { useState, useRef, useEffect } from 'react';
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

  const [language, setLanguage]     = useState('English');
  const [offlineSyncing, setOfflineSyncing] = useState(false);

  useEffect(() => {
    // Attempt sync when coming online
    const handleOnline = () => syncOfflineReports();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  async function syncOfflineReports() {
    const reports = JSON.parse(localStorage.getItem('offline_reports') || '[]');
    if (reports.length === 0) return;
    
    setOfflineSyncing(true);
    const remaining = [];
    for (const report of reports) {
      try {
        // Convert base64 back to blob
        const res = await fetch(report.image);
        const blob = await res.blob();
        
        const fd = new FormData();
        fd.append('image', blob, 'offline-upload.jpg');
        if (report.lat) fd.append('lat', report.lat);
        if (report.lon) fd.append('lon', report.lon);
        fd.append('location_name', report.location_name);
        fd.append('language', report.language || 'English');
        
        await uploadReport(fd);
      } catch (err) {
        remaining.push(report);
      }
    }
    localStorage.setItem('offline_reports', JSON.stringify(remaining));
    setOfflineSyncing(false);
    if (remaining.length === 0) {
      alert("All offline reports have been synced successfully!");
    }
  };

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
    
    if (!navigator.onLine) {
      const reader = new FileReader();
      reader.onload = () => {
        const offlineReports = JSON.parse(localStorage.getItem('offline_reports') || '[]');
        offlineReports.push({
          image: reader.result,
          lat: manualLat,
          lon: manualLon,
          location_name: locationName || 'Unknown Location',
          language: language
        });
        localStorage.setItem('offline_reports', JSON.stringify(offlineReports));
        setResult({
          severity: 'Pending',
          gemini_analysis: 'Offline mode: Report saved to device. It will automatically upload when internet is restored.',
          location_name: locationName || 'Unknown Location',
          has_exif_gps: !!(manualLat)
        });
        setImage(null);
        setPreview(null);
        setManualLat('');
        setManualLon('');
        setLocationName('');
      };
      reader.readAsDataURL(image);
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', image);
    if (manualLat) formData.append('lat', manualLat);
    if (manualLon) formData.append('lon', manualLon);
    formData.append('location_name', locationName || 'Unknown Location');
    formData.append('language', language);

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
      <div className="portal-topbar" style={{ justifyContent: 'space-between' }}>
        <div className="portal-logo">
          <img src="/logo.png" alt="LandWatch" style={{ width: 28, height: 28 }} />
          <span>LandWatch <strong>NER</strong></span>
        </div>
        <Link to="/admin" className="portal-back" style={{ background: '#f8fafc', color: '#16a34a', border: '1px solid #bbf7d0' }}>
          Authority Portal
        </Link>
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

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Location Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Near Cherrapunji road, Meghalaya"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Preferred Response Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="form-input"
                style={{ appearance: 'auto' }}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Assamese">Assamese (অসমীয়া)</option>
                <option value="Bengali">Bengali (বাংলা)</option>
              </select>
            </div>

            {error && (
              <div className="form-error">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            {!navigator.onLine && (
              <div className="form-error" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fef3c7', marginBottom: '1rem' }}>
                <AlertCircle size={15} color="#d97706" /> You are currently offline. Reports will be saved locally.
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

      <div className="portal-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div>
          This service is provided by the LandWatch NER Early Warning System for Northeast India.
          For emergencies, contact local disaster management authorities immediately.
        </div>
        
        {JSON.parse(localStorage.getItem('offline_reports') || '[]').length > 0 && navigator.onLine && (
          <button 
            onClick={syncOfflineReports} 
            disabled={offlineSyncing}
            style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {offlineSyncing ? 'Syncing...' : 'Sync Offline Reports'}
          </button>
        )}
      </div>
    </div>
  );
}
