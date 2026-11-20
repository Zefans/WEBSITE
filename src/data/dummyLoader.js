// ============================================================================
// dummyLoader.js — Muat dan proses file walk test dari public/dummy/
//
// Cara kerja:
//   1. Fetch /dummy/index.json  → daftar semua file yang tersedia
//   2. Fetch tiap file .txt     → parse tab-separated data
//   3. Hitung median RSRP + RSRSI per file
//   4. Petakan ke checkpoint_id berdasarkan lantai + ruang
//   5. Return array walk test records
//
// Menambah file baru:
//   1. Taruh file .txt di public/dummy/
//   2. Jalankan: npm run index-dummy
//   3. Reload aplikasi — file baru langsung terbaca
// ============================================================================

import { checkpoints } from './checkpoints.js';

// ---------------------------------------------------------------------------
// Mapping Ruang → Checkpoint ID
// Ruang1..4 (Lt1), Ruang1..6 (Lt2) + BTS (Outdoor)
// ---------------------------------------------------------------------------
const RUANG_CP_MAP = {
  // ── Lantai 1 ──
  '1-1': ['F1-CP01', 'F1-CP02'],  // Ruang 1 (Ruang Dosen)
  '1-2': ['F1-CP03', 'F1-CP04'],  // Ruang 2 (Lab Telekomunikasi)
  '1-3': ['F1-CP05', 'F1-CP21'],  // Ruang 3 — K1 dan K2
  '1-4': ['F1-CP06', 'F1-CP07'],  // Ruang 4 (Ruang Kuliah 1)
  '1-corridor': ['F1-CP20'],
  '1-outdoor':  ['F1-CP12', 'F1-CP13'],

  // ── Lantai 2 ──
  '2-1': ['F2-CP01', 'F2-CP02'],  // Ruang 1 (Lab Microprocessor)
  '2-2': ['F2-CP03', 'F2-CP04'],  // Ruang 2 (Lab Jaringan)
  '2-3': ['F2-CP05', 'F2-CP21'],  // Ruang 3 — K1 dan K2
  '2-4': ['F2-CP06', 'F2-CP07'],  // Ruang 4 (Ruang Kuliah 4)
  '2-5': ['F2-CP14', 'F2-CP22'],  // Ruang 5 — K1 dan K2
  '2-6': ['F2-CP15', 'F2-CP16'],  // Ruang 6 (Lab Kendali)
  '2-corridor': ['F2-CP08', 'F2-CP09', 'F2-CP10', 'F2-CP20'],
};

// ---------------------------------------------------------------------------
// Provider name normalization
// ---------------------------------------------------------------------------
function normalizeProvider(raw) {
  const r = (raw || '').toLowerCase().replace(/[-_\s]/g, '');
  if (r.includes('telkomsel'))          return 'Telkomsel';
  if (r.includes('xl') || r.includes('xlaxiata')) return 'XL Axiata';
  if (r.includes('im3') || r.includes('indosat') || r.includes('ooredoo')) return 'Indosat Ooredoo';
  if (r.includes('smartfren'))          return 'Smartfren';
  return raw; // kembalikan apa adanya
}

