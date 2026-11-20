// ============================================================================
// db.js — Lightweight localStorage-based database for SignalMap
// Menyimpan: speed test results, walk test aggregates, model metadata, training history
// ============================================================================

const KEYS = {
  SPEED_TESTS:      'signalmap_speed_tests',
  MODEL_REGISTRY:   'signalmap_model_registry',
  TRAINING_HISTORY: 'signalmap_training_history',
  DB_VERSION:       'signalmap_db_version',
  CONSENT:          'signalmap_data_consent',
};

const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function initDB() {
  if (!localStorage.getItem(KEYS.DB_VERSION)) {
    localStorage.setItem(KEYS.DB_VERSION, String(CURRENT_VERSION));
    localStorage.setItem(KEYS.SPEED_TESTS, JSON.stringify([]));
    localStorage.setItem(KEYS.MODEL_REGISTRY, JSON.stringify({}));
    localStorage.setItem(KEYS.TRAINING_HISTORY, JSON.stringify([]));
  }
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------
export function getConsent() {
  return localStorage.getItem(KEYS.CONSENT) === 'true';
}
export function setConsent(value) {
  localStorage.setItem(KEYS.CONSENT, value ? 'true' : 'false');
}

// ---------------------------------------------------------------------------
// Speed Test Records
// ---------------------------------------------------------------------------

/**
 * Tambah satu hasil speed test ke DB.
 * @param {Object} record
 * @returns {Object} record dengan id dan timestamps yang sudah diisi
 */
export function addSpeedTestRecord(record) {
  const all = getAllSpeedTests();
  const newRecord = {
    ...record,
    id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
    status: 'pending',    // pending | valid | rejected | used_for_training
    rejection_reason: null,
    used_in_model_version: null,
  };
  all.push(newRecord);
  localStorage.setItem(KEYS.SPEED_TESTS, JSON.stringify(all));
  return newRecord;
}

export function getAllSpeedTests() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SPEED_TESTS) || '[]');
  } catch {
    return [];
  }
}

export function updateSpeedTestRecord(id, patch) {
  const all = getAllSpeedTests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  localStorage.setItem(KEYS.SPEED_TESTS, JSON.stringify(all));
  return all[idx];
}

/** Hapus duplikat berdasarkan checkpoint_id + provider + window waktu 10 menit */
export function isDuplicateSpeedTest(record) {
  const all = getAllSpeedTests();
  const TEN_MIN = 10 * 60 * 1000;
  const recordTime = new Date(record.timestamp).getTime();
  return all.some((r) => {
    if (r.checkpoint_id !== record.checkpoint_id) return false;
    if (r.provider !== record.provider) return false;
    const diff = Math.abs(new Date(r.timestamp).getTime() - recordTime);
    return diff < TEN_MIN;
  });
}

// ---------------------------------------------------------------------------
// Speed Test Statistics
// ---------------------------------------------------------------------------
export function getSpeedTestStats() {
  const all = getAllSpeedTests();
  const total = all.length;
  const valid = all.filter((r) => r.status === 'valid').length;
  const rejected = all.filter((r) => r.status === 'rejected').length;
  const usedForTraining = all.filter((r) => r.status === 'used_for_training').length;
  const pending = all.filter((r) => r.status === 'pending').length;

  // By provider
  const byProvider = {};
  for (const r of all) {
    if (!byProvider[r.provider]) byProvider[r.provider] = 0;
    byProvider[r.provider]++;
  }

  // By checkpoint
  const byCheckpoint = {};
  for (const r of all) {
    if (!byCheckpoint[r.checkpoint_id]) byCheckpoint[r.checkpoint_id] = 0;
    byCheckpoint[r.checkpoint_id]++;
  }

  // By floor
  const byFloor = {};
  for (const r of all) {
    const f = r.floor ?? 'unknown';
    if (!byFloor[f]) byFloor[f] = 0;
    byFloor[f]++;
  }

  // Growth over time (by date)
  const byDate = {};
  for (const r of all) {
    const d = r.created_at ? r.created_at.slice(0, 10) : 'unknown';
    if (!byDate[d]) byDate[d] = 0;
    byDate[d]++;
  }

  return { total, valid, rejected, usedForTraining, pending, byProvider, byCheckpoint, byFloor, byDate };
}

