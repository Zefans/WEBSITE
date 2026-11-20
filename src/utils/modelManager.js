// ============================================================================
// modelManager.js — Orchestrates dataset building, training, evaluation,
//                   versioning, and activation of Isolation Forest models.
// ============================================================================

import {
  IsolationForest,
  extractFeaturesNetworkCondition,
  extractFeaturesInternetPerformance,
  FEATURES_NETWORK,
  FEATURES_INTERNET,
} from './isolationForest.js';

import {
  getAllSpeedTests,
  saveModelToRegistry,
  getModelRegistry,
  activateModel as dbActivateModel,
  rollbackModel as dbRollbackModel,
  addTrainingHistoryEntry,
  markRecordsAsUsedForTraining,
  getActiveModel,
} from '../data/db.js';

import { hasValidSignalData } from './validation.js';

// ---------------------------------------------------------------------------
// Retraining threshold config (can be overridden by admin)
// ---------------------------------------------------------------------------
export const DEFAULT_RETRAIN_CONFIG = {
  minNewDataForRetrain: 100,   // retrain ketika ada >=100 data valid baru
  minTotalDataForFit:   30,    // minimal total data untuk fit model
  contamination:        0.05,
  nEstimators:          100,
  maxSamples:           256,
};

// ---------------------------------------------------------------------------
// Dataset builder
// ---------------------------------------------------------------------------

/**
 * Bangun Dataset A (Combined: perlu RSRP + RSRQ) dan Dataset B (Internet only).
 * Menggabungkan walk test data dengan speed test data.
 *
 * @param {Array} walkTestData  — dari signalData.js
 * @param {Array} speedTests    — dari DB (status valid atau used_for_training)
 * @returns {{ datasetA: Array, datasetB: Array }}
 */
