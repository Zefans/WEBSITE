import React, { useMemo } from 'react';
import FloorPlan from './FloorPlan';
import { PROVIDERS, signalData } from '../data/signalData';
import { getProviderColor, categoryToColor } from '../utils/colorScale';
import { getFloorStats } from '../utils/signalUtils';
import './Components.css';

export default function ComparisonView({ floor = 1 }) {
  const stats = useMemo(() => {
    return PROVIDERS.map((provider) => {
      const s = getFloorStats(signalData, floor, provider);
      return { provider, ...s };
    });
  }, [floor]);

  return (
    <div className="comparison-container">
      {/* 3 mini floor plans side by side */}
      <div className="comparison-grid">
        {PROVIDERS.map((provider) => {
          const color = getProviderColor(provider);
          return (
            <div key={provider} className="comparison-card">
              <div
                className="comparison-card-header"
                style={{ background: color }}
              >
                {provider}
              </div>
              <div className="comparison-card-body">
                <div style={{ transform: 'scale(0.95)', transformOrigin: 'top left' }}>
                  <FloorPlan
                    floor={floor}
                    provider={provider}
                    showHeatmap={true}
                    onCheckpointClick={() => {}}
                    selectedCheckpoint={null}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary table */}
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Rata-rata RSRP</th>
            <th>Rata-rata RSRQ</th>
            <th style={{ color: '#90CAF9' }}>Excellent</th>
            <th style={{ color: '#A5D6A7' }}>Good</th>
            <th style={{ color: '#FFE082' }}>Low</th>
            <th style={{ color: '#EF9A9A' }}>Bad</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(({ provider, avgRsrp, avgRsrq, counts, percentages, total }) => (
            <tr key={provider}>
              <td>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: getProviderColor(provider),
                      flexShrink: 0,
                    }}
                  />
                  <strong>{provider}</strong>
                </span>
              </td>
              <td>{avgRsrp != null ? `${avgRsrp} dBm` : '—'}</td>
              <td>{avgRsrq != null ? `${avgRsrq} dB` : '—'}</td>
              <td>
                <span className="category-badge" style={{ backgroundColor: '#2196F3', fontSize: '0.75rem' }}>
                  {counts.Excellent} ({percentages.Excellent}%)
                </span>
              </td>
              <td>
                <span className="category-badge" style={{ backgroundColor: '#4CAF50', fontSize: '0.75rem' }}>
                  {counts.Good} ({percentages.Good}%)
                </span>
              </td>
              <td>
                <span className="category-badge" style={{ backgroundColor: '#FFC107', color: '#333', fontSize: '0.75rem' }}>
                  {counts.Low} ({percentages.Low}%)
                </span>
              </td>
              <td>
                <span className="category-badge" style={{ backgroundColor: '#F44336', fontSize: '0.75rem' }}>
                  {counts.Bad} ({percentages.Bad}%)
                </span>
              </td>
              <td>{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