// ---------------------------------------------------------------------------
// Model Registry
// ---------------------------------------------------------------------------

/**
 * Simpan metadata model ke registry.
 * @param {string} modelType  — 'IF_Network_Condition' | 'IF_Internet_Performance'
 * @param {Object} modelMeta  — metadata model
 */
export function saveModelToRegistry(modelType, modelMeta) {
  const registry = getModelRegistry();
  if (!registry[modelType]) registry[modelType] = [];

  const entry = {
    ...modelMeta,
    version: modelMeta.version || `v${Date.now()}`,
    trained_at: new Date().toISOString(),
    is_active: false,  // aktifkan secara manual via activateModel()
  };
  registry[modelType].push(entry);
  localStorage.setItem(KEYS.MODEL_REGISTRY, JSON.stringify(registry));
  return entry;
}

export function getModelRegistry() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.MODEL_REGISTRY) || '{}');
  } catch {
    return {};
  }
}

export function getActiveModel(modelType) {
  const registry = getModelRegistry();
  const versions = registry[modelType] || [];
  return versions.find((m) => m.is_active) || null;
}

export function getAllModelVersions(modelType) {
  const registry = getModelRegistry();
  return registry[modelType] || [];
}

/** Aktifkan satu versi model dan non-aktifkan sisanya */
export function activateModel(modelType, version) {
  const registry = getModelRegistry();
  if (!registry[modelType]) return false;
  registry[modelType] = registry[modelType].map((m) => ({
    ...m,
    is_active: m.version === version,
  }));
  localStorage.setItem(KEYS.MODEL_REGISTRY, JSON.stringify(registry));
  return true;
}

/** Rollback: aktifkan versi sebelumnya */
export function rollbackModel(modelType) {
  const registry = getModelRegistry();
  const versions = registry[modelType] || [];
  const activeIdx = versions.findIndex((m) => m.is_active);
  if (activeIdx <= 0) return false;
  // non-aktifkan semua, aktifkan sebelumnya
  registry[modelType] = versions.map((m, i) => ({
    ...m,
    is_active: i === activeIdx - 1,
  }));
  localStorage.setItem(KEYS.MODEL_REGISTRY, JSON.stringify(registry));
  return true;
}

// ---------------------------------------------------------------------------
// Training History
// ---------------------------------------------------------------------------
export function addTrainingHistoryEntry(entry) {
  const history = getTrainingHistory();
  const newEntry = {
    ...entry,
    id: `th_${Date.now()}`,
    trained_at: new Date().toISOString(),
  };
  history.push(newEntry);
  localStorage.setItem(KEYS.TRAINING_HISTORY, JSON.stringify(history));
  return newEntry;
}

export function getTrainingHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.TRAINING_HISTORY) || '[]');
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Data untuk training: ambil speed test valid yang belum dipakai
// ---------------------------------------------------------------------------
export function getUnusedValidSpeedTests() {
  return getAllSpeedTests().filter((r) => r.status === 'valid');
}

export function markRecordsAsUsedForTraining(ids, modelVersion) {
  const all = getAllSpeedTests();
  const idSet = new Set(ids);
  const updated = all.map((r) =>
    idSet.has(r.id)
      ? { ...r, status: 'used_for_training', used_in_model_version: modelVersion }
      : r
  );
  localStorage.setItem(KEYS.SPEED_TESTS, JSON.stringify(updated));
}

// ---------------------------------------------------------------------------
// Walk Test data (dari signalData.js) — wrap untuk integrasi
// ---------------------------------------------------------------------------
export function getWalkTestRecords(signalData) {
  // Tambahkan source tag ke signalData
  return signalData.map((d) => ({ ...d, source: 'walk_test' }));
}
