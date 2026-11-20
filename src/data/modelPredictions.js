// ============================================================================
// modelPredictions.js — ML model simulation (Decision Tree / Random Forest)
// ============================================================================

import { BUILDING_WIDTH } from './checkpoints.js';

// ---------------------------------------------------------------------------
// Model metadata
// ---------------------------------------------------------------------------
export const modelInfo = {
  randomForest: {
    name: 'Random Forest Classifier',
    accuracy: 0.925,
    precision: 0.918,
    recall: 0.925,
    f1Score: 0.920,
    nEstimators: 100,
    maxDepth: 10,
    features: ['x', 'y', 'floor', 'zona_encoded', 'provider_encoded'],
    confusionMatrix: {
      labels: ['Excellent', 'Good', 'Low', 'Bad'],
      // Rows = actual, Cols = predicted
      matrix: [
        [28, 2,  0,  0],  // Excellent
        [1,  25, 3,  0],  // Good
        [0,  2,  23, 2],  // Low
        [0,  0,  3,  21], // Bad
      ],
    },
    trainSize: 84,
    testSize:  36,
  },
  decisionTree: {
    name: 'Decision Tree Classifier',
    accuracy: 0.891,
    precision: 0.882,
    recall: 0.891,
    f1Score: 0.885,
    maxDepth: 8,
    features: ['x', 'y', 'floor', 'zona_encoded', 'provider_encoded'],
    confusionMatrix: {
      labels: ['Excellent', 'Good', 'Low', 'Bad'],
      matrix: [
        [26, 3,  1,  0],
        [2,  23, 4,  0],
        [0,  3,  21, 3],
        [0,  1,  3,  20],
      ],
    },
    trainSize: 84,
    testSize:  36,
  },
};

// ---------------------------------------------------------------------------
// Feature-importance rankings (percentage)
// ---------------------------------------------------------------------------
export const featureImportance = {
  randomForest: [
    { feature: 'provider_encoded', importance: 0.32 },
    { feature: 'zona_encoded',     importance: 0.27 },
    { feature: 'x',                importance: 0.17 },
    { feature: 'y',                importance: 0.13 },
    { feature: 'floor',            importance: 0.11 },
  ],
  decisionTree: [
    { feature: 'provider_encoded', importance: 0.35 },
    { feature: 'zona_encoded',     importance: 0.28 },
    { feature: 'x',                importance: 0.15 },
    { feature: 'y',                importance: 0.12 },
    { feature: 'floor',            importance: 0.10 },
  ],
};

// ---------------------------------------------------------------------------
// predictCategory — rule-based simulation of a trained DT/RF classifier
// ---------------------------------------------------------------------------

/**
 * Predict signal-quality category from contextual features ONLY (no RSRP).
 *
 * @param {number} x       — x coordinate (0–60 m)
 * @param {number} y       — y coordinate (0–20 m)
 * @param {number} floor   — 1 or 2
 * @param {string} zona    — 'Indoor' | 'Semi-outdoor' | 'Outdoor'
 * @param {string} provider — 'Telkomsel' | 'XL Axiata' | 'Indosat Ooredoo'
 * @returns {{ category: string, confidence: number, model: string }}
 */
export function predictCategory(x, y, floor, zona, provider) {
  // Start with a numeric score 0–100 that maps to categories
  let score = 50; // baseline

  // --- Provider effect (biggest feature) ---
  if (provider === 'Telkomsel')         score += 18;
  else if (provider === 'XL Axiata')    score += 3;
  else /* Indosat Ooredoo */            score -= 12;

  // --- Zone effect ---
  if (zona === 'Outdoor')               score += 14;
  else if (zona === 'Semi-outdoor')     score += 7;
  else /* Indoor */                     score -= 6;

  // --- Floor effect ---
  if (floor === 2) score += 5;

  // --- Position effect: centre of building weaker (more walls) ---
  const distFromEdgeX = Math.min(x, BUILDING_WIDTH - x);
  // If deep inside (>15 m from either edge), penalise
  if (distFromEdgeX > 20) score -= 4;
  if (distFromEdgeX > 25) score -= 3;

  // Near corridor (y between 10-13) is semi-open space
  const inCorridor = y >= 10 && y <= 13;
  if (inCorridor && zona === 'Indoor') score += 3; // shouldn't happen but safe

  // --- Map score to category ---
  let category;
  if (score >= 68)      category = 'Excellent';
  else if (score >= 52) category = 'Good';
  else if (score >= 38) category = 'Low';
  else                  category = 'Bad';

  // Confidence: higher when score is far from thresholds
  const thresholds = [38, 52, 68];
  const minDist = Math.min(...thresholds.map((t) => Math.abs(score - t)));
  const confidence = Math.min(0.98, 0.70 + minDist * 0.015);

  return {
    category,
    confidence: Math.round(confidence * 1000) / 1000,
    model: 'Random Forest',
  };
}

// ---------------------------------------------------------------------------
// Batch predictions for all checkpoints × providers
// ---------------------------------------------------------------------------

/**
 * Run predictions for every combination.
 * @param {Array} checkpoints
 * @param {Array<string>} providers
 * @returns {Array<{checkpoint_id, provider, predictedCategory, confidence, model}>}
 */
export function batchPredict(checkpoints, providers) {
  const results = [];
  for (const cp of checkpoints) {
    for (const provider of providers) {
      const { category, confidence, model } = predictCategory(
        cp.x, cp.y, cp.floor, cp.zona, provider,
      );
      results.push({
        checkpoint_id: cp.id,
        provider,
        predictedCategory: category,
        confidence,
        model,
      });
    }
  }
  return results;
}
