/**
 * RainfallChart — 7-day rainfall trend for selected location
 * Uses Recharts (lightweight, React-native chart library).
 */

import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { getWeatherHistory } from '../services/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.5rem 0.75rem',
        boxShadow: 'var(--shadow-md)',
        fontSize: '0.8125rem',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
        <div style={{ color: '#2563eb' }}>
          💧 {payload[0].value?.toFixed(1)} mm
        </div>
      </div>
    );
  }
  return null;
};

export default function RainfallChart({ lat, lon }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lon) return;
    setLoading(true);
    setError(null);

    getWeatherHistory(lat, lon, 7)
      .then((res) => {
        const chartData = (res.data || []).map((d) => ({
          date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rainfall: d.rainfall_mm,
        }));
        setData(chartData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [lat, lon]);

  if (!lat || !lon) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Select a location to view rainfall trend
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>
          7-Day Rainfall Trend
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
          Daily precipitation (mm) · Open-Meteo Archive
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div className="spinner" />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="rainfall"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#rainGradient)"
              dot={{ fill: '#2563eb', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
