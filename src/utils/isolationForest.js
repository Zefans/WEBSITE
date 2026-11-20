// ============================================================================
// isolationForest.js — Pure JavaScript Isolation Forest implementation
// Compatible with browser (no Python/scikit-learn required).
// Based on: Liu, Ting & Zhou (2008/2012). DOI: 10.1109/ICDM.2008.17
// ============================================================================

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function randomInt(min, max, rng) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFloat(min, max, rng) {
  return rng() * (max - min) + min;
}

/** Seeded pseudo-random generator (mulberry32) for reproducibility */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// iTree node
// ---------------------------------------------------------------------------
function buildITree(data, indices, depth, maxDepth, featureNames, rng) {
  if (depth >= maxDepth || indices.length <= 1) {
    return { type: 'leaf', size: indices.length };
  }

  // Pick random feature
  const featureIdx = randomInt(0, featureNames.length - 1, rng);
  const feature = featureNames[featureIdx];

  // Find min/max for this feature among current subset
  let minVal = Infinity, maxVal = -Infinity;
  for (const i of indices) {
    const v = data[i][feature];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  if (minVal === maxVal) {
    return { type: 'leaf', size: indices.length };
  }

  const splitValue = randomFloat(minVal, maxVal, rng);

  const leftIdx  = indices.filter((i) => data[i][feature] < splitValue);
  const rightIdx = indices.filter((i) => data[i][feature] >= splitValue);

  return {
    type:       'internal',
    feature,
    splitValue,
    left:       buildITree(data, leftIdx,  depth + 1, maxDepth, featureNames, rng),
    right:      buildITree(data, rightIdx, depth + 1, maxDepth, featureNames, rng),
  };
}

/** Average path length of unsuccessful BST search (c(n)) */
function cFactor(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const H = Math.log(n - 1) + 0.5772156649; // Euler-Mascheroni
  return 2 * H - (2 * (n - 1) / n);
}

/** Traverse one point through one iTree, return path length */
function pathLength(node, point, depth) {
  if (node.type === 'leaf') {
    return depth + cFactor(node.size);
  }
  if (point[node.feature] < node.splitValue) {
    return pathLength(node.left, point, depth + 1);
  }
  return pathLength(node.right, point, depth + 1);
}

// ---------------------------------------------------------------------------
// Isolation Forest class
// ---------------------------------------------------------------------------
export class IsolationForest {
  /**
   * @param {Object} params
   * @param {number} params.nEstimators   — number of trees (default 100)
   * @param {number} params.maxSamples    — subsample size (default 256)
   * @param {number} params.contamination — fraction of anomalies (default 0.05)
   * @param {number} params.randomState   — seed for reproducibility
   */
  constructor({
    nEstimators   = 100,
    maxSamples    = 256,
    contamination = 0.05,
    randomState   = 42,
  } = {}) {
    this.nEstimators   = nEstimators;
    this.maxSamples    = maxSamples;
    this.contamination = contamination;
    this.randomState   = randomState;
    this.trees_        = [];
    this.featureNames_ = [];
    this.threshold_    = null;
    this.trainSize_    = 0;
    this.isFitted_     = false;
  }

  /**
   * Fit the model.
   * @param {Array<Object>} data — array of plain objects with numeric fields
   * @param {string[]} featureNames — keys to use as features
   */
  fit(data, featureNames) {
    if (!data || data.length === 0) throw new Error('Training data kosong');
    if (!featureNames || featureNames.length === 0) throw new Error('featureNames kosong');

    this.featureNames_ = featureNames;
    this.trainSize_    = data.length;
    const rng          = mulberry32(this.randomState);

    const sampleSize = Math.min(this.maxSamples, data.length);
    const maxDepth   = Math.ceil(Math.log2(sampleSize));

    this.trees_ = [];

    for (let t = 0; t < this.nEstimators; t++) {
      // Subsample without replacement
      const shuffled = [...Array(data.length).keys()].sort(() => rng() - 0.5);
      const sample   = shuffled.slice(0, sampleSize);
      const tree     = buildITree(data, sample, 0, maxDepth, featureNames, rng);
      this.trees_.push(tree);
    }

    // Compute threshold from training data scores
    const scores = data.map((point) => this._rawScore(point));
    scores.sort((a, b) => a - b);
    const cutoffIdx = Math.floor((1 - this.contamination) * scores.length);
    this.threshold_ = scores[Math.min(cutoffIdx, scores.length - 1)];

    this.isFitted_ = true;
    return this;
  }

  /** Raw anomaly score (0–1, higher = more anomalous) */
  _rawScore(point) {
    const c = cFactor(Math.min(this.maxSamples, this.trainSize_));
    if (c === 0) return 0.5;
    const avgPath = this.trees_.reduce((sum, t) => sum + pathLength(t, point, 0), 0) / this.trees_.length;
    return Math.pow(2, -avgPath / c);
  }

  /**
   * Score one point. Returns anomaly score 0–1.
   * @param {Object} point
   * @returns {number}
   */
  scorePoint(point) {
    if (!this.isFitted_) throw new Error('Model belum di-fit');
    return this._rawScore(point);
  }

  /**
   * Predict: 1 = normal, -1 = anomali (sama dengan scikit-learn convention)
   * @param {Object} point
   * @returns {1|-1}
   */
  predict(point) {
    const score = this.scorePoint(point);
    return score >= this.threshold_ ? -1 : 1;
  }

  /**
   * Score semua data sekaligus.
   * @param {Array<Object>} data
   * @returns {Array<{score: number, label: 1|-1}>}
   */
  scoreAll(data) {
    return data.map((point) => {
      const score = this.scorePoint(point);
      return { score, label: score >= this.threshold_ ? -1 : 1 };
    });
  }

  /** Serialisasi model ke plain object (untuk disimpan di localStorage) */
  toJSON() {
    return {
      nEstimators:   this.nEstimators,
      maxSamples:    this.maxSamples,
      contamination: this.contamination,
      randomState:   this.randomState,
      featureNames:  this.featureNames_,
      threshold:     this.threshold_,
      trainSize:     this.trainSize_,
      trees:         this.trees_,
      isFitted:      this.isFitted_,
    };
  }

  /** Muat model dari JSON */
  static fromJSON(json) {
    const model = new IsolationForest({
      nEstimators:   json.nEstimators,
      maxSamples:    json.maxSamples,
      contamination: json.contamination,
      randomState:   json.randomState,
    });
    model.featureNames_ = json.featureNames;
    model.threshold_    = json.threshold;
    model.trainSize_    = json.trainSize;
    model.trees_        = json.trees;
    model.isFitted_     = json.isFitted;
    return model;
  }
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

/** Provider encoding (ordinal berdasarkan infrastruktur umum) */
const PROVIDER_ENCODING = {
  'Telkomsel':      2,
  'XL Axiata':      1,
  'Indosat Ooredoo': 0,
};

const ZONA_ENCODING = {
  'Outdoor':       2,
  'Semi-outdoor':  1,
  'Indoor':        0,
};

/**
 * Ekstrak fitur Dataset A (Combined: sinyal + internet).
 * Hanya untuk record yang punya RSRP dan RSRQ valid.
 */
export function extractFeaturesNetworkCondition(record) {
  return {
    provider_enc: PROVIDER_ENCODING[record.provider] ?? 0,
    zona_enc:     ZONA_ENCODING[record.zona]         ?? 0,
    floor:        Number(record.floor)               || 0,
    latitude:     Number(record.latitude)            || 0,
    longitude:    Number(record.longitude)           || 0,
    rsrp:         Number(record.rsrp),
    rsrq:         Number(record.rsrq),
    download:     Number(record.download),
    upload:       Number(record.upload),
    ping:         Number(record.ping),
    jitter:       Number(record.jitter),
    packet_loss:  Number(record.packet_loss),
  };
}

export const FEATURES_NETWORK = [
  'provider_enc', 'zona_enc', 'floor', 'latitude', 'longitude',
  'rsrp', 'rsrq', 'download', 'upload', 'ping', 'jitter', 'packet_loss',
];

/**
 * Ekstrak fitur Dataset B (Internet Performance — tanpa RSRP/RSRQ).
 */
export function extractFeaturesInternetPerformance(record) {
  return {
    provider_enc: PROVIDER_ENCODING[record.provider] ?? 0,
    zona_enc:     ZONA_ENCODING[record.zona]         ?? 0,
    floor:        Number(record.floor)               || 0,
    latitude:     Number(record.latitude)            || 0,
    longitude:    Number(record.longitude)           || 0,
    download:     Number(record.download),
    upload:       Number(record.upload),
    ping:         Number(record.ping),
    jitter:       Number(record.jitter),
    packet_loss:  Number(record.packet_loss),
  };
}

export const FEATURES_INTERNET = [
  'provider_enc', 'zona_enc', 'floor', 'latitude', 'longitude',
  'download', 'upload', 'ping', 'jitter', 'packet_loss',
];
