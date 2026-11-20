// ============================================================================
// validation.js — Validasi data Speed Test sebelum masuk database
// ============================================================================

/** Batas kewajaran nilai pengukuran */
const BOUNDS = {
  download:    { min: 0,    max: 1000  },   // Mbps
  upload:      { min: 0,    max: 500   },   // Mbps
  ping:        { min: 1,    max: 5000  },   // ms
  jitter:      { min: 0,    max: 2000  },   // ms
  packet_loss: { min: 0,    max: 100   },   // %
  rsrp:        { min: -140, max: -44   },   // dBm (3GPP range)
  rsrq:        { min: -20,  max: -3    },   // dB  (3GPP range)
};

/**
 * Validasi satu record speed test.
 * @param {Object} record
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export function validateSpeedTestRecord(record) {
  const reasons = [];

  // --- Field wajib ---
  if (!record.checkpoint_id) reasons.push('checkpoint_id tidak ada');
  if (!record.provider)      reasons.push('provider tidak ada');
  if (!record.floor)         reasons.push('floor tidak ada');
  if (!record.zona)          reasons.push('zona tidak ada');
  if (!record.timestamp)     reasons.push('timestamp tidak ada');

  // --- Nilai numerik wajib ---
  const numericRequired = ['download', 'upload', 'ping', 'jitter', 'packet_loss'];
  for (const field of numericRequired) {
    const v = record[field];
    if (v === null || v === undefined || v === '') {
      reasons.push(`${field} tidak ada`);
      continue;
    }
    const num = Number(v);
    if (Number.isNaN(num)) {
      reasons.push(`${field} bukan angka`);
      continue;
    }
    const { min, max } = BOUNDS[field];
    if (num < min || num > max) {
      reasons.push(`${field} di luar batas (${min}–${max}): ${num}`);
    }
  }

  // --- RSRP / RSRQ: opsional, tapi jika ada harus valid ---
  if (record.rsrp !== null && record.rsrp !== undefined && record.rsrp !== '') {
    const v = Number(record.rsrp);
    if (Number.isNaN(v)) {
      reasons.push('rsrp bukan angka');
    } else if (v < BOUNDS.rsrp.min || v > BOUNDS.rsrp.max) {
      reasons.push(`rsrp di luar batas (${BOUNDS.rsrp.min}–${BOUNDS.rsrp.max}): ${v}`);
    }
  }

  if (record.rsrq !== null && record.rsrq !== undefined && record.rsrq !== '') {
    const v = Number(record.rsrq);
    if (Number.isNaN(v)) {
      reasons.push('rsrq bukan angka');
    } else if (v < BOUNDS.rsrq.min || v > BOUNDS.rsrq.max) {
      reasons.push(`rsrq di luar batas (${BOUNDS.rsrq.min}–${BOUNDS.rsrq.max}): ${v}`);
    }
  }

  // --- Provider yang diizinkan ---
  const ALLOWED_PROVIDERS = ['Telkomsel', 'XL Axiata', 'Indosat Ooredoo'];
  if (record.provider && !ALLOWED_PROVIDERS.includes(record.provider)) {
    reasons.push(`provider tidak dikenal: ${record.provider}`);
  }

  // --- Timestamp tidak boleh terlalu lama di masa depan ---
  if (record.timestamp) {
    const ts = new Date(record.timestamp).getTime();
    const now = Date.now();
    if (ts > now + 60_000) {
      reasons.push('timestamp di masa depan (lebih dari 1 menit)');
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * Periksa apakah record punya data sinyal (RSRP + RSRQ) yang valid.
 * Digunakan untuk menentukan apakah bisa masuk Dataset A atau hanya Dataset B.
 */
export function hasValidSignalData(record) {
  if (record.rsrp === null || record.rsrp === undefined || record.rsrp === '') return false;
  if (record.rsrq === null || record.rsrq === undefined || record.rsrq === '') return false;
  const rsrp = Number(record.rsrp);
  const rsrq = Number(record.rsrq);
  if (Number.isNaN(rsrp) || Number.isNaN(rsrq)) return false;
  return (
    rsrp >= BOUNDS.rsrp.min && rsrp <= BOUNDS.rsrp.max &&
    rsrq >= BOUNDS.rsrq.min && rsrq <= BOUNDS.rsrq.max
  );
}
