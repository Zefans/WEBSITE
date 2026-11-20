// ============================================================================
// dummyDataSeeder.js — Seeder data walk test dari file DUMMY_pengujian_sinyal
// Mengonversi nama file + data tab-separated → walk test records
// ============================================================================

import { checkpoints } from './checkpoints.js';
import { PROVIDERS } from './signalData.js';

// ---------------------------------------------------------------------------
// Mapping nama file → checkpoint_id berdasarkan ruang dan lantai
// ---------------------------------------------------------------------------

// Ruang → list checkpoint ID yang ada di ruang tersebut
const ROOM_CHECKPOINT_MAP = {
  // Floor 1
  'Lt1_RuangDosen':         ['F1-CP01', 'F1-CP02'],
  'Lt1_RuangTU':            ['F1-CP14'],
  'Lt1_LabTelekomunikasi':  ['F1-CP03', 'F1-CP04'],
  'Lt1_LabKomputer':        ['F1-CP05'],
  'Lt1_LabElektronika':     ['F1-CP15', 'F1-CP16'],
  'Lt1_RuangKuliah1':       ['F1-CP06', 'F1-CP07'],
  'Lt1_RuangKuliah2':       ['F1-CP17'],
  'Lt1_RuangKuliah3':       ['F1-CP18', 'F1-CP19'],
  'Lt1_Koridor':            ['F1-CP20'],
  'Lt1_Outdoor':            ['F1-CP12', 'F1-CP13'],
  // Floor 2
  'Lt2_LabMicroprocessor':  ['F2-CP01', 'F2-CP02'],
  'Lt2_LabJaringan':        ['F2-CP03', 'F2-CP04'],
  'Lt2_RuangSeminar':       ['F2-CP05'],
  'Lt2_RuangKuliah4':       ['F2-CP06', 'F2-CP07'],
  'Lt2_LabListrik':         ['F2-CP14'],
  'Lt2_LabKendali':         ['F2-CP15', 'F2-CP16'],
  'Lt2_RuangKuliah5':       ['F2-CP17'],
  'Lt2_RuangKuliah6':       ['F2-CP18', 'F2-CP19'],
  'Lt2_Koridor':            ['F2-CP08', 'F2-CP09', 'F2-CP10', 'F2-CP20'],
};

// ---------------------------------------------------------------------------
// Normalize provider names dari nama file DUMMY
// ---------------------------------------------------------------------------
function normalizeProvider(raw) {
  const r = raw.toLowerCase().replace(/[-_\s]/g, '');
  if (r.includes('telkomsel')) return 'Telkomsel';
  if (r.includes('xl') || r.includes('xlaxiata')) return 'XL Axiata';
  if (r.includes('indosat') || r.includes('ooredoo')) return 'Indosat Ooredoo';
  return null; // Smartfren dan lain-lain diabaikan
}

// ---------------------------------------------------------------------------
// Parse nama file untuk ekstrak metadata
// Contoh format:
//   Telkomsel_BTS_10m.txt
//   Indosat_Ooredoo_Lt1_RuangDosen_K1.txt
//   XL_Axiata_Lt2_LabJaringan_K3.txt
// ---------------------------------------------------------------------------
function parseFilename(filename) {
  // Hapus ekstensi
  const base = filename.replace(/\.txt$/i, '');
  const parts = base.split('_');

  // Deteksi provider (bisa 1-2 kata di awal)
  let providerRaw = '';
  let rest = [...parts];

  // Coba 2 kata dulu
  const twoWords = parts.slice(0, 2).join('_');
  if (normalizeProvider(twoWords)) {
    providerRaw = twoWords;
    rest = parts.slice(2);
  } else {
    providerRaw = parts[0];
    rest = parts.slice(1);
  }

  const provider = normalizeProvider(providerRaw);
  if (!provider) return null; // Skip provider tidak dikenal (Smartfren, dll)

  // Cari lantai
  const ltPart = rest.find((p) => p.match(/^Lt\d+$/i));
  const floor = ltPart ? parseInt(ltPart.replace(/Lt/i, ''), 10) : null;

  // Cari room name: gabung bagian setelah lantai, sebelum K\d
  const ltIdx = ltPart ? rest.indexOf(ltPart) : -1;
  const kIdx = rest.findIndex((p) => p.match(/^K\d+$/i));
  const roomParts = ltPart
    ? rest.slice(ltIdx + 1, kIdx >= 0 ? kIdx : undefined)
    : [];
  const roomName = roomParts.join('');

  // Measurement number
  const kPart = rest.find((p) => p.match(/^K\d+$/i));
  const measurement = kPart ? parseInt(kPart.replace(/K/i, ''), 10) : 1;

  // Apakah BTS outdoor?
  const isBTS = rest.some((p) => p.match(/^BTS$/i));

  // Buat room key untuk lookup checkpoint
  let roomKey = null;
  if (floor && roomName) {
    roomKey = `Lt${floor}_${roomName}`;
  } else if (isBTS) {
    roomKey = 'Lt1_Outdoor'; // BTS biasanya outdoor
  }

  return { provider, floor: floor || 1, roomName, roomKey, measurement, isBTS };
}

