// ============================================================================
// signalData.js — Realistic walk-test signal measurement data
// 3 providers × 40 checkpoints = 120 records
// ============================================================================

import { checkpoints } from './checkpoints.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const PROVIDERS = ['Telkomsel', 'XL Axiata', 'Indosat Ooredoo'];

export const CATEGORIES = {
  Excellent: { label: 'Excellent', color: '#2196F3', min: -80,  max: -44 },
  Good:      { label: 'Good',      color: '#4CAF50', min: -90,  max: -80 },
  Low:       { label: 'Low',       color: '#FFC107', min: -100, max: -90 },
  Bad:       { label: 'Bad',       color: '#F44336', min: -140, max: -100 },
};

// Base GPS coordinates (Universitas Nusa Cendana, Kupang)
const BASE_LAT = -10.1632;
const BASE_LON = 123.5987;
// Approximate metres-per-degree at this latitude
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((BASE_LAT * Math.PI) / 180);

// ---------------------------------------------------------------------------
// Deterministic seeded random (simple mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rsrpToCategory(rsrp) {
  if (rsrp >= -80)  return 'Excellent';
  if (rsrp >= -90)  return 'Good';
  if (rsrp >= -100) return 'Low';
  return 'Bad';
}

function correlatedRsrq(rsrp) {
  // RSRQ roughly tracks RSRP quality
  // Excellent → -3 to -7, Good → -7 to -11, Low → -11 to -15, Bad → -15 to -20
  const base = ((rsrp + 44) / (-140 + 44)) * (-20 + 3) - 3; // linear map
  const jitter = (rand() - 0.5) * 2;
  return Math.round(Math.max(-20, Math.min(-3, base + jitter)) * 10) / 10;
}

function cpToLatLon(x, y) {
  return {
    latitude:  Math.round((BASE_LAT + y / M_PER_DEG_LAT) * 1e6) / 1e6,
    longitude: Math.round((BASE_LON + x / M_PER_DEG_LON) * 1e6) / 1e6,
  };
}

/**
 * Generate a realistic RSRP value for a given context.
 * Returns dBm value.
 */
function generateRsrp(provider, zona, floor) {
  // Base mean RSRP per provider (Telkomsel best, Indosat worst)
  const providerBase = {
    Telkomsel:         -74,
    'XL Axiata':       -86,
    'Indosat Ooredoo': -93,
  };

  let mean = providerBase[provider];

  // Zone adjustments
  if (zona === 'Indoor')        mean -= 8;
  if (zona === 'Semi-outdoor')  mean -= 2;
  // Outdoor: no extra penalty

  // Floor adjustment (Floor 2 slightly better)
  if (floor === 2) mean += 3;

  // Random spread ±8 dBm (Gaussian-ish via Box-Muller-lite)
  const u1 = rand();
  const u2 = rand();
  const gauss = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  const rsrp = Math.round(mean + gauss * 6);

  return Math.max(-140, Math.min(-44, rsrp));
}

// ---------------------------------------------------------------------------
// Build the measurement data
// ---------------------------------------------------------------------------
const data = [];

for (const cp of checkpoints) {
  for (const provider of PROVIDERS) {
    const rsrp = generateRsrp(provider, cp.zona, cp.floor);
    const rsrq = correlatedRsrq(rsrp);
    const kategori = rsrpToCategory(rsrp);
    const { latitude, longitude } = cpToLatLon(cp.x, cp.y);

    data.push({
      checkpoint_id: cp.id,
      provider,
      floor:     cp.floor,
      zona:      cp.zona,
      rsrp,
      rsrq,
      kategori,
      latitude,
      longitude,
    });
  }
}

export const signalData = data;