// ---------------------------------------------------------------------------
// Statistik: median
// ---------------------------------------------------------------------------
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------------------------------------------------------
// Parse isi file tab-separated
// Header: Timestamp  Longitude  Latitude  Operatorname  NetworkTech  Level  LTERSSi  Filemark
// ---------------------------------------------------------------------------
function parseFileContent(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const records = [];

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 7) continue;

    const [timestamp, lon, lat, opname, nettech, level, ltrssi] = cols;
    const rsrp = parseFloat(level);
    const rssi = parseFloat(ltrssi);

    // Skip header atau non-numerik
    if (Number.isNaN(rsrp) || Number.isNaN(rssi)) continue;

    records.push({
      timestamp: timestamp?.trim() || '',
      longitude: parseFloat(lon),
      latitude:  parseFloat(lat),
      operator:  opname?.trim() || '',
      network:   nettech?.trim() || '',
      rsrp,
      rssi,
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Ambil checkpoint ID dari ruang + lantai + measurement
// ---------------------------------------------------------------------------
function getCheckpointId(floor, ruang, isBTS, measurement) {
  let key;
  if (isBTS) {
    key = `${floor || 1}-outdoor`;
  } else if (ruang) {
    key = `${floor}-${ruang}`;
  } else {
    key = `${floor}-corridor`;
  }

  const cpIds = RUANG_CP_MAP[key] || RUANG_CP_MAP[`${floor || 1}-outdoor`] || ['F1-CP12'];
  const idx = ((measurement || 1) - 1) % cpIds.length;
  return cpIds[idx];
}

// ---------------------------------------------------------------------------
// Estimasi RSRQ dari RSRP
// ---------------------------------------------------------------------------
function estimateRsrq(rsrp) {
  if (rsrp >= -80)  return Math.round((-4  + (Math.random() - 0.5) * 2) * 10) / 10;
  if (rsrp >= -90)  return Math.round((-9  + (Math.random() - 0.5) * 3) * 10) / 10;
  if (rsrp >= -100) return Math.round((-13 + (Math.random() - 0.5) * 3) * 10) / 10;
  return Math.round((-17 + (Math.random() - 0.5) * 3) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Proses satu entri index → walk test record
// ---------------------------------------------------------------------------
async function processEntry(entry) {
  try {
    const res = await fetch(entry.path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const rows = parseFileContent(text);
    if (!rows.length) return null;

    // Median RSRP + RSSI
    const rsrpValues = rows.map((r) => r.rsrp).filter((v) => v > -200 && v < 0);
    const rssiValues = rows.map((r) => r.rssi).filter((v) => v > -200 && v < 0);
    if (!rsrpValues.length) return null;

    const medRsrp = median(rsrpValues);
    const medRssi = rssiValues.length ? median(rssiValues) : null;

    // Checkpoint
    const cpId = entry.checkpoint_id || (entry.reference_only ? null : getCheckpointId(
      entry.floor,
      entry.ruang,
      entry.is_bts,
      entry.measurement,
    ));
    const cp = cpId ? checkpoints.find((c) => c.id === cpId) : null;
    if (!cp && !entry.reference_only) return null;

    // Koordinat GPS dari file (median), fallback ke checkpoint
    const lats = rows.map((r) => r.latitude).filter((v) => !Number.isNaN(v) && v !== 0);
    const lons = rows.map((r) => r.longitude).filter((v) => !Number.isNaN(v) && v !== 0);

    const provider = normalizeProvider(entry.provider);
    const rsrq = estimateRsrq(medRsrp);

    return {
      source:        'walk_test_dummy',
      filename:      entry.filename,
      dataset_path:  entry.rel_path || entry.path,
      point_id:      entry.point_id || null,
      checkpoint_id: cp?.id || null,
      reference_only: Boolean(entry.reference_only),
      provider,
      floor:         entry.floor ?? cp?.floor ?? null,
      zona:          cp?.zona || (entry.reference_only ? 'Outdoor' : null),
      latitude:      lats.length ? median(lats) : null,
      longitude:     lons.length ? median(lons) : null,
      rsrp:          Math.round(medRsrp * 10) / 10,
      rsrq,
      rssi:          medRssi !== null ? Math.round(medRssi * 10) / 10 : null,
      n_samples:     rows.length,
      timestamp:     rows[0]?.timestamp || new Date().toISOString(),
      // Speed metrics tidak ada di walk test
      download:      null,
      upload:        null,
      ping:          null,
      jitter:        null,
      packet_loss:   null,
    };
  } catch (err) {
    console.warn(`[dummyLoader] Gagal proses ${entry.filename}:`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// API Publik
// ---------------------------------------------------------------------------

/**
 * Muat index.json dan kembalikan daftar file yang tersedia.
 * @returns {Promise<Array>} daftar entri dari index.json
 */
export async function loadDummyIndex() {
  const res = await fetch('/dummy/index.json');
  if (!res.ok) throw new Error('Gagal memuat /dummy/index.json');
  const data = await res.json();
  return data.files || [];
}

/**
 * Muat dan proses SEMUA file dummy → array walk test records.
 * Hanya provider yang dikenal (Telkomsel, XL Axiata, Indosat Ooredoo) yang diproses.
 * Smartfren dan lainnya diabaikan oleh default, atau sertakan via `includeAll`.
 *
 * @param {Object} options
 * @param {boolean} [options.includeAll=false]   — sertakan semua provider
 * @param {string[]} [options.providers]          — filter provider tertentu saja
 * @param {Function} [options.onProgress]         — callback(loaded, total, filename)
 * @returns {Promise<Array>} walk test records yang valid
 */
export async function loadAllDummyFiles({ includeAll = false, providers = null, includeReference = false, onProgress } = {}) {
  const KNOWN = ['Telkomsel', 'XL Axiata', 'Indosat Ooredoo'];

  let entries;
  try {
    entries = await loadDummyIndex();
  } catch (err) {
    console.error('[dummyLoader] Tidak bisa muat index:', err.message);
    return [];
  }

  // Filter provider
  if (providers && providers.length) {
    entries = entries.filter((e) => providers.includes(normalizeProvider(e.provider)));
  } else if (!includeAll) {
    entries = entries.filter((e) => KNOWN.includes(normalizeProvider(e.provider)));
  }

  if (!includeReference) {
    entries = entries.filter((e) => !e.reference_only);
  }

  const results = [];
  const batchSize = 12;
  for (let start = 0; start < entries.length; start += batchSize) {
    const batch = entries.slice(start, start + batchSize);
    const loaded = await Promise.all(batch.map(async (entry, offset) => {
      const index = start + offset;
      if (onProgress) onProgress(index + 1, entries.length, entry.filename);
      return processEntry(entry);
    }));
    results.push(...loaded.filter(Boolean));
  }

  return results;
}

/**
 * Muat satu file dummy berdasarkan nama file.
 * @param {string} filename — misal "Telkomsel_Lt1_Ruang1_K1.txt"
 * @returns {Promise<Object|null>} walk test record atau null
 */
export async function loadSingleDummyFile(filename) {
  const entries = await loadDummyIndex();
  const entry = entries.find((e) => e.filename === filename);
  if (!entry) return null;
  return processEntry(entry);
}

