import React, { useState, useMemo } from 'react';
import { signalData } from '../data/signalData';
import { checkpoints } from '../data/checkpoints';
import { categoryToColor, getProviderColor } from '../utils/colorScale';
import { getRecommendation } from '../utils/signalUtils';
import './Components.css';

export default function RecommendationPanel({ provider, floor }) {
  const [showResults, setShowResults] = useState(true);

  const results = useMemo(() => {
    // Filter signal data for this provider and floor
    const filtered = signalData.filter(
      (s) => s.provider === provider && s.floor === floor
    );

    // Sort by RSRP descending (best first)
    const sorted = [...filtered].sort((a, b) => b.rsrp - a.rsrp);

    const best = sorted.slice(0, 3).map((s) => {
      const cp = checkpoints.find((c) => c.id === s.checkpoint_id);
      return { ...s, checkpoint: cp };
    });

    const worst = sorted
      .slice(-3)
      .reverse()
      .map((s) => {
        const cp = checkpoints.find((c) => c.id === s.checkpoint_id);
        return { ...s, checkpoint: cp };
      });

    return { best, worst };
  }, [provider, floor]);

  const recommendation = useMemo(
    () => getRecommendation(signalData, provider, floor),
    [provider, floor]
  );

  const handleSearch = () => {
    setShowResults(false);
    setTimeout(() => setShowResults(true), 600);
  };

  const providerColor = getProviderColor(provider);

  const renderItem = (item, index, isBest) => {
    const color = categoryToColor(item.kategori);
    const rankColors = isBest
      ? ['#FFD700', '#C0C0C0', '#CD7F32']
      : ['#F44336', '#FF5722', '#FF7043'];
    return (
      <div
        key={item.checkpoint_id}
        className="recommendation-item"
        style={{
          opacity: showResults ? 1 : 0,
          transform: showResults ? 'translateX(0)' : 'translateX(-20px)',
          transition: `all 0.3s ease ${index * 0.1}s`,
        }}
      >
        <div
          className="recommendation-rank"
          style={{ backgroundColor: rankColors[index] || '#999' }}
        >
          {index + 1}
        </div>
        <div className="recommendation-info">
          <div className="label">
            {item.checkpoint ? item.checkpoint.label : `CP-${item.checkpoint_id}`}
          </div>
          <div className="detail">
            {item.checkpoint ? item.checkpoint.zona : ''} &middot; Zona{' '}
            {item.zona}
          </div>
        </div>
        <div className="recommendation-rsrp" style={{ color }}>
          {item.rsrp} dBm
        </div>
        <span
          className="category-badge"
          style={{ backgroundColor: color, fontSize: '0.7rem', padding: '2px 8px' }}
        >
          {item.kategori}
        </span>
      </div>
    );
  };

  return (
    <div className="recommendation-panel">
      <h3>
        🎯 Rekomendasi Lokasi — {provider}
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 400,
            color: '#9e9e9e',
            marginLeft: '8px',
          }}
        >
          Lantai {floor}
        </span>
      </h3>

      {/* Best locations */}
      <div className="recommendation-section">
        <h4>
          <span style={{ color: '#4CAF50' }}>▲</span> Lokasi Terbaik
        </h4>
        {results.best.map((item, i) => renderItem(item, i, true))}
      </div>

      {/* Worst locations */}
      <div className="recommendation-section">
        <h4>
          <span style={{ color: '#F44336' }}>▼</span> Lokasi Terlemah
        </h4>
        {results.worst.map((item, i) => renderItem(item, i, false))}
      </div>

      {/* Recommendation text */}
      {recommendation && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '6px',
            background: '#e8f5e9',
            fontSize: '0.85rem',
            color: '#2e7d32',
            lineHeight: 1.5,
          }}
        >
          💡 Lokasi terbaik untuk <strong>{provider}</strong> di Lantai {floor}:
          <strong> {recommendation.checkpoint_id}</strong> ({recommendation.kategori}, {recommendation.rsrp} dBm, zona {recommendation.zona})
        </div>
      )}

      <button className="cari-btn" onClick={handleSearch}>
        🔍 Cari Lokasi Terbaik
      </button>
    </div>
  );
}
