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

import { readdirSync, writeFileSync, statSync } from 'fs';
import { join, resolve, dirname, relative, posix } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMMY_DIR = resolve(__dirname, '../public/dummy');
const OUTPUT    = resolve(__dirname, '../public/dummy/index.json');

// ---------------------------------------------------------------------------
// Scan rekursif: kumpulkan semua .txt dari DUMMY_DIR dan semua subfoldernya
// ---------------------------------------------------------------------------
function scanDir(dir, baseDir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Masuk ke subfolder (rekursif, 1 level saja — tidak masuk nested lebih dalam)
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

  return {
    filename,
    folder,                           // nama subfolder (atau "(root)")
    path: `/dummy/${relPath}`,        // URL untuk fetch
    rel_path: relPath,                // path relatif dari dummy/
    provider:    meta.provider,
    floor:       meta.floor,
    ruang:       meta.ruang,
    measurement: meta.measurement,
    is_bts:      meta.isBTS,
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
