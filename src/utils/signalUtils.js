// ============================================================================
// signalUtils.js — Signal analysis utility functions
// ============================================================================

/**
 * Returns an Indonesian-language description for a signal quality category.
 * @param {string} kategori — Excellent | Good | Low | Bad
 * @returns {string}
 */
export function getSignalDescription(kategori) {
  const descriptions = {
    Excellent:
      'Kualitas sinyal sangat baik. Cocok untuk streaming video HD, video call, dan semua aktivitas online tanpa gangguan.',
    Good:
      'Kualitas sinyal baik. Mendukung browsing, media sosial, dan streaming musik dengan lancar.',
    Low:
      'Kualitas sinyal rendah. Masih bisa digunakan untuk chat dan browsing ringan, namun streaming mungkin terganggu.',
    Bad:
      'Kualitas sinyal buruk. Koneksi tidak stabil, sulit melakukan panggilan atau mengakses internet.',
  };
  return descriptions[kategori] || 'Kategori sinyal tidak dikenali.';
}

/**
 * Find the checkpoint with the best signal for a given provider and floor.
 * @param {Array} signalData — full signalData array
 * @param {string} provider
 * @param {number} floor
 * @returns {{ checkpoint_id: string, rsrp: number, kategori: string } | null}
 */
export function getRecommendation(signalData, provider, floor) {
  const filtered = signalData.filter(
    (d) => d.provider === provider && d.floor === floor,
  );
  if (filtered.length === 0) return null;

  // Best = highest RSRP
  const best = filtered.reduce((a, b) => (a.rsrp > b.rsrp ? a : b));
  return {
    checkpoint_id: best.checkpoint_id,
    rsrp: best.rsrp,
    rsrq: best.rsrq,
    kategori: best.kategori,
    zona: best.zona,
  };
}

/**
 * Compare all providers at a single checkpoint.
 * @param {Array} signalData
 * @param {string} checkpointId
 * @returns {Array<{ provider, rsrp, rsrq, kategori }>}
 */
export function compareProviders(signalData, checkpointId) {
  return signalData
    .filter((d) => d.checkpoint_id === checkpointId)
    .map(({ provider, rsrp, rsrq, kategori }) => ({
      provider,
      rsrp,
      rsrq,
      kategori,
    }))
    .sort((a, b) => b.rsrp - a.rsrp); // best first
}

/**
 * Compute statistics for a given floor (and optionally provider).
 * @param {Array} signalData
 * @param {number} floor
 * @param {string} [provider] — optional; if omitted, all providers
 * @returns {{ total, avgRsrp, avgRsrq, counts: {Excellent, Good, Low, Bad}, percentages }}
 */
export function getFloorStats(signalData, floor, provider) {
  let filtered = signalData.filter((d) => d.floor === floor);
  if (provider) filtered = filtered.filter((d) => d.provider === provider);

  const total = filtered.length;
  if (total === 0) {
    return {
      total: 0,
      avgRsrp: null,
      avgRsrq: null,
      counts: { Excellent: 0, Good: 0, Low: 0, Bad: 0 },
      percentages: { Excellent: 0, Good: 0, Low: 0, Bad: 0 },
    };
  }

  const sumRsrp = filtered.reduce((s, d) => s + d.rsrp, 0);
  const sumRsrq = filtered.reduce((s, d) => s + d.rsrq, 0);

  const counts = { Excellent: 0, Good: 0, Low: 0, Bad: 0 };
  for (const d of filtered) counts[d.kategori]++;

  const percentages = {};
  for (const cat of Object.keys(counts)) {
    percentages[cat] = Math.round((counts[cat] / total) * 1000) / 10;
  }

  return {
    total,
    avgRsrp: Math.round((sumRsrp / total) * 10) / 10,
    avgRsrq: Math.round((sumRsrq / total) * 10) / 10,
    counts,
    percentages,
  };
}

/**
 * Compute statistics for a given zone type (and optionally provider).
 * @param {Array} signalData
 * @param {string} zona — 'Indoor' | 'Semi-outdoor' | 'Outdoor'
 * @param {string} [provider]
 * @returns {{ total, avgRsrp, avgRsrq, counts, percentages }}
 */
export function getZoneStats(signalData, zona, provider) {
  let filtered = signalData.filter((d) => d.zona === zona);
  if (provider) filtered = filtered.filter((d) => d.provider === provider);

  const total = filtered.length;
  if (total === 0) {
    return {
      total: 0,
      avgRsrp: null,
      avgRsrq: null,
      counts: { Excellent: 0, Good: 0, Low: 0, Bad: 0 },
      percentages: { Excellent: 0, Good: 0, Low: 0, Bad: 0 },
    };
  }

  const sumRsrp = filtered.reduce((s, d) => s + d.rsrp, 0);
  const sumRsrq = filtered.reduce((s, d) => s + d.rsrq, 0);

  const counts = { Excellent: 0, Good: 0, Low: 0, Bad: 0 };
  for (const d of filtered) counts[d.kategori]++;

  const percentages = {};
  for (const cat of Object.keys(counts)) {
    percentages[cat] = Math.round((counts[cat] / total) * 1000) / 10;
  }

  return {
    total,
    avgRsrp: Math.round((sumRsrp / total) * 10) / 10,
    avgRsrq: Math.round((sumRsrq / total) * 10) / 10,
    counts,
    percentages,
  };
}
