// scripts/generate-dummy-index.js
// ============================================================================
// Jalankan: node scripts/generate-dummy-index.js
//
// Mendukung struktur folder berlapis:
//   public/dummy/
//   ├── Telkomsel_Lt1_Ruang1_K1.txt       ← file langsung di root dummy
//   ├── sesi1/
//   │   ├── Telkomsel_Lt1_Ruang1_K1.txt   ← nama sama, folder berbeda ✅
//   │   └── IM3_Lt1_Ruang1_K1.txt
//   └── sesi2/
//       └── Telkomsel_Lt1_Ruang1_K1.txt
//
// Setiap kali menambah file/folder baru, jalankan script ini lagi.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMMY_DIR = resolve(__dirname, '../public/dummy');
const OUTPUT    = resolve(__dirname, '../public/dummy/index.json');
const POINTS_CSV = resolve(DUMMY_DIR, 'daftar_titik_DUMMY.csv');

const POINT_CHECKPOINT_MAP = {
  Lt1_KelasKanan1_K1: 'F1-CP03',
  Lt1_KelasKanan1_K2: 'F1-CP04',
  Lt1_KelasKanan2_K1: 'F1-CP05',
  Lt1_KelasKanan2_K2: 'F1-CP21',
  Lt1_KelasKiri_K1: 'F1-CP06',
  Lt1_KelasKiri_K2: 'F1-CP07',
  Lt1_RL1_K1: 'F1-CP16',
  Lt1_RL1_K2: 'F1-CP23',
  Lt1_RL2_K1: 'F1-CP15',
  Lt1_RL2_K2: 'F1-CP22',
  Lt1_RL3_K1: 'F1-CP17',
  Lt1_RL3_K2: 'F1-CP24',
  Lt1_RL4_K1: 'F1-CP18',
  Lt1_RL4_K2: 'F1-CP25',
  Lt1_SeminarKiri_K1: 'F1-CP01',
  Lt1_SeminarKiri_K2: 'F1-CP02',
  Lt2_KelasKanan_K1: 'F2-CP03',
  Lt2_KelasKanan_K2: 'F2-CP04',
  Lt2_LabLT2_K1: 'F2-CP25',
  Lt2_LabLT2_K2: 'F2-CP26',
  Lt2_RuangDosen_K1: 'F2-CP14',
  Lt2_RuangDosen_K2: 'F2-CP22',
  Lt2_RuangHME_K1: 'F2-CP01',
  Lt2_RuangHME_K2: 'F2-CP02',
  Lt2_RuangKecil_K1: 'F2-CP15',
  Lt2_RuangKecil_K2: 'F2-CP16',
  Lt2_RuangLabLT2_K1: 'F2-CP17',
  Lt2_RuangLabLT2_K2: 'F2-CP23',
  Lt2_RuangLabLantai2_K1: 'F2-CP18',
  Lt2_RuangLabLantai2_K2: 'F2-CP24',
  Lt2_RuangOperator_K1: 'F2-CP06',
  Lt2_RuangOperator_K2: 'F2-CP07',
  Lt2_SeminarKanan_K1: 'F2-CP05',
  Lt2_SeminarKanan_K2: 'F2-CP21',
};

function parsePointCsv(csvText) {
  const [headerLine, ...lines] = csvText.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((value) => value.trim());
  const points = new Map();

  for (const line of lines) {
    if (!line.trim()) continue;
    const values = line.split(',').map((value) => value.trim());
    const row = Object.fromEntries(headers.map((key, index) => [key, values[index]]));
    points.set(row.titik, {
      floor: Number(row.lantai),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });
  }

  return points;
}

const pointCoordinates = parsePointCsv(readFileSync(POINTS_CSV, 'utf8'));

// ---------------------------------------------------------------------------
// Scan rekursif: kumpulkan semua .txt dari DUMMY_DIR dan semua subfoldernya
// ---------------------------------------------------------------------------
function scanDir(dir, baseDir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Folder data bisa berlapis, misalnya Hari/Jam.
      const sub = scanDir(fullPath, baseDir);
      results.push(...sub);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
      // Hitung relative path dari DUMMY_DIR
      const relPath = relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ fullPath, relPath, filename: entry.name });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Parse nama file → metadata
