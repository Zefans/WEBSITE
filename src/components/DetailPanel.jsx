import React from 'react';
import { PROVIDERS } from '../data/signalData';
import { categoryToColor, getProviderColor } from '../utils/colorScale';
import { getSignalDescription } from '../utils/signalUtils';
import './Components.css';

function rsrpToPercent(rsrp) {
  const clamped = Math.max(-140, Math.min(-44, rsrp));
  return ((clamped + 140) / 96) * 100;
}

function getZoneIcon(zona) {
  if (zona === 'Indoor') return '🏢';
  if (zona === 'Semi-outdoor') return '🚪';
  return '🌳';
}

function scoreToColor(score) {
  // 0 = paling normal (biru), 1 = paling anomali (merah)
  if (score == null) return '#9e9e9e';
  const r = Math.round(Math.min(255, score * 2 * 255));
  const g = Math.round(Math.min(255, (1 - score) * 2 * 180));
  const b = Math.round(Math.max(0, (0.5 - score) * 2 * 255));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function DetailPanel({ checkpoint, signalData, prediction, anomalyResult, onClose }) {
  if (!checkpoint) return null;

  // signalData is the full array — filter for this checkpoint
  const cpSignals = Array.isArray(signalData)
    ? signalData.filter((s) => s.checkpoint_id === checkpoint.id)
    : [];

  // Build provider data map
  const providerDataMap = {};
  PROVIDERS.forEach((p) => {
    providerDataMap[p] = cpSignals.find((s) => s.provider === p) || null;
  });

  // Pick the first available provider data for the main display
  const mainData = cpSignals[0] || null;

  return (
    <div className="detail-panel">
      <button className="detail-panel-close" onClick={onClose}>
        ✕
      </button>

      {/* Header */}
      <h3>📍 {checkpoint.label}</h3>
      <div style={{ fontSize: '0.8rem', color: '#9e9e9e', marginBottom: '4px' }}>
        ID: {checkpoint.id} &nbsp;|&nbsp; Posisi: ({checkpoint.x}m, {checkpoint.y}m)
      </div>
      <span className="zone-badge">
        {getZoneIcon(checkpoint.zona)} {checkpoint.zona}
      </span>

      {/* Signal data for each provider */}
      {PROVIDERS.map((provider) => {
        const data = providerDataMap[provider];
        if (!data) return null;
        const color = categoryToColor(data.kategori);
        const providerColor = getProviderColor(provider);
        const percent = rsrpToPercent(data.rsrp);

        return (
          <div
            key={provider}
            style={{
              marginBottom: '14px',
              padding: '12px',
              borderRadius: '6px',
              background: '#f8f9fa',
              borderLeft: `3px solid ${providerColor}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: providerColor }}>
                {provider}
              </span>
              <span
                className="category-badge"
                style={{ backgroundColor: color }}
              >
                {data.kategori}
              </span>
            </div>

            <div className="signal-bar-container">
              <div className="signal-bar-label">
                <span>RSRP</span>
                <span style={{ fontWeight: 600 }}>{data.rsrp} dBm</span>
              </div>
              <div className="signal-bar-track">
                <div
                  className="signal-bar-fill"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                fontSize: '0.8rem',
                color: '#616161',
                marginTop: '4px',
              }}
            >
              RSRQ: {data.rsrq} dB
            </div>
          </div>
        );
      })}

      {/* ML Prediction */}
      {prediction && mainData && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '6px',
            background: '#e8eaf6',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#1a237e',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🤖 Prediksi Model ML
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.85rem',
            }}
          >
            <div>
              Prediksi:{' '}
              <span
                className="category-badge"
                style={{
                  backgroundColor: categoryToColor(prediction),
                  fontSize: '0.75rem',
                }}
              >
                {prediction}
              </span>
            </div>
            <span style={{ color: '#9e9e9e' }}>vs</span>
            <div>
              Aktual:{' '}
              <span
                className="category-badge"
                style={{
                  backgroundColor: categoryToColor(mainData.kategori),
                  fontSize: '0.75rem',
                }}
              >
                {mainData.kategori}
              </span>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '1rem' }}>
              {prediction === mainData.kategori ? '✅' : '❌'}
            </span>
          </div>
        </div>
      )}

      {/* Isolation Forest Analysis */}
      {anomalyResult && (anomalyResult.nc || anomalyResult.ip) && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '6px',
            background: '#fff3e0',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#e65100',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🔍 Analisis Isolation Forest
          </div>

          {anomalyResult.nc && (
            <IFResultRow
              label="IF Network Condition"
              result={anomalyResult.nc}
            />
          )}

          {anomalyResult.ip && (
            <IFResultRow
              label="IF Internet Performance"
              result={anomalyResult.ip}
            />
          )}

          {!anomalyResult.nc && !anomalyResult.ip && (
            <div style={{ fontSize: '0.8rem', color: '#9e9e9e' }}>
              Belum ada model aktif. Latih model di halaman Model Management.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IFResultRow({ label, result }) {
  if (!result) return null;
  const { score, is_anomaly, model_version } = result;

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '0.8rem', color: '#546e7a', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: is_anomaly ? '#ffcdd2' : '#c8e6c9',
            color: is_anomaly ? '#c62828' : '#2e7d32',
          }}
        >
          {is_anomaly ? '⚠️ Anomali' : '✅ Normal'}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#757575' }}>
          Score: <strong>{score?.toFixed(4)}</strong>
        </div>
      </div>
      <div style={{ fontSize: '0.7rem', color: '#bdbdbd', marginTop: '2px' }}>
        Model: {model_version}
      </div>
    </div>
  );
}
