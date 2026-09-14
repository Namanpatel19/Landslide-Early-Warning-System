import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function GlobalAlertModal({ locations }) {
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [activeAlert, setActiveAlert] = useState(null);

  useEffect(() => {
    // Find the first location with Critical risk AND > 90% confidence that hasn't been dismissed
    // Actually, trigger based on Critical risk score (>= 0.86)
    if (!locations || locations.length === 0) return;
    
    const criticalLocation = locations.find(
      loc => loc.risk_score >= 0.90 && !dismissedIds.has(loc.id)
    );

    if (criticalLocation) {
      setActiveAlert(criticalLocation);
    } else {
      setActiveAlert(null);
    }
  }, [locations, dismissedIds]);

  if (!activeAlert) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(220, 38, 38, 0.4)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        maxWidth: 500,
        width: '90%',
        boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.5)',
        border: '2px solid #dc2626',
        textAlign: 'center',
        position: 'relative'
      }}>
        <button 
          onClick={() => setDismissedIds(prev => new Set(prev).add(activeAlert.id))}
          style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
        >
          <X size={24} />
        </button>
        
        <div style={{ 
          width: 80, height: 80, borderRadius: 40, background: '#fef2f2', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          animation: 'pulse 1.5s infinite'
        }}>
          <AlertTriangle size={40} color="#dc2626" />
        </div>
        
        <h2 style={{ fontSize: 24, color: '#dc2626', marginBottom: 8, fontWeight: 800 }}>
          CRITICAL LANDSLIDE ALERT
        </h2>
        
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
          {activeAlert.location_name}
        </div>
        
        <p style={{ fontSize: 15, color: '#4b5563', marginBottom: 24, lineHeight: 1.6 }}>
          The AI model has detected an imminent landslide threat with a <strong>{(activeAlert.risk_score * 100).toFixed(1)}% Risk Score</strong>. 
          Authorities must take immediate preventative action.
        </p>

        {activeAlert.gemini_explanation && (
          <div style={{ background: '#fef2f2', padding: 16, borderRadius: 8, textAlign: 'left', fontSize: 13, color: '#991b1b', border: '1px solid #fecaca', marginBottom: 24 }}>
            <strong>AI Assessment:</strong> {activeAlert.gemini_explanation}
          </div>
        )}
        
        <button 
          onClick={() => setDismissedIds(prev => new Set(prev).add(activeAlert.id))}
          style={{
            background: '#dc2626', color: '#fff', padding: '12px 24px', 
            borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 15,
            cursor: 'pointer', width: '100%'
          }}
        >
          Acknowledge Warning
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
