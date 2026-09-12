import React, { useState } from 'react';
import { uploadReport } from '../services/api';
import { Camera, MapPin, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ReportPortal() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      const objectUrl = URL.createObjectURL(selected);
      setPreview(objectUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a photo to upload.');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('image', file);
    formData.append('location_name', locationName || 'Unknown');
    if (lat) formData.append('lat', parseFloat(lat));
    if (lon) formData.append('lon', parseFloat(lon));

    try {
      await uploadReport(formData);
      setSuccess(true);
      setFile(null);
      setPreview(null);
      setLocationName('');
      setLat('');
      setLon('');
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="portal-container" style={{ textAlign: 'center' }}>
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" style={{ margin: '0 auto', width: 64, height: 64, color: '#10b981' }} />
        <h2 className="portal-title" style={{ justifyContent: 'center', marginBottom: 10 }}>Report Submitted Successfully</h2>
        <p className="portal-text">
          Thank you. Your photo will be analyzed by our AI system and verified by local authorities.
        </p>
        <button 
          onClick={() => setSuccess(false)}
          className="btn-primary" style={{ width: 'auto', margin: '0 auto' }}
        >
          Submit Another Report
        </button>
        <div className="mt-4">
           <Link to="/" className="text-blue-500 hover:underline">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-container">
      <div className="portal-header">
         <h1 className="portal-title">
            <Camera style={{ width: 24, height: 24, color: '#3b82f6' }} />
            Report a Landslide Concern
         </h1>
         <Link to="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>Back to Map</Link>
      </div>

      <p className="portal-text">
        Upload a photo of potential landslide signs (cracks, severe erosion, unusual water seepage). 
        Our AI (Gemini) will perform an initial assessment, and local authorities will review it.
      </p>

      {error && (
        <div style={{ padding: 12, marginBottom: 24, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, display: 'flex', gap: 8 }}>
          <AlertCircle style={{ width: 20, height: 20 }} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Photo Upload */}
        <div className="upload-box">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange}
            className="upload-input"
          />
          {preview ? (
            <div>
              <img src={preview} alt="Preview" style={{ maxHeight: 250, margin: '0 auto', borderRadius: 8 }} />
              <p style={{ marginTop: 10, fontSize: 14, color: '#3b82f6' }}>Click to change photo</p>
            </div>
          ) : (
            <div>
              <Upload style={{ width: 40, height: 40, color: '#94a3b8', margin: '0 auto 10px' }} />
              <p style={{ fontWeight: 500, color: '#333' }}>Click or drag a photo here</p>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 5 }}>
                If your phone saves GPS location in photos, we will extract it automatically.
              </p>
            </div>
          )}
        </div>

        {/* Location Details */}
        <div className="section-box">
          <h3 className="portal-title" style={{ fontSize: '1.1rem', marginBottom: 5 }}>
            <MapPin style={{ width: 18, height: 18, color: '#3b82f6' }} />
            Location Details (Optional)
          </h3>
          <p className="portal-text" style={{ marginBottom: 15 }}>
            If your photo doesn't have GPS data, please provide the location manually.
          </p>

          <div className="form-group">
            <label className="form-label">Location Description</label>
            <input 
              type="text" 
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Near Shillong Highway MS 4"
              className="form-input"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input 
                type="number" step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="25.57"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input 
                type="number" step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="91.88"
                className="form-input"
              />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? 'Analyzing with AI & Uploading...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