// ---------------------------------------------------------------------------
// Statistik sederhana: median dari array angka
// ---------------------------------------------------------------------------
function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Parse isi file tab-separated
// Format kolom: Timestamp, Longitude, Latitude, Operatorname, NetworkTech, Level, LTERSSi, Filemark
// ---------------------------------------------------------------------------
function parseFileContent(content) {
  const rows = content.split('\n').filter((line) => line.trim());
  const records = [];

  for (const line of rows) {
    const cols = line.split('\t');
    if (cols.length < 7) continue;

    const [timestamp, lon, lat, opname, nettech, level, ltrssi] = cols;

    const rsrp = parseFloat(level);
    const rssi = parseFloat(ltrssi);

    // Skip baris header atau nilai non-numerik
    if (Number.isNaN(rsrp) || Number.isNaN(rssi)) continue;

    records.push({
      timestamp: timestamp?.trim() || '',
      longitude:  parseFloat(lon),
      latitude:   parseFloat(lat),
      operator:   opname?.trim() || '',
      network:    nettech?.trim() || '',
      rsrp,
      rssi,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Ambil checkpoint berdasarkan room key (round-robin berdasarkan measurement)
// ---------------------------------------------------------------------------
function getCheckpointForRoom(roomKey, measurement) {
  const cpIds = ROOM_CHECKPOINT_MAP[roomKey];
  if (!cpIds || !cpIds.length) {
    // Fallback: cari berdasarkan lantai
    return null;
  }
  const idx = (measurement - 1) % cpIds.length;
  const cpId = cpIds[idx];
  return checkpoints.find((cp) => cp.id === cpId) || null;
}

// ---------------------------------------------------------------------------
// Proses satu entri file dummy (simulasi — tanpa FS browser)
// Gunakan data signalData.js sebagai "file content" simulasi
// ---------------------------------------------------------------------------

/**
 * Seed data walk test dari DUMMY files.
 * Karena browser tidak bisa baca file system langsung,
 * fungsi ini membuat seed dari data yang sudah ada di signalData.js
 * dan menambahkan variasi realistis.
 *
 * Untuk integrasi nyata dengan file .txt, gunakan import manual
 * atau Node.js script preprocessing.
 *
 * @param {Array} signalData — data dari signalData.js
 * @returns {Array} walk test records
 */
export function seedWalkTestFromSignalData(signalData) {
  return signalData.map((sd) => {
    const cp = checkpoints.find((c) => c.id === sd.checkpoint_id);
    return {
      source:        'walk_test',
      checkpoint_id: sd.checkpoint_id,
      provider:      sd.provider,
      floor:         sd.floor,
      zona:          sd.zona,
      latitude:      sd.latitude,
      longitude:     sd.longitude,
      rsrp:          sd.rsrp,
      rsrq:          sd.rsrq,
      rssi:          null, // tidak ada di signalData standar
      // Speed test metrics tidak ada di walk test
      download:      null,
      upload:        null,
      ping:          null,
      jitter:        null,
      packet_loss:   null,
    };
  });
}

// ---------------------------------------------------------------------------
// Proses konten file DUMMY (untuk dipakai jika file diupload manual)
// ---------------------------------------------------------------------------

/**
 * Proses satu file DUMMY menjadi walk test record.
 * @param {string} filename — nama file, misal "Telkomsel_Lt1_RuangDosen_K1.txt"
 * @param {string} content  — isi file sebagai string
 * @returns {Object|null}   walk test record atau null jika tidak valid
 */
export function processDummyFile(filename, content) {
  const meta = parseFilename(filename);
  if (!meta) return null;

  const rows = parseFileContent(content);
  if (!rows.length) return null;

  // Ambil median RSRP dan RSSI
  const rsrpValues = rows.map((r) => r.rsrp).filter((v) => !Number.isNaN(v) && v > -200);
  const rssiValues = rows.map((r) => r.rssi).filter((v) => !Number.isNaN(v) && v > -200);

  if (!rsrpValues.length) return null;

  const medRsrp = median(rsrpValues);
  const medRssi = median(rssiValues);

  // Cari checkpoint
  const cp = getCheckpointForRoom(meta.roomKey, meta.measurement);
  if (!cp) return null;

  // Ambil koordinat rata-rata GPS dari file
  const lats = rows.map((r) => r.latitude).filter((v) => !Number.isNaN(v) && v !== 0);
  const lons = rows.map((r) => r.longitude).filter((v) => !Number.isNaN(v) && v !== 0);
  const latitude  = lats.length ? median(lats) : cp.latitude;
  const longitude = lons.length ? median(lons) : cp.longitude;

  // Hitung RSRQ dari RSRP jika tidak ada data terpisah
  // RSRQ ≈ RSRP - RSSI - 10*log10(N_RB), perkiraan kasar
  // Gunakan approximasi sederhana berdasarkan RSRP saja
  const rsrq = estimateRsrq(medRsrp);

  return {
    source:        'walk_test_dummy',
    filename,
    checkpoint_id: cp.id,
    provider:      meta.provider,
    floor:         meta.floor,
    zona:          cp.zona,
    latitude,
    longitude,
    rsrp:          Math.round(medRsrp * 10) / 10,
    rsrq:          rsrq,
    rssi:          medRssi !== null ? Math.round(medRssi * 10) / 10 : null,
    measurement:   meta.measurement,
    n_samples:     rows.length,
    timestamp:     rows[0]?.timestamp || new Date().toISOString(),
    // Speed metrics tidak ada di walk test
    download:      null,
    upload:        null,
    ping:          null,
    jitter:        null,
    packet_loss:   null,
  };
}

// ---------------------------------------------------------------------------
// Estimasi RSRQ dari RSRP (perkiraan berbasis kategori)
// ---------------------------------------------------------------------------
function estimateRsrq(rsrp) {
  if (rsrp >= -80)  return Math.round((-3  + (Math.random() - 0.5) * 2) * 10) / 10;
  if (rsrp >= -90)  return Math.round((-8  + (Math.random() - 0.5) * 3) * 10) / 10;
  if (rsrp >= -100) return Math.round((-13 + (Math.random() - 0.5) * 3) * 10) / 10;
  return Math.round((-17 + (Math.random() - 0.5) * 3) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Daftar file DUMMY yang diketahui (untuk referensi UI)
// ---------------------------------------------------------------------------
export const DUMMY_FILE_LIST = [
  // Telkomsel
  'Telkomsel_BTS_10m.txt',
  'Telkomsel_Lt1_RuangDosen_K1.txt',
  'Telkomsel_Lt1_LabTelekomunikasi_K1.txt',
  'Telkomsel_Lt1_LabKomputer_K1.txt',
  'Telkomsel_Lt1_RuangKuliah1_K1.txt',
  'Telkomsel_Lt1_Koridor_K1.txt',
  'Telkomsel_Lt2_LabMicroprocessor_K1.txt',
  'Telkomsel_Lt2_LabJaringan_K1.txt',
  'Telkomsel_Lt2_RuangSeminar_K1.txt',
  'Telkomsel_Lt2_RuangKuliah4_K1.txt',
  'Telkomsel_Lt2_Koridor_K1.txt',
  // XL Axiata
  'XL_Axiata_BTS_10m.txt',
  'XL_Axiata_Lt1_RuangDosen_K1.txt',
  'XL_Axiata_Lt1_LabTelekomunikasi_K1.txt',
  'XL_Axiata_Lt1_LabKomputer_K1.txt',
  'XL_Axiata_Lt2_LabMicroprocessor_K1.txt',
  'XL_Axiata_Lt2_LabJaringan_K1.txt',
  // Indosat Ooredoo
  'Indosat_Ooredoo_BTS_10m.txt',
  'Indosat_Ooredoo_Lt1_RuangDosen_K1.txt',
  'Indosat_Ooredoo_Lt1_LabTelekomunikasi_K1.txt',
  'Indosat_Ooredoo_Lt2_LabMicroprocessor_K1.txt',
];
