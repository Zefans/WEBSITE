import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { checkpoints } from '../data/checkpoints';
import { signalData } from '../data/signalData';
import { getAllSpeedTests } from '../data/db';
import { predictAnomaly } from '../utils/modelManager';
import { categoryToValue, valueToColor, categoryToColor, getProviderColor } from '../utils/colorScale';
import Legend from './Legend';
import './Components.css';

// ============================================================================
// DIMENSI GAMBAR ASLI
// lt1.png dan lt2.png: 1280 × 1267 px (JPEG, bukan PNG)
//
// DISPLAY canvas: 900 × 891 CSS px (mempertahankan rasio asli)
// SX = 1280/900 = 1.4222 | SY = 1267/891 = 1.4220
//
// Semua koordinat CP_PX ditulis dalam IMAGE PIXEL (0,0 = kiri-atas)
// Konversi ke display: cx = imgPx / SX, cy = imgPy / SY
// ============================================================================

const IMG_W = 1280;
const IMG_H = 1267;

// Canvas display size (CSS pixels)
const DISPLAY_W = 900;
const DISPLAY_H = Math.round(DISPLAY_W * (IMG_H / IMG_W)); // ≈ 891

// Scale factors: image pixel → display pixel
const SX = IMG_W / DISPLAY_W;   // ≈ 1.4222
const SY = IMG_H / DISPLAY_H;   // ≈ 1.4220

// ---------------------------------------------------------------------------
// Tabel koordinat checkpoint dalam IMAGE PIXEL (1280×1267)
//
// Cara baca: [x_img_px, y_img_px]
// x: 0=kiri, 1280=kanan
// y: 0=atas, 1267=bawah
//
// Titik checkpoint mengikuti posisi ruang dan akses yang tampak pada kedua
// gambar denah. Koordinat CP_PX di bawah memakai pixel gambar asli.
// ---------------------------------------------------------------------------
const CP_PX = {
  // Coordinates use the original 1280 x 1267 image pixels.
  // Floor 1 main rooms, corridor, entrances, stairs, and lab.
  'F1-CP01': [940, 520], 'F1-CP02': [940, 555],
  'F1-CP03': [365, 520], 'F1-CP04': [365, 555],
  'F1-CP05': [365, 660], 'F1-CP21': [405, 695],
  'F1-CP06': [940, 660], 'F1-CP07': [940, 700],
  'F1-CP12': [555, 525], 'F1-CP13': [725, 525],
  'F1-CP14': [645, 400], 'F1-CP20': [620, 720],
  'F1-CP15': [583, 1098], 'F1-CP16': [758, 1098],
  'F1-CP17': [583, 1180], 'F1-CP18': [758, 1180],
  'F1-CP19': [670, 1138],
  'F1-CP22': [610, 1120], 'F1-CP23': [785, 1120],
  'F1-CP24': [610, 1205], 'F1-CP25': [785, 1205],
  // Extra measured areas marked on the user's floor-plan image.
  'F1-CP26': [250, 180], 'F1-CP27': [320, 230],
  'F1-CP28': [960, 180], 'F1-CP29': [1025, 230],
  'F1-CP30': [150, 855], 'F1-CP31': [195, 885],
  'F1-CP32': [930, 860], 'F1-CP33': [1060, 880],
  'F1-CP34': [645, 850], 'F1-CP35': [645, 970],

  // Floor 2 main rooms, central hall, stairs, outdoor access, and lab.
  'F2-CP01': [752, 710], 'F2-CP02': [752, 728],
  'F2-CP03': [940, 660], 'F2-CP04': [940, 700],
  'F2-CP05': [940, 520], 'F2-CP21': [975, 555],
  'F2-CP06': [365, 520], 'F2-CP07': [365, 555],
  'F2-CP14': [365, 660], 'F2-CP22': [405, 695],
  'F2-CP15': [539, 710], 'F2-CP16': [539, 728],
  'F2-CP08': [520, 630], 'F2-CP09': [645, 650],
  'F2-CP10': [800, 630],
  'F2-CP20': [645, 720],
  'F2-CP17': [570, 1202], 'F2-CP23': [640, 1202],
  'F2-CP18': [740, 1202], 'F2-CP24': [790, 1202],
  'F2-CP19': [670, 1118],
};

// Keep blurred signal inside walkable parts of the floor plans.
const HEATMAP_CLIP_RECTS = {
  1: [
    [155, 373, 972, 56],
    [202, 434, 879, 373],
    [516, 1044, 308, 203],
    [204, 130, 154, 146], [925, 130, 154, 146],
    [126, 835, 96, 70], [877, 842, 248, 62], [630, 806, 56, 239],
  ],
  2: [
    [202, 433, 879, 333],
    [516, 1044, 308, 203],
  ],
};

