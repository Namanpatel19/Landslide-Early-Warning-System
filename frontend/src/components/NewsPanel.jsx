/**
 * NewsPanel — Recent landslide news for NER
 */
import { useState, useEffect } from 'react';
import { Newspaper, RefreshCw } from 'lucide-react';
import { getLandslideNews } from '../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch { return ''; }
}

export default function NewsPanel() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);

  const loadNews = () => {
    setLoading(true);
    getLandslideNews(5)
      .then(d => setArticles(d.articles || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNews();
    const id = setInterval(loadNews, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="news-card">
      <div className="news-header">
        <div className="news-title">
          <Newspaper size={14} color="#d97706" />
          Recent Alerts & News
        </div>
        <button className="refresh-btn" onClick={loadNews} style={{ padding: '4px 8px', fontSize: 11 }}>
          <RefreshCw size={11} />
        </button>
      </div>

      <div className="news-body">
        {loading ? (
          <div className="alert-empty"><div className="spinner" /></div>
        ) : articles.length === 0 ? (
          <div className="alert-empty" style={{ padding: 16 }}>No recent news found.</div>
        ) : (
          articles.map((a, i) => (
            <a
              key={i}
              href={a.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="news-item"
              style={{ display: 'block', textDecoration: 'none' }}
            >
              <div className="news-source">{a.source}</div>
              <div className="news-headline">{a.title}</div>
              <div className="news-time">{timeAgo(a.published_at)}</div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
