import React, { useEffect, useState } from 'react';
import { getReports, updateReportStatus } from '../services/api';
import { ShieldCheck, XCircle, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const data = await getReports();
      setReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateReportStatus(id, status);
      fetchReports();
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'Critical': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">CRITICAL</span>;
      case 'High': return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-bold">HIGH</span>;
      case 'Medium': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">MEDIUM</span>;
      default: return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">{sev.toUpperCase()}</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified': return <span className="flex items-center gap-1 text-emerald-600 font-medium text-sm"><ShieldCheck className="w-4 h-4"/> Verified</span>;
      case 'rejected': return <span className="flex items-center gap-1 text-red-600 font-medium text-sm"><XCircle className="w-4 h-4"/> False Report</span>;
      default: return <span className="flex items-center gap-1 text-gray-500 font-medium text-sm"><Clock className="w-4 h-4"/> Pending</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-2xl font-bold text-gray-800">Admin: Public Reports Review</h1>
         <Link to="/" className="text-blue-500 hover:underline">Back to Map</Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border text-center text-gray-500">No public reports submitted yet.</div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-6">
              
              <div className="w-full md:w-48 shrink-0">
                <img 
                  src={`${API_BASE}/uploads/${report.image_path}`} 
                  alt="Report" 
                  className="w-full h-32 object-cover rounded-lg border"
                />
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      {report.location_name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {report.has_exif_gps ? "📍 GPS from Photo EXIF" : "✏️ Manual Location"} 
                      {report.lat && report.lon ? ` (${report.lat.toFixed(4)}, ${report.lon.toFixed(4)})` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Reported: {new Date(report.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    {getSeverityBadge(report.severity)}
                  </div>
                </div>

                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                    ✨ Gemini Vision Analysis
                  </h4>
                  <p className="text-sm text-gray-700">
                    {report.gemini_analysis || "No analysis available."}
                  </p>
                </div>
              </div>

              <div className="w-full md:w-48 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                <div className="mb-2">
                  {getStatusBadge(report.status)}
                </div>
                {report.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleStatusChange(report.id, 'verified')}
                      className="w-full py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium rounded-lg text-sm transition"
                    >
                      Verify as Threat
                    </button>
                    <button 
                      onClick={() => handleStatusChange(report.id, 'rejected')}
                      className="w-full py-2 bg-red-100 text-red-700 hover:bg-red-200 font-medium rounded-lg text-sm transition"
                    >
                      Mark False Report
                    </button>
                  </>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
