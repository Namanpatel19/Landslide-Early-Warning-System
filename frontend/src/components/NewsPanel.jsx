/**
 * NewsPanel — Recent landslide news for NER
 * Pulls from GNews API (with key) or Google News RSS (free fallback).
 * Refreshes every 15 minutes.
 */

import { useState, useEffect } from 'react';
import { getLandslideNews } from '../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch { return ''; }
}

export default function NewsPanel() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadNews = () => {
    setLoading(true);
    getLandslideNews(5)
      .then(d => {
        setArticles(d.articles || []);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNews();
    // Refresh every 15 minutes
    const interval = setInterval(loadNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="news-panel">
      <div className="panel-header">
        <div className="panel-title-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>
          </svg>
          <h3>Recent Alerts & News</h3>
        </div>
        <button className="refresh-btn" onClick={loadNews} title="Refresh news">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      {loading && (
        <div className="news-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="news-skeleton-item">
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-subtitle" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="news-error">
          <span>Could not load news</span>
          <button onClick={loadNews} className="retry-btn">Retry</button>
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <div className="news-empty">No recent news found.</div>
      )}

      {!loading && articles.length > 0 && (
        <div className="news-list">
          {articles.map((a, i) => (
            <a
              key={i}
              href={a.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="news-item"
            >
              <div className="news-item-header">
                <span className="news-source">{a.source}</span>
                <span className="news-time">{timeAgo(a.published_at)}</span>
              </div>
              <p className="news-title">{a.title}</p>
              {a.summary && (
                <p className="news-summary">{a.summary.slice(0, 100)}{a.summary.length > 100 ? '…' : ''}</p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
