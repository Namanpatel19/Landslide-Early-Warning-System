import React, { useEffect, useState } from 'react';
import { getAutoScanned, forceSweep } from '../services/api';
import { RefreshCw, AlertTriangle, ShieldCheck, ShieldAlert, Navigation } from 'lucide-react';

export default function AutoScannedList({ onLocationClick }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date());

  const fetchLocations = async () => {
    try {
      const data = await getAutoScanned();
      setLocations(data);
      setLastSynced(new Date());
    } catch (e) {
      console.error("Failed to load scanned locations:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    const id = setInterval(fetchLocations, 60000); // refresh list every minute
    return () => clearInterval(id);
  }, []);

  const handleForceSweep = async () => {
    setRefreshing(true);
    try {
      await forceSweep();
      // Wait a few seconds for background sweep to populate something
      setTimeout(fetchLocations, 5000); 
    } catch (e) {
      console.error(e);
      setRefreshing(false);
    }
  };

  const getRiskIcon = (level) => {
    switch(level) {
      case 'Critical': return <AlertTriangle className="text-red-500 w-5 h-5" />;
      case 'High': return <ShieldAlert className="text-orange-500 w-5 h-5" />;
      case 'Medium': return <AlertTriangle className="text-yellow-500 w-5 h-5" />;
      default: return <ShieldCheck className="text-emerald-500 w-5 h-5" />;
    }
  };

  const getRiskColor = (level) => {
    switch(level) {
      case 'Critical': return 'bg-red-50 border-red-200 text-red-700';
      case 'High': return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'Medium': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      default: return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    }
  };

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden bg-white/80">
      <div className="p-4 border-b border-gray-200/50 flex justify-between items-center bg-gray-50/50">
        <div>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            Live NER Scans
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Last synced: {lastSynced.toLocaleTimeString()}
          </p>
        </div>
        <button 
          onClick={handleForceSweep}
          disabled={refreshing}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 disabled:opacity-50"
          title="Force Sweep"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Scanning critical zones...</div>
        ) : locations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No scans available yet.</div>
        ) : (
          locations.map(loc => (
            <div 
              key={loc.id} 
              onClick={() => onLocationClick(loc.lat, loc.lon)}
              className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getRiskColor(loc.risk_level)} bg-white`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-sm truncate pr-2 text-gray-800">{loc.location_name}</span>
                {getRiskIcon(loc.risk_level)}
              </div>
              <div className="flex justify-between items-center text-xs opacity-80 mt-1 mb-2">
                <span>{loc.risk_level} Risk</span>
                <span>{(loc.confidence * 100).toFixed(1)}% Conf</span>
              </div>
              
              {/* Mini Gemini Explanation */}
              {loc.gemini_explanation && (
                <div className="mt-2 text-[11px] leading-tight text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                  <span className="text-blue-600 font-semibold mr-1">✨ AI:</span>
                  {loc.gemini_explanation.length > 80 
                    ? loc.gemini_explanation.substring(0, 80) + '...' 
                    : loc.gemini_explanation}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