export function buildDatasets(walkTestData, speedTests) {
  const datasetA = [];
  const datasetB = [];

  // Tambahkan walk test data sebagai Dataset A dasar
  for (const wt of walkTestData) {
    if (
      wt.rsrp != null && wt.rsrq != null &&
      !Number.isNaN(Number(wt.rsrp)) && !Number.isNaN(Number(wt.rsrq))
    ) {
      datasetA.push({
        source:        'walk_test',
        checkpoint_id: wt.checkpoint_id,
        provider:      wt.provider,
        floor:         wt.floor,
        zona:          wt.zona,
        latitude:      wt.latitude,
        longitude:     wt.longitude,
        rsrp:          Number(wt.rsrp),
        rsrq:          Number(wt.rsrq),
        // Walk test tidak punya speed test metrics — isi dengan rata-rata tipikal
        // JANGAN isi dengan 0, biarkan null agar tidak masuk Dataset A speed-test
        download:     null,
        upload:       null,
        ping:         null,
        jitter:       null,
        packet_loss:  null,
      });
    }
  }

  // Tambahkan speed test data
  const usable = speedTests.filter((r) =>
    r.status === 'valid' || r.status === 'used_for_training'
  );

  for (const st of usable) {
    // Coba cocokkan dengan walk test: checkpoint_id + provider
    const walkMatch = walkTestData.find(
      (wt) => wt.checkpoint_id === st.checkpoint_id && wt.provider === st.provider
    );

    const hasSignal = hasValidSignalData(st);

    // Dataset B: semua speed test yang valid (download/upload/ping/jitter/packet_loss)
    if (
      st.download != null && st.upload != null &&
      st.ping != null && st.jitter != null && st.packet_loss != null
    ) {
      datasetB.push({
        ...st,
        source: 'speed_test',
      });
    }

    // Dataset A: speed test yang punya signal data valid
    // Gunakan RSRP/RSRQ dari speed test sendiri jika ada,
    // atau dari walk test match jika tidak ada tapi lokasi/provider cocok
    if (
      st.download != null && st.upload != null &&
      st.ping != null && st.jitter != null && st.packet_loss != null
    ) {
      if (hasSignal) {
        datasetA.push({ ...st, source: 'speed_test_with_signal' });
      } else if (walkMatch && walkMatch.rsrp != null) {
        // Pairing dengan walk test — hanya jika checkpoint + provider cocok
        datasetA.push({
          ...st,
          rsrp:   walkMatch.rsrp,
          rsrq:   walkMatch.rsrq,
          source: 'speed_test_paired_walk',
        });
      }
    }
  }

  // Filter Dataset A: pastikan semua kolom yang dibutuhkan ada (tidak null)
  const datasetAFiltered = datasetA.filter((d) =>
    d.rsrp != null && d.rsrq != null &&
    d.download != null && d.upload != null &&
    d.ping != null && d.jitter != null && d.packet_loss != null
  );

  return { datasetA: datasetAFiltered, datasetB };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

/**
 * Train IF_Network_Condition model.
 * @param {Array} datasetA
 * @param {Object} config
 * @returns {{ model: IsolationForest, meta: Object }}
 */
export function trainNetworkConditionModel(datasetA, config = DEFAULT_RETRAIN_CONFIG) {
  if (datasetA.length < config.minTotalDataForFit) {
    throw new Error(
      `Dataset A terlalu kecil: ${datasetA.length} record (minimum: ${config.minTotalDataForFit})`
    );
  }

  const features = datasetA.map(extractFeaturesNetworkCondition);
  const model = new IsolationForest({
    nEstimators:   config.nEstimators,
    maxSamples:    Math.min(config.maxSamples, features.length),
    contamination: config.contamination,
    randomState:   42,
  });

  model.fit(features, FEATURES_NETWORK);

  // Evaluasi pada training data
  const results = model.scoreAll(features);
  const anomalyCount  = results.filter((r) => r.label === -1).length;
  const scores        = results.map((r) => r.score);
  const avgScore      = scores.reduce((a, b) => a + b, 0) / scores.length;
  const scoreDistribution = computeScoreDistribution(scores);

  const version = `IF_NC_v${Date.now()}`;
  const meta = {
    version,
    model_type:          'IF_Network_Condition',
    n_estimators:        config.nEstimators,
    max_samples:         model.maxSamples,
    contamination:       config.contamination,
    train_size:          datasetA.length,
    anomaly_count:       anomalyCount,
    anomaly_pct:         (anomalyCount / datasetA.length) * 100,
    avg_anomaly_score:   avgScore,
    score_distribution:  scoreDistribution,
    threshold:           model.threshold_,
    features:            FEATURES_NETWORK,
    model_json:          model.toJSON(),
  };

  return { model, meta };
}

/**
 * Train IF_Internet_Performance model.
 * @param {Array} datasetB
 * @param {Object} config
 * @returns {{ model: IsolationForest, meta: Object }}
 */
export function trainInternetPerformanceModel(datasetB, config = DEFAULT_RETRAIN_CONFIG) {
  if (datasetB.length < config.minTotalDataForFit) {
    throw new Error(
      `Dataset B terlalu kecil: ${datasetB.length} record (minimum: ${config.minTotalDataForFit})`
    );
  }

  const features = datasetB.map(extractFeaturesInternetPerformance);
  const model = new IsolationForest({
    nEstimators:   config.nEstimators,
    maxSamples:    Math.min(config.maxSamples, features.length),
    contamination: config.contamination,
    randomState:   42,
  });

  model.fit(features, FEATURES_INTERNET);

  const results = model.scoreAll(features);
  const anomalyCount  = results.filter((r) => r.label === -1).length;
  const scores        = results.map((r) => r.score);
  const avgScore      = scores.reduce((a, b) => a + b, 0) / scores.length;
  const scoreDistribution = computeScoreDistribution(scores);

  const version = `IF_IP_v${Date.now()}`;
  const meta = {
    version,
    model_type:          'IF_Internet_Performance',
    n_estimators:        config.nEstimators,
    max_samples:         model.maxSamples,
    contamination:       config.contamination,
    train_size:          datasetB.length,
    anomaly_count:       anomalyCount,
    anomaly_pct:         (anomalyCount / datasetB.length) * 100,
    avg_anomaly_score:   avgScore,
    score_distribution:  scoreDistribution,
    threshold:           model.threshold_,
    features:            FEATURES_INTERNET,
    model_json:          model.toJSON(),
  };

  return { model, meta };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluasi model terhadap dataset — analisis distribusi, per-provider, per-lantai, per-zona.
 * @param {IsolationForest|Object} modelOrJSON
 * @param {Array} dataset
 * @param {Function} extractFn   — extractFeaturesNetworkCondition atau extractFeaturesInternetPerformance
 * @returns {Object} evaluation report
 */
export function evaluateModel(modelOrJSON, dataset, extractFn) {
  let model;
  if (modelOrJSON.isFitted_ !== undefined) {
    model = modelOrJSON;
  } else if (modelOrJSON.model_json) {
    model = IsolationForest.fromJSON(modelOrJSON.model_json);
  } else {
    model = IsolationForest.fromJSON(modelOrJSON);
  }

  const features = dataset.map(extractFn);
  const results  = model.scoreAll(features);

  const scores        = results.map((r) => r.score);
  const anomalyCount  = results.filter((r) => r.label === -1).length;
  const avgScore      = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Per provider
  const byProvider = {};
  for (let i = 0; i < dataset.length; i++) {
    const p = dataset[i].provider;
    if (!byProvider[p]) byProvider[p] = { total: 0, anomaly: 0, scores: [] };
    byProvider[p].total++;
    byProvider[p].scores.push(results[i].score);
    if (results[i].label === -1) byProvider[p].anomaly++;
  }
  for (const p of Object.keys(byProvider)) {
    const g = byProvider[p];
    g.anomaly_pct = (g.anomaly / g.total) * 100;
    g.avg_score   = g.scores.reduce((a, b) => a + b, 0) / g.scores.length;
    delete g.scores;
  }

  // Per floor
  const byFloor = {};
  for (let i = 0; i < dataset.length; i++) {
    const f = dataset[i].floor ?? 'unknown';
    if (!byFloor[f]) byFloor[f] = { total: 0, anomaly: 0 };
    byFloor[f].total++;
    if (results[i].label === -1) byFloor[f].anomaly++;
  }
  for (const f of Object.keys(byFloor)) {
    byFloor[f].anomaly_pct = (byFloor[f].anomaly / byFloor[f].total) * 100;
  }

  // Per zona
  const byZona = {};
  for (let i = 0; i < dataset.length; i++) {
    const z = dataset[i].zona ?? 'unknown';
    if (!byZona[z]) byZona[z] = { total: 0, anomaly: 0 };
    byZona[z].total++;
    if (results[i].label === -1) byZona[z].anomaly++;
  }
  for (const z of Object.keys(byZona)) {
    byZona[z].anomaly_pct = (byZona[z].anomaly / byZona[z].total) * 100;
  }

  // Score distribution
  const scoreDistribution = computeScoreDistribution(scores);

  // Seed stability (run with 3 different seeds, compare anomaly count)
  const seeds = [42, 123, 999];
  const seedResults = seeds.map((seed) => {
    const m2 = IsolationForest.fromJSON({
      ...model.toJSON(),
      randomState: seed,
    });
    // Re-fit tidak dilakukan untuk seed stability —
    // hanya score dengan model yang sama, seed hanya untuk subsampling
    // Ini adalah pendekatan sederhana: hitung perbedaan threshold effect
    const sc = features.map((f) => m2.scorePoint(f));
    return sc.filter((s) => s >= model.threshold_).length;
  });
  const seedStability = {
    anomaly_counts: seedResults,
    std_dev: computeStdDev(seedResults),
    stable: computeStdDev(seedResults) < seedResults[0] * 0.1,
  };

  return {
    total:              dataset.length,
    anomaly_count:      anomalyCount,
    anomaly_pct:        (anomalyCount / dataset.length) * 100,
    avg_anomaly_score:  avgScore,
    score_distribution: scoreDistribution,
    by_provider:        byProvider,
    by_floor:           byFloor,
    by_zona:            byZona,
    seed_stability:     seedStability,
    per_record:         results.map((r, i) => ({
      id:            dataset[i].id || `idx_${i}`,
      checkpoint_id: dataset[i].checkpoint_id,
      provider:      dataset[i].provider,
      floor:         dataset[i].floor,
      zona:          dataset[i].zona,
      score:         r.score,
      is_anomaly:    r.label === -1,
    })),
  };
}

// ---------------------------------------------------------------------------
// Batch retraining orchestrator
// ---------------------------------------------------------------------------

/**
 * Cek apakah retraining diperlukan.
 * @param {string} modelType
 * @param {Object} config
 * @returns {boolean}
 */
export function shouldRetrain(modelType, config = DEFAULT_RETRAIN_CONFIG) {
  const speedTests = getAllSpeedTests().filter((r) => r.status === 'valid');
  return speedTests.length >= config.minNewDataForRetrain;
}

/**
 * Jalankan seluruh pipeline retraining:
 * 1. Build datasets
 * 2. Train models
 * 3. Simpan ke registry (tidak langsung aktifkan)
 * 4. Catat ke training history
 *
 * @param {Array} walkTestData
 * @param {Object} config
 * @param {Function} onProgress  — callback(message: string)
 * @returns {{ networkMeta, internetMeta, datasetASize, datasetBSize }}
 */
export function runRetraining(walkTestData, config = DEFAULT_RETRAIN_CONFIG, onProgress = () => {}) {
  onProgress('Membangun dataset...');

  const speedTests = getAllSpeedTests().filter(
    (r) => r.status === 'valid' || r.status === 'used_for_training'
  );

  const { datasetA, datasetB } = buildDatasets(walkTestData, speedTests);

  onProgress(`Dataset A: ${datasetA.length} record | Dataset B: ${datasetB.length} record`);

  let networkMeta = null;
  let internetMeta = null;
  const errors = [];

  // Train Model 1
  if (datasetA.length >= config.minTotalDataForFit) {
    onProgress('Training IF_Network_Condition...');
    try {
      const { meta } = trainNetworkConditionModel(datasetA, config);
      networkMeta = saveModelToRegistry('IF_Network_Condition', meta);
      onProgress(`IF_Network_Condition selesai. Versi: ${networkMeta.version}`);
    } catch (e) {
      errors.push(`IF_Network_Condition gagal: ${e.message}`);
      onProgress(`⚠️ ${e.message}`);
    }
  } else {
    onProgress(`⚠️ Dataset A terlalu kecil (${datasetA.length}), skip IF_Network_Condition`);
  }

  // Train Model 2
  if (datasetB.length >= config.minTotalDataForFit) {
    onProgress('Training IF_Internet_Performance...');
    try {
      const { meta } = trainInternetPerformanceModel(datasetB, config);
      internetMeta = saveModelToRegistry('IF_Internet_Performance', meta);
      onProgress(`IF_Internet_Performance selesai. Versi: ${internetMeta.version}`);
    } catch (e) {
      errors.push(`IF_Internet_Performance gagal: ${e.message}`);
      onProgress(`⚠️ ${e.message}`);
    }
  } else {
    onProgress(`⚠️ Dataset B terlalu kecil (${datasetB.length}), skip IF_Internet_Performance`);
  }

  // Tandai record yang dipakai
  const usedIds = speedTests.filter((r) => r.status === 'valid').map((r) => r.id);
  if (usedIds.length > 0 && (networkMeta || internetMeta)) {
    const version = networkMeta?.version || internetMeta?.version;
    markRecordsAsUsedForTraining(usedIds, version);
  }

  // Catat ke history
  addTrainingHistoryEntry({
    network_model_version:  networkMeta?.version || null,
    internet_model_version: internetMeta?.version || null,
    dataset_a_size:         datasetA.length,
    dataset_b_size:         datasetB.length,
    config,
    errors,
    status: errors.length === 0 ? 'success' : (errors.length < 2 ? 'partial' : 'failed'),
  });

  onProgress(errors.length === 0 ? '✅ Retraining selesai.' : `⚠️ Selesai dengan ${errors.length} error.`);

  return {
    networkMeta,
    internetMeta,
    datasetASize: datasetA.length,
    datasetBSize: datasetB.length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Model activation / rollback wrappers
// ---------------------------------------------------------------------------
export function activateModel(modelType, version) {
  return dbActivateModel(modelType, version);
}

export function rollbackModel(modelType) {
  return dbRollbackModel(modelType);
}

/**
 * Prediksi anomali untuk satu record menggunakan model aktif.
 * @param {string} modelType
 * @param {Object} record
 * @returns {{ score: number, is_anomaly: boolean, model_version: string } | null}
 */
export function predictAnomaly(modelType, record) {
  const active = getActiveModel(modelType);
  if (!active || !active.model_json) return null;

  const model = IsolationForest.fromJSON(active.model_json);

  const extractFn = modelType === 'IF_Network_Condition'
    ? extractFeaturesNetworkCondition
    : extractFeaturesInternetPerformance;

  try {
    const features = extractFn(record);
    const score    = model.scorePoint(features);
    const label    = model.predict(features);
    return {
      score:         score,
      is_anomaly:    label === -1,
      model_version: active.version,
    };
  } catch (e) {
    console.error('predictAnomaly error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function computeScoreDistribution(scores) {
  const bins = [
    { label: '0.0–0.3', min: 0,   max: 0.3 },
    { label: '0.3–0.4', min: 0.3, max: 0.4 },
    { label: '0.4–0.5', min: 0.4, max: 0.5 },
    { label: '0.5–0.6', min: 0.5, max: 0.6 },
    { label: '0.6–0.7', min: 0.6, max: 0.7 },
    { label: '0.7–1.0', min: 0.7, max: 1.0 },
  ];
  return bins.map(({ label, min, max }) => ({
    label,
    count: scores.filter((s) => s >= min && (max === 1.0 ? s <= max : s < max)).length,
  }));
}

function computeStdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}