// ---------------------------------------------------------------------------
// Color functions
// ---------------------------------------------------------------------------
function anomalyScoreToColor(score) {
  const v = Math.max(0, Math.min(1, score));
  if (v < 0.4) {
    const t = v / 0.4;
    return `rgba(${Math.round(33 + t * 43)}, ${Math.round(150 + t * 25)}, ${Math.round(243 - t * 163)}, 1)`;
  } else if (v < 0.6) {
    const t = (v - 0.4) / 0.2;
    return `rgba(${Math.round(76 + t * 179)}, ${Math.round(175 + t * 18)}, ${Math.round(80 - t * 73)}, 1)`;
  } else {
    const t = (v - 0.6) / 0.4;
    return `rgba(${Math.round(255 - t * 11)}, ${Math.round(193 - t * 126)}, ${Math.round(7 + t * 47)}, 1)`;
  }
}

function speedToColor(value, min, max, invert = false) {
  if (max === min) return 'rgba(128, 128, 128, 1)';
  let t = (value - min) / (max - min);
  if (invert) t = 1 - t;
  const r = Math.round(t < 0.5 ? 76 + (255 - 76) * (1 - t * 2) : 244 * (1 - (t - 0.5) * 2));
  const g = Math.round(t < 0.5 ? 175 : 175 - 108 * ((t - 0.5) * 2));
  const b = Math.round(t < 0.5 ? 80 - 73 * (1 - t * 2) : 54 * ((t - 0.5) * 2));
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

// ---------------------------------------------------------------------------
// Image cache
// ---------------------------------------------------------------------------
const imgCache = {};
function loadImage(src) {
  if (imgCache[src]) return Promise.resolve(imgCache[src]);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload  = () => { imgCache[src] = img; resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Heatmap blob builder — radial gradient per checkpoint
// ---------------------------------------------------------------------------
function buildHeatBlobs(dataPoints, colorFn) {
  return dataPoints.map(({ cpId, value }) => {
    const pxCoord = CP_PX[cpId];
    if (!pxCoord) return null;
    const [px, py] = pxCoord;
    return {
      x: px / SX,   // display px
      y: py / SY,
      r: 46,
      color: colorFn(value),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FloorPlan({
  floor = 1,
  provider = 'Telkomsel',
  onCheckpointClick,
  selectedCheckpoint,
  showHeatmap = true,
  heatmapMode = 'rsrp',
}) {
  const canvasRef = useRef(null);
  const [imgReady, setImgReady] = useState(false);

  const imgSrc = floor === 1 ? '/lt1.png' : '/lt2.png';

  // Preload image
  useEffect(() => {
    setImgReady(false);
    loadImage(imgSrc)
      .then(() => setImgReady(true))
      .catch(() => setImgReady(true));
  }, [imgSrc]);

  // ---- Filtered data ----
  const floorCheckpoints = useMemo(
    () => checkpoints.filter((cp) => cp.floor === floor),
    [floor],
  );

  const floorSignal = useMemo(
    () => signalData.filter((s) => s.floor === floor && s.provider === provider),
    [floor, provider],
  );

  // ---- Data points ----
  const dataPoints = useMemo(() => {
    if (heatmapMode === 'rsrp') {
      return floorSignal.map((s) => {
        if (!CP_PX[s.checkpoint_id]) return null;
        return { cpId: s.checkpoint_id, value: categoryToValue(s.kategori) };
      }).filter(Boolean);
    }

    if (heatmapMode === 'anomaly') {
      return floorSignal.map((s) => {
        if (!CP_PX[s.checkpoint_id]) return null;
        const result = predictAnomaly('IF_Network_Condition', s)
          || predictAnomaly('IF_Internet_Performance', s);
        if (!result) return null;
        return { cpId: s.checkpoint_id, value: result.score };
      }).filter(Boolean);
    }

    // Speed test metrics
    const speedTests = getAllSpeedTests().filter(
      (r) => (r.status === 'valid' || r.status === 'used_for_training')
        && r.floor === floor && r.provider === provider,
    );
    const byCheckpoint = {};
    for (const st of speedTests) {
      if (!byCheckpoint[st.checkpoint_id]) byCheckpoint[st.checkpoint_id] = [];
      byCheckpoint[st.checkpoint_id].push(st);
    }
    const pts = [];
    for (const [cpId, records] of Object.entries(byCheckpoint)) {
      if (!CP_PX[cpId]) continue;
      const values = records
        .map((r) => r[heatmapMode])
        .filter((v) => v != null && !Number.isNaN(v));
      if (!values.length) continue;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      pts.push({ cpId, value: avg });
    }
    return pts;
  }, [floorSignal, heatmapMode, floor, provider]);

  // Color resolver
  const colorResolver = useMemo(() => {
    if (heatmapMode === 'rsrp')    return (v) => valueToColor(v);
    if (heatmapMode === 'anomaly') return (v) => anomalyScoreToColor(v);
    const vals   = dataPoints.map((d) => d.value);
    const min    = vals.length ? Math.min(...vals) : 0;
    const max    = vals.length ? Math.max(...vals) : 1;
    const invert = ['ping', 'jitter', 'packet_loss'].includes(heatmapMode);
    return (v) => speedToColor(v, min, max, !invert);
  }, [heatmapMode, dataPoints]);

  // Heatmap blobs
  const heatBlobs = useMemo(() => {
    if (!showHeatmap || !dataPoints.length) return [];
    return buildHeatBlobs(dataPoints, colorResolver);
  }, [dataPoints, showHeatmap, colorResolver]);

  // ---- Drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width  = DISPLAY_W * dpr;
    canvas.height = DISPLAY_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);

    // ── 1. Floor plan image background ──
    const img = imgCache[imgSrc];
    if (img) {
      ctx.drawImage(img, 0, 0, DISPLAY_W, DISPLAY_H);
    } else {
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
      ctx.fillStyle = '#9e9e9e';
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Memuat denah...', DISPLAY_W / 2, DISPLAY_H / 2);
    }

    // ── 2. Heatmap radial blobs ──
    if (showHeatmap && heatBlobs.length > 0) {
      ctx.save();
      ctx.beginPath();
      for (const [x, y, width, height] of HEATMAP_CLIP_RECTS[floor] || []) {
        ctx.rect(x / SX, y / SY, width / SX, height / SY);
      }
      ctx.clip();

      for (const blob of heatBlobs) {
        const m = blob.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) continue;
        const [, r, g, b] = m;
        const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
        grad.addColorStop(0,   `rgba(${r},${g},${b},0.70)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.40)`);
        grad.addColorStop(1,   `rgba(${r},${g},${b},0.00)`);
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();
    }

    // ── 3. Checkpoint markers ──
    for (const cp of floorCheckpoints) {
      const pxCoord = CP_PX[cp.id];
      if (!pxCoord) continue;

      const [px, py] = pxCoord;
      const cx = px / SX;
      const cy = py / SY;

      const sig      = floorSignal.find((s) => s.checkpoint_id === cp.id);
      const catColor = sig ? categoryToColor(sig.kategori) : '#78909c';
      const isSelected = selectedCheckpoint && selectedCheckpoint.id === cp.id;

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(26,35,126,0.20)';
        ctx.fill();
        ctx.strokeStyle = '#1a237e';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
      }

      // Drop shadow
      ctx.shadowColor   = 'rgba(0,0,0,0.30)';
      ctx.shadowBlur    = 5;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Main circle
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle   = catColor;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Keep the map clear; show an ID only for the selected marker.
      if (isSelected) {
        const label = cp.id;
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        const labelWidth = ctx.measureText(label).width + 12;
        const labelX = Math.max(6, Math.min(DISPLAY_W - labelWidth - 6, cx - labelWidth / 2));
        const labelY = Math.max(38, cy - 28);
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ctx.beginPath();
        ctx.roundRect?.(labelX, labelY, labelWidth, 19, 5) || ctx.rect(labelX, labelY, labelWidth, 19);
        ctx.fill();
        ctx.fillStyle = '#263238';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelX + labelWidth / 2, labelY + 9.5);
      }
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;

    // ── 4. Mode label overlay ──
    const modeLabels = {
      rsrp: 'RSRP',
      anomaly: 'Anomaly Score',
      download: 'Download',
      upload: 'Upload',
      ping: 'Ping',
      jitter: 'Jitter',
      packet_loss: 'Packet Loss',
    };
    const floorLabel = floor === 1 ? 'Lantai 1' : 'Lantai 2';

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.roundRect?.(6, 6, 260, 26, 4) || ctx.fillRect(6, 6, 260, 26);
    ctx.fill();
    ctx.fillStyle = '#263238';
    ctx.font      = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${floorLabel} — ${provider} — ${modeLabels[heatmapMode] || ''}`, 12, 19);
  }, [
    floor, provider, floorCheckpoints, floorSignal,
    heatBlobs, showHeatmap, selectedCheckpoint, heatmapMode, imgSrc, imgReady,
  ]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { if (imgReady) draw(); }, [imgReady, draw]);

  // ---- Click handler ----
  const handleClick = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas || !onCheckpointClick) return;
      const rect   = canvas.getBoundingClientRect();
      const scaleX = DISPLAY_W / rect.width;
      const scaleY = DISPLAY_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top)  * scaleY;

      let closest = null;
      let minDist = 24;
      for (const cp of floorCheckpoints) {
        const pxCoord = CP_PX[cp.id];
        if (!pxCoord) continue;
        const [px, py] = pxCoord;
        const cx = px / SX;
        const cy = py / SY;
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        if (dist < minDist) {
          minDist = dist;
          closest = cp;
        }
      }
      if (closest) onCheckpointClick(closest);
    },
    [floorCheckpoints, onCheckpointClick],
  );

  return (
    <div className="floorplan-container">
      <div className="floorplan-canvas-wrapper">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{ cursor: 'pointer', maxWidth: '100%', height: 'auto', display: 'block' }}
        />
      </div>
    </div>
  );
}
