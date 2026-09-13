/**
 * AlertModal — Critical Risk Alert Popup
 * ========================================
 * Triggered when prediction confidence > 90%.
 * Shows: red header, location, confidence %, top factors, action buttons.
 * Features: dimmed overlay, pulse/glow animation on warning icon.
 */

import React from 'react';
import { AlertTriangle, X, Bell, MapPin, Zap } from 'lucide-react';
import { featureDisplayName, formatConfidence } from '../utils/helpers';
import { notifyAuthorities } from '../services/api';

export default function AlertModal({ prediction, onDismiss }) {
  if (!prediction) return null;

  const handleNotify = async () => {
    try {
      await notifyAuthorities(prediction.id || 0);
      console.log('[ALERT] Authority notification triggered:', prediction.location_name);
      console.log('[Future scope] Twilio SMS / Firebase Push notification would fire here.');
      alert('✅ Authority notification logged! (SMS/Push integration is future scope)');
    } catch (err) {
      console.error('Notify failed:', err);
    }
    onDismiss();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Critical Alert">
      <div className="modal-box" style={{ maxWidth: 500 }}>
        {/* ─── Header ─── */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {/* Pulsing warning icon */}
          <div
            className="pulse-glow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#fef2f2',
              marginBottom: '1rem',
            }}
          >
            <AlertTriangle size={32} color="#dc2626" strokeWidth={2.5} />
          </div>

          <h2 style={{
            fontSize: '1.375rem',
            fontWeight: 800,
            color: '#dc2626',
            lineHeight: 1.2,
            marginBottom: '0.375rem',
          }}>
            Critical Landslide Risk Detected
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Immediate attention required
          </p>
        </div>

        {/* ─── Location ─── */}
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          padding: '0.875rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.625rem',
        }}>
          <MapPin size={16} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600, marginBottom: 2 }}>
              LOCATION
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
              {prediction.location_name}
            </div>
          </div>
        </div>

        {/* ─── Risk Score big number ─── */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            fontSize: '3rem',
            fontWeight: 900,
            color: '#dc2626',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {formatConfidence(prediction.risk_score || 0)}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Risk Score · {prediction.risk_level} Danger Level
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Model Confidence: {formatConfidence(prediction.confidence)}
          </div>
        </div>

        {/* ─── Top Contributing Factors ─── */}
        {prediction.top_factors && prediction.top_factors.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              marginBottom: '0.625rem',
            }}>
              <Zap size={14} color="var(--color-text-secondary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SHAP Local Explainability
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {prediction.top_factors.slice(0, 5).map((f, i) => (
                <div key={i}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                  }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                      {featureDisplayName(f.name)}
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#dc2626' }}>
                      {(f.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${f.importance * 100}%`,
                        background: i === 0
                          ? '#dc2626'
                          : i === 1 ? '#ea580c'
                          : '#d97706',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Action Buttons ─── */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            id="btn-notify-authorities"
            className="btn btn-primary"
            onClick={handleNotify}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <Bell size={16} />
            Notify Authorities
          </button>
          <button
            id="btn-dismiss-alert"
            className="btn btn-outline"
            onClick={onDismiss}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <X size={16} />
            Dismiss
          </button>
        </div>

        {/* ─── Disclaimer ─── */}
        <p style={{
          fontSize: '0.6875rem',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          marginTop: '1rem',
          lineHeight: 1.5,
        }}>
          Future scope: Real authority SMS/push alerts via Twilio & Firebase
        </p>
      </div>
    </div>
  );
}
