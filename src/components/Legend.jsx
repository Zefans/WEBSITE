import React from 'react';

const RSRP_CATEGORIES = [
  { label: 'Excellent (≥ -80 dBm)', color: '#2196F3' },
  { label: 'Good (-90 to -80 dBm)', color: '#4CAF50' },
  { label: 'Low (-100 to -90 dBm)', color: '#FFC107' },
  { label: 'Bad (< -100 dBm)', color: '#F44336' },
];

const ANOMALY_LEGEND = [
  { label: 'Normal (score rendah)', color: '#2196F3' },
  { label: 'Mencurigakan', color: '#FFC107' },
  { label: 'Anomali (score tinggi)', color: '#F44336' },
];

const SPEED_GOOD_BAD = [
  { label: 'Baik', color: '#4CAF50' },
  { label: 'Sedang', color: '#FFC107' },
  { label: 'Buruk', color: '#F44336' },
];

const MODE_LABELS = {
  rsrp: 'Kualitas Sinyal (RSRP)',
  anomaly: 'Anomaly Score (Isolation Forest)',
  download: 'Download Speed (Mbps)',
  upload: 'Upload Speed (Mbps)',
  ping: 'Ping / Latensi (ms)',
  jitter: 'Jitter (ms)',
  packet_loss: 'Packet Loss (%)',
};

export default function Legend({ direction = 'horizontal', showLabel = true, heatmapMode = 'rsrp' }) {
  const isVertical = direction === 'vertical';

  let items;
  let title;

  if (heatmapMode === 'rsrp') {
    items = RSRP_CATEGORIES;
    title = 'Kualitas:';
  } else if (heatmapMode === 'anomaly') {
    items = ANOMALY_LEGEND;
    title = 'Anomali:';
  } else {
    // ping, jitter, packet_loss: rendah = baik; download, upload: tinggi = baik
    const invert = ['ping', 'jitter', 'packet_loss'].includes(heatmapMode);
    items = invert
      ? [...SPEED_GOOD_BAD].reverse()
      : SPEED_GOOD_BAD;
    title = MODE_LABELS[heatmapMode] || 'Performa:';
  }

  const containerStyle = {
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    alignItems: isVertical ? 'flex-start' : 'center',
    gap: isVertical ? '8px' : '16px',
    flexWrap: 'wrap',
    padding: '8px 0',
  };

  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: '#616161',
  };

  const dotStyle = (color) => ({
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    backgroundColor: color,
    flexShrink: 0,
  });

  return (
    <div style={containerStyle}>
      {showLabel && (
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9e9e9e', marginRight: '4px' }}>
          {title}
        </span>
      )}
      {items.map((cat) => (
        <div key={cat.label} style={itemStyle}>
          <div style={dotStyle(cat.color)} />
          <span>{cat.label}</span>
        </div>
      ))}
    </div>
  );
}