// ---------------------------------------------------------------------------
function parseMeta(filename) {
  const base  = filename.replace(/\.txt$/i, '');
  const parts = base.split('_');

  const providerMap = {
    'im3':       'Indosat Ooredoo',
    'indosat':   'Indosat Ooredoo',
    'ooredoo':   'Indosat Ooredoo',
    'telkomsel': 'Telkomsel',
    'xl':        'XL Axiata',
    'xlaxiata':  'XL Axiata',
    'smartfren': 'Smartfren',
  };

  let provider = null;
  let rest     = [];

  // Coba 2 kata dulu
  const two = parts.slice(0, 2).join('').toLowerCase();
  if (providerMap[two]) {
    provider = providerMap[two];
    rest     = parts.slice(2);
  } else {
    const one = parts[0].toLowerCase();
    provider  = providerMap[one] || parts[0];
    rest      = parts.slice(1);
  }

  // Lantai (Lt1, Lt2, ...)
  const ltPart   = rest.find((p) => /^Lt\d+$/i.test(p));
  const floor    = ltPart ? parseInt(ltPart.replace(/Lt/i, ''), 10) : null;

  // Ruang (Ruang1, Ruang2, ...)
  const ruangPart = rest.find((p) => /^Ruang\d+$/i.test(p));
  const ruang     = ruangPart ? parseInt(ruangPart.replace(/Ruang/i, ''), 10) : null;

  // Pengukuran (K1, K2, ...)
  const kPart      = rest.find((p) => /^K\d+$/i.test(p));
  const measurement = kPart ? parseInt(kPart.replace(/K/i, ''), 10) : 1;

  // BTS outdoor?
  const isBTS = rest.some((p) => /^BTS$/i.test(p));

  return { provider, floor, ruang, measurement, isBTS };
}

// ---------------------------------------------------------------------------
// Ambil nama folder (sesi) dari relative path
// ---------------------------------------------------------------------------
function getFolderName(relPath) {
  const parts = relPath.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const allFiles = scanDir(DUMMY_DIR, DUMMY_DIR).sort((a, b) =>
  a.relPath.localeCompare(b.relPath)
);

const index = allFiles.map(({ fullPath, relPath, filename }) => {
  const meta  = parseMeta(filename);
  const stats = statSync(fullPath);
  const folder = getFolderName(relPath);
  const base = filename.replace(/\.txt$/i, '');
  const pointKey = base.replace(/^(?:IM3|Indosat|Ooredoo|Telkomsel|XL(?:Axiata)?|Smartfren)_/i, '');
  const point = pointCoordinates.get(pointKey);
  const isReferenceOnly = pointKey === 'BTS_10m';
  const checkpointId = POINT_CHECKPOINT_MAP[pointKey];

  if (point && !isReferenceOnly && !checkpointId) {
    throw new Error(`Titik ${pointKey} belum memiliki checkpoint. Periksa POINT_CHECKPOINT_MAP.`);
  }

  return {
    filename,
    folder,                           // nama subfolder (atau "(root)")
    path: `/dummy/${relPath}`,        // URL untuk fetch
    rel_path: relPath,                // path relatif dari dummy/
    provider:    meta.provider,
    floor:       point ? point.floor : meta.floor,
    ruang:       meta.ruang,
    measurement: meta.measurement,
    is_bts:      meta.isBTS || isReferenceOnly,
    point_id:    point ? pointKey : undefined,
    checkpoint_id: checkpointId,
    latitude:    point ? point.latitude : undefined,
    longitude:   point ? point.longitude : undefined,
    reference_only: isReferenceOnly,
    size_bytes:  stats.size,
  };
});

writeFileSync(
  OUTPUT,
  JSON.stringify(
    { generated_at: new Date().toISOString(), count: index.length, files: index },
    null,
    2,
  ),
);

console.log(`✅ index.json dibuat: ${index.length} file`);
console.log('');

// Ringkasan per folder
const byFolder = {};
for (const f of index) {
  if (!byFolder[f.folder]) byFolder[f.folder] = { count: 0, providers: new Set() };
  byFolder[f.folder].count++;
  byFolder[f.folder].providers.add(f.provider);
}
console.log('📂 Ringkasan per folder:');
for (const [folder, info] of Object.entries(byFolder)) {
  console.log(`   ${folder}: ${info.count} file (${[...info.providers].join(', ')})`);
}

console.log('');

// Ringkasan per provider
const byProvider = {};
for (const f of index) {
  if (!byProvider[f.provider]) byProvider[f.provider] = 0;
  byProvider[f.provider]++;
}
console.log('📡 Ringkasan per provider:');
for (const [p, n] of Object.entries(byProvider)) {
  console.log(`   ${p}: ${n} file`);
}

console.log('');
console.log('📂 Cara tambah data baru:');
console.log('   1. Buat subfolder di public/dummy/ (misal: sesi2/)');
console.log('   2. Taruh file .txt di subfolder tersebut');
console.log('   3. Jalankan: npm run index-dummy');
console.log('   4. Reload browser → Muat Dummy Files');
