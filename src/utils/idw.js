// ============================================================================
// idw.js — Inverse Distance Weighting (IDW) interpolation
// ============================================================================

/**
 * Compute the IDW-interpolated value at (targetX, targetY) using surrounding
 * data points.
 *
 * @param {number}   targetX     — x coordinate of the target point
 * @param {number}   targetY     — y coordinate of the target point
 * @param {Array<{x:number, y:number, value:number}>} dataPoints
 * @param {number}   [power=2]   — distance-weighting exponent
 * @param {number}   [maxDistance=15] — ignore points farther than this (metres)
 * @returns {number} interpolated value (or NaN if no points within range)
 */
export function idwInterpolation(targetX, targetY, dataPoints, power = 2, maxDistance = 15) {
  let numerator   = 0;
  let denominator  = 0;
  let usedPoints   = 0;

  for (const pt of dataPoints) {
    const dx = targetX - pt.x;
    const dy = targetY - pt.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Exact match — return value directly
    if (distance < 1e-10) return pt.value;

    if (distance > maxDistance) continue;

    const weight = 1 / Math.pow(distance, power);
    numerator   += weight * pt.value;
    denominator += weight;
    usedPoints++;
  }

  if (usedPoints === 0 || denominator === 0) {
    // Fallback: use the nearest point regardless of maxDistance
    let minDist  = Infinity;
    let nearest  = null;
    for (const pt of dataPoints) {
      const d = Math.sqrt((targetX - pt.x) ** 2 + (targetY - pt.y) ** 2);
      if (d < minDist) { minDist = d; nearest = pt; }
    }
    return nearest ? nearest.value : NaN;
  }

  return numerator / denominator;
}

/**
 * Generate a full 2-D grid of IDW-interpolated values covering the building.
 *
 * @param {Array<{x:number, y:number, value:number}>} dataPoints
 * @param {number} width       — building width in metres (e.g. 60)
 * @param {number} height      — building height in metres (e.g. 20)
 * @param {number} [resolution=1] — grid cell size in metres
 * @param {number} [power=2]
 * @returns {Array<Array<number>>} 2-D array [row][col] where row 0 = y 0
 */
export function generateHeatmapGrid(dataPoints, width, height, resolution = 1, power = 2) {
  const cols = Math.ceil(width  / resolution);
  const rows = Math.ceil(height / resolution);
  const grid = [];

  for (let row = 0; row < rows; row++) {
    const rowData = [];
    const y = row * resolution + resolution / 2; // centre of cell
    for (let col = 0; col < cols; col++) {
      const x = col * resolution + resolution / 2;
      rowData.push(idwInterpolation(x, y, dataPoints, power));
    }
    grid.push(rowData);
  }

  return grid;
}
