// ============================================================================
// colorScale.js — Color mapping utilities for signal categories & providers
// ============================================================================

const CATEGORY_COLORS = {
  Excellent: '#2196F3', // blue
  Good:      '#4CAF50', // green
  Low:       '#FFC107', // yellow / amber
  Bad:       '#F44336', // red
};

const CATEGORY_VALUES = {
  Excellent: 4,
  Good:      3,
  Low:       2,
  Bad:       1,
};

const PROVIDER_COLORS = {
  Telkomsel:          '#ED1C24',
  'XL Axiata':        '#0168B3',
  'Indosat Ooredoo':  '#FFD700',
};

// ---------------------------------------------------------------------------
// Category ↔ Color
// ---------------------------------------------------------------------------

/**
 * Map a category name to its hex colour.
 * @param {string} category — Excellent | Good | Low | Bad
 * @returns {string} hex colour
 */
export function categoryToColor(category) {
  return CATEGORY_COLORS[category] || '#9E9E9E';
}

// ---------------------------------------------------------------------------
// Category ↔ Numeric value
// ---------------------------------------------------------------------------

export function categoryToValue(category) {
  return CATEGORY_VALUES[category] ?? 0;
}

/**
 * Map a continuous numeric value (1–4) back to a discrete category.
 * Uses thresholds: >=3.5 → Excellent, >=2.5 → Good, >=1.5 → Low, else Bad
 */
export function valueToCategory(value) {
  if (value >= 3.5) return 'Excellent';
  if (value >= 2.5) return 'Good';
  if (value >= 1.5) return 'Low';
  return 'Bad';
}

// ---------------------------------------------------------------------------
// Numeric value → smooth gradient colour (rgba string)
// ---------------------------------------------------------------------------

/**
 * Interpolate between Bad (red, v=1) → Low (amber, v=2) → Good (green, v=3)
 * → Excellent (blue, v=4) using linear RGB segments.
 * @param {number} value — 1 to 4
 * @returns {string} rgba(r, g, b, 1) string
 */
export function valueToColor(value) {
  // Clamp
  const v = Math.max(1, Math.min(4, value));

  // Control points (r, g, b)
  const stops = [
    { v: 1, r: 244, g: 67,  b: 54  }, // Bad — red
    { v: 2, r: 255, g: 193, b: 7   }, // Low — amber
    { v: 3, r: 76,  g: 175, b: 80  }, // Good — green
    { v: 4, r: 33,  g: 150, b: 243 }, // Excellent — blue
  ];

  // Find the two surrounding stops
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].v && v <= stops[i + 1].v) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }

  const t = hi.v === lo.v ? 0 : (v - lo.v) / (hi.v - lo.v);
  const r = Math.round(lo.r + t * (hi.r - lo.r));
  const g = Math.round(lo.g + t * (hi.g - lo.g));
  const b = Math.round(lo.b + t * (hi.b - lo.b));

  return `rgba(${r}, ${g}, ${b}, 1)`;
}

// ---------------------------------------------------------------------------
// RSRP (dBm) → Category
// ---------------------------------------------------------------------------

/**
 * Classify RSRP value into a category.
 * Excellent: -80 to -44 dBm
 * Good:      -90 to -80 dBm
 * Low:      -100 to -90 dBm
 * Bad:      -140 to -100 dBm
 */
export function rsrpToCategory(rsrp) {
  if (rsrp >= -80)  return 'Excellent';
  if (rsrp >= -90)  return 'Good';
  if (rsrp >= -100) return 'Low';
  return 'Bad';
}

// ---------------------------------------------------------------------------
// Provider → Color
// ---------------------------------------------------------------------------

export function getProviderColor(provider) {
  return PROVIDER_COLORS[provider] || '#9E9E9E';
}
