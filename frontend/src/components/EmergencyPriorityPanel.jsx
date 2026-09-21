import React, { useEffect, useState, useCallback } from 'react';
import { getAutoScanned } from '../services/api';
import { ShieldAlert, Users, Route, AlertOctagon } from 'lucide-react';

export default function EmergencyPriorityPanel({ t }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAutoScanned();
      // Filter High/Critical
      let criticalHigh = data.filter(loc => loc.risk_level === 'High' || loc.risk_level === 'Critical');

      // Rank based on: Risk Score (50%) + Population Exposure (30%) + Road Connectivity Impact (20%)
      criticalHigh = criticalHigh.map(loc => {
        const features = loc.features_json ? JSON.parse(loc.features_json) : {};
        const pop = features.population_density || 0;
        const normalizedPop = Math.min(pop / 500, 1); // Normalize to 0-1
        
        // Road connectivity (closer to construction/roads = higher impact if blocked)
        const dist = features.distance_to_construction_area || 10;
        const roadImpact = dist < 2 ? 1 : (dist < 5 ? 0.5 : 0);

        const priority_score = (loc.risk_score * 0.5) + (normalizedPop * 0.3) + (roadImpact * 0.2);
        
        return {
          ...loc,
          priority_score,
          pop,
          roadImpact
        };
      });

      // Sort by priority_score descending
      criticalHigh.sort((a, b) => b.priority_score - a.priority_score);
      
      setLocations(criticalHigh);
    } catch (e) {
      console.error('Failed to load locations for emergency panel:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    const id = setInterval(fetchLocations, 120000);
    return () => clearInterval(id);
  }, [fetchLocations]);

  if (loading) {
    return <div className="empty-state"><div className="spinner" /></div>;
  }

  if (locations.length === 0) {
    return (
      <div className="empty-state">
        <ShieldAlert size={32} color="#16a34a" />
        <p>No High or Critical areas currently detected.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', marginBottom: '16px' }}>
        <AlertOctagon size={24} /> Emergency Prioritization (Triage)
      </h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Ranking based on: AI Risk Score (50%) + Population Exposure (30%) + Infrastructure Impact (20%).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {locations.map((loc, idx) => (
          <div key={loc.id} style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderLeft: `4px solid ${idx === 0 ? '#b91c1c' : (idx < 3 ? '#dc2626' : '#ea580c')}`,
            borderRadius: '8px', 
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                Priority {idx + 1}: {loc.location_name}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>
                Score: {(loc.priority_score * 100).toFixed(1)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldAlert size={14} color="#ea580c" /> AI Risk: {(loc.risk_score * 100).toFixed(1)}%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={14} color="#3b82f6" /> Pop: {loc.pop}/km²
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Route size={14} color="#8b5cf6" /> Road Impact: {loc.roadImpact === 1 ? 'High' : (loc.roadImpact === 0.5 ? 'Medium' : 'Low')}
              </span>
            </div>

            <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: '#334155', borderLeft: '2px solid #cbd5e1' }}>
              <strong>Reasoning:</strong> {loc.risk_score > 0.8 ? 'Extreme landslide probability.' : 'High landslide risk.'} 
              {loc.pop > 100 ? ' High population density exposes many residents.' : ' Low immediate population threat.'}
              {loc.roadImpact === 1 ? ' Critical road blockages likely.' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
