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
      <div className="max-w-2xl mx-auto p-6 mt-10 bg-white rounded-xl shadow-sm text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Report Submitted Successfully</h2>
        <p className="text-gray-600 mb-6">
          Thank you. Your photo will be analyzed by our AI system and verified by local authorities.
        </p>
        <button 
          onClick={() => setSuccess(false)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
    <div className="max-w-2xl mx-auto p-6 mt-10 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
         <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Camera className="w-6 h-6 text-blue-500" />
            Report a Landslide Concern
         </h1>
         <Link to="/" className="text-sm text-blue-500 hover:underline">Back to Map</Link>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Upload a photo of potential landslide signs (cracks, severe erosion, unusual water seepage). 
        Our AI (Gemini) will perform an initial assessment, and local authorities will review it.
      </p>

      {error && (
        <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition cursor-pointer relative">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {preview ? (
            <div className="space-y-4">
              <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-sm" />
              <p className="text-sm text-blue-600 font-medium">Click to change photo</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="text-gray-700 font-medium">Click or drag a photo here</p>
              <p className="text-xs text-gray-500">
                If your phone saves GPS location in photos, we will extract it automatically.
              </p>
            </div>
          )}
        </div>

        {/* Location Details */}
        <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-100">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            Location Details (Optional)
          </h3>
          <p className="text-xs text-gray-500">
            If your photo doesn't have GPS data, please provide the location manually.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location Description</label>
            <input 
              type="text" 
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Near Shillong Highway MS 4"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input 
                type="number" step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="25.57"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input 
                type="number" step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="91.88"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          {submitting ? 'Analyzing with AI & Uploading...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
