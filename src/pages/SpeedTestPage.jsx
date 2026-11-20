import { useState, useEffect, useRef } from 'react';
import { checkpoints } from '../data/checkpoints.js';
import { PROVIDERS } from '../data/signalData.js';
import {
  initDB,
  getConsent, setConsent,
  addSpeedTestRecord,
  updateSpeedTestRecord,
  isDuplicateSpeedTest,
} from '../data/db.js';
import { validateSpeedTestRecord } from '../utils/validation.js';
import '../components/MLPages.css';

// ---------------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------------
const RATE_LIMIT_KEY   = 'signalmap_speedtest_rate';
const MAX_TESTS        = 3;      // maksimum pengujian per window
const RATE_WINDOW_MS   = 5 * 60 * 1000; // 5 menit

// Rentang simulasi realistis (bukan nilai nyata — peringatan ditampilkan)
const SIM_RANGES = {
  Telkomsel:         { dl: [8, 45],  ul: [4, 20],  ping: [15, 60],  jitter: [2, 20], loss: [0, 2] },
  'XL Axiata':       { dl: [5, 35],  ul: [3, 15],  ping: [20, 80],  jitter: [3, 25], loss: [0, 3] },
  'Indosat Ooredoo': { dl: [4, 30],  ul: [2, 12],  ping: [25, 100], jitter: [5, 30], loss: [0, 5] },
};

function randBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// ---------------------------------------------------------------------------
// Rate limiter (localStorage)
// ---------------------------------------------------------------------------
function getRateLog() {
  try {
    return JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
  } catch {
    return [];
  }
}

function checkRateLimit() {
  const now = Date.now();
  const log = getRateLog().filter((t) => now - t < RATE_WINDOW_MS);
  return { allowed: log.length < MAX_TESTS, remaining: MAX_TESTS - log.length, log };
}

function recordRateLimit() {
  const { log } = checkRateLimit();
  const now = Date.now();
  const newLog = [...log.filter((t) => now - t < RATE_WINDOW_MS), now];
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newLog));
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------
export default function SpeedTestPage() {
  // Form state
  const [provider,     setProvider]     = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [rsrp,         setRsrp]         = useState('');
  const [rsrq,         setRsrq]         = useState('');

  // Test state
  const [phase,    setPhase]   = useState('idle');   // idle | running | done | error
  const [progress, setProgress] = useState(0);       // 0–100
  const [result,   setResult]  = useState(null);
  const [saved,    setSaved]   = useState(null);     // DB record
  const [msg,      setMsg]     = useState('');

  // Rate limit
  const [rateInfo, setRateInfo] = useState(checkRateLimit());

  // Consent
  const [consent, setConsentState] = useState(getConsent());

  const intervalRef = useRef(null);

  useEffect(() => {
    initDB();
    return () => clearInterval(intervalRef.current);
  }, []);

  // Refresh rate limit info setiap 30 detik
  useEffect(() => {
    const timer = setInterval(() => setRateInfo(checkRateLimit()), 30000);
    return () => clearInterval(timer);
  }, []);

  const selectedCP = checkpoints.find((c) => c.id === checkpointId);

  // ---------------------------------------------------------------------------
  // Simulasi pengujian kecepatan
  // ---------------------------------------------------------------------------
  function simulateTest() {
    const ranges = SIM_RANGES[provider] || SIM_RANGES['Telkomsel'];
    const steps  = 30; // 30 iterasi = ~3 detik animasi
    let step = 0;

    // Nilai akhir ditetapkan di awal
    const finalResult = {
      download:    Math.round(randBetween(...ranges.dl)    * 100) / 100,
      upload:      Math.round(randBetween(...ranges.ul)    * 100) / 100,
      ping:        Math.round(randBetween(...ranges.ping)),
      jitter:      Math.round(randBetween(...ranges.jitter) * 10) / 10,
      packet_loss: Math.round(randBetween(...ranges.loss)  * 100) / 100,
    };

    setProgress(0);
    setPhase('running');
    setMsg('Mengukur latensi…');

    intervalRef.current = setInterval(() => {
      step++;
      const pct = Math.round((step / steps) * 100);
      setProgress(pct);

      if (step < 10)      setMsg('Mengukur latensi (ping)…');
      else if (step < 20) setMsg('Mengukur kecepatan unduh…');
      else if (step < 28) setMsg('Mengukur kecepatan unggah…');
      else                setMsg('Menghitung jitter & packet loss…');

      if (step >= steps) {
        clearInterval(intervalRef.current);
        setPhase('done');
        setProgress(100);
        setResult(finalResult);
        setMsg('Pengujian selesai.');
      }
    }, 100);
  }

  // ---------------------------------------------------------------------------
  // Simpan hasil ke DB
  // ---------------------------------------------------------------------------
  function saveResult() {
    if (!result || !selectedCP) return;

    const record = {
      checkpoint_id: checkpointId,
      provider,
      floor:        selectedCP.floor,
      zona:         selectedCP.zona,
      latitude:     selectedCP.latitude ?? null,
      longitude:    selectedCP.longitude ?? null,
      download:     result.download,
      upload:       result.upload,
      ping:         result.ping,
      jitter:       result.jitter,
      packet_loss:  result.packet_loss,
      timestamp:    new Date().toISOString(),
      server:       'Simulasi (tidak ada server nyata)',
      rsrp:         rsrp !== '' ? parseFloat(rsrp) : null,
      rsrq:         rsrq !== '' ? parseFloat(rsrq) : null,
    };

    // Periksa duplikat
    if (isDuplicateSpeedTest(record)) {
      setMsg('⚠️ Data duplikat: pengujian di checkpoint dan provider yang sama sudah dilakukan dalam 10 menit terakhir.');
      return;
    }

    // Validasi
    const validation = validateSpeedTestRecord(record);

    // Simpan ke DB
    const saved = addSpeedTestRecord(record);

    // Update status berdasarkan validasi
    if (validation.valid) {
      updateSpeedTestRecord(saved.id, { status: 'valid' });
      setSaved({ ...saved, status: 'valid' });
      setMsg('✅ Data tersimpan dan valid — siap digunakan untuk training model.');
    } else {
      const reason = validation.reasons.join('; ');
      updateSpeedTestRecord(saved.id, {
        status: 'rejected',
        rejection_reason: reason,
      });
      setSaved({ ...saved, status: 'rejected', rejection_reason: reason });
      setMsg(`❌ Data ditolak: ${reason}`);
    }

    recordRateLimit();
    setRateInfo(checkRateLimit());
  }

  // ---------------------------------------------------------------------------
  // Handler utama "Jalankan Pengujian"
  // ---------------------------------------------------------------------------
  function handleRun() {
    if (!provider)     { setMsg('Pilih provider terlebih dahulu.'); return; }
    if (!checkpointId) { setMsg('Pilih checkpoint terlebih dahulu.'); return; }
    if (!consent)      { setMsg('Berikan persetujuan pengumpulan data sebelum melanjutkan.'); return; }

    const { allowed } = checkRateLimit();
    if (!allowed) {
      setMsg(`⚠️ Batas pengujian tercapai (${MAX_TESTS}× per 5 menit). Tunggu beberapa saat.`);
      return;
    }

    setResult(null);
    setSaved(null);
    setMsg('');
    simulateTest();
  }

  function handleReset() {
    clearInterval(intervalRef.current);
    setPhase('idle');
    setProgress(0);
    setResult(null);
    setSaved(null);
    setMsg('');
  }

  function handleConsent(val) {
    setConsent(val);
    setConsentState(val);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isRunning = phase === 'running';
  const isDone    = phase === 'done';

  return (
    <div className="page">
      <div className="speedtest-layout">
        {/* ── Header ── */}
        <div className="speedtest-header">
          <h1 className="speedtest-title">
            <span>🚀</span> Internet Speed Test
          </h1>
          <p className="speedtest-subtitle">
            Ukur kualitas koneksi internet di setiap titik pengukuran (checkpoint) gedung.
            Hasil pengujian akan disimpan sebagai dataset untuk pengembangan model Isolation Forest.
          </p>
        </div>

        {/* ── Peringatan Simulasi ── */}
        <div className="alert alert-warning">
          <strong>⚠️ Mode Simulasi:</strong> Pengujian ini menghasilkan nilai simulasi realistis, bukan pengukuran jaringan nyata.
          Dalam implementasi produksi, nilai ini akan digantikan oleh hasil dari layanan speed test seperti Ookla / NDT.
        </div>

        {/* ── Consent ── */}
        <div className="card speedtest-consent">
          <h3>Persetujuan Pengumpulan Data</h3>
          <p>
            Hasil Speed Test Anda akan dikumpulkan secara anonim untuk keperluan penelitian
            dan pengembangan model deteksi anomali sinyal di Gedung Teknik Elektro Undana.
            Tidak ada data pribadi yang disimpan. Anda dapat mencabut persetujuan kapan saja.
          </p>
          <div className="consent-toggle">
            <label className="switch">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => handleConsent(e.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className={`consent-label ${consent ? 'consent-on' : 'consent-off'}`}>
              {consent ? '✅ Saya menyetujui pengumpulan dan penggunaan data Speed Test saya.' : '❌ Belum menyetujui — data tidak akan disimpan.'}
            </span>
          </div>
        </div>

        <div className="speedtest-grid">
          {/* ── Form Konfigurasi ── */}
          <div className="card speedtest-form">
            <h3>Konfigurasi Pengujian</h3>

            {/* Provider — wajib dipilih manual */}
            <div className="form-group">
              <label className="form-label">
                Provider <span className="required">*</span>
              </label>
              <div className="form-hint">
                Pilih dan konfirmasi provider yang sedang aktif di perangkat Anda saat ini.
                Sistem tidak mendeteksi provider secara otomatis.
              </div>
              <div className="provider-buttons">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    className={`provider-btn ${provider === p ? 'active' : ''}`}
                    onClick={() => setProvider(p)}
                    disabled={isRunning}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkpoint */}
            <div className="form-group">
              <label className="form-label" htmlFor="cp-select">
                Checkpoint <span className="required">*</span>
              </label>
              <select
                id="cp-select"
                className="form-select"
                value={checkpointId}
                onChange={(e) => setCheckpointId(e.target.value)}
                disabled={isRunning}
              >
                <option value="">-- Pilih checkpoint --</option>
                {[1, 2].map((fl) => (
                  <optgroup key={fl} label={`Lantai ${fl}`}>
                    {checkpoints
                      .filter((c) => c.floor === fl)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} — {c.label} [{c.zona}]
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {selectedCP && (
                <div className="form-hint">
                  Lantai {selectedCP.floor} · {selectedCP.zona} · ({selectedCP.x}m, {selectedCP.y}m)
                </div>
              )}
            </div>

            {/* RSRP & RSRQ — opsional */}
            <div className="form-group">
              <label className="form-label">
                RSRP / RSRQ <span className="optional">(opsional)</span>
              </label>
              <div className="form-hint">
                Masukkan nilai dari pengaturan perangkat atau aplikasi sinyal jika tersedia.
                Kosongkan jika tidak diketahui.
              </div>
              <div className="signal-inputs">
                <div className="signal-input-group">
                  <label>RSRP (dBm)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="-80"
                    min="-140"
                    max="-44"
                    value={rsrp}
                    onChange={(e) => setRsrp(e.target.value)}
                    disabled={isRunning}
                  />
                </div>
                <div className="signal-input-group">
                  <label>RSRQ (dB)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="-10"
                    min="-20"
                    max="-3"
                    value={rsrq}
                    onChange={(e) => setRsrq(e.target.value)}
                    disabled={isRunning}
                  />
                </div>
              </div>
            </div>

            {/* Rate limit info */}
            <div className="rate-limit-info">
              <span>Sisa kuota pengujian: </span>
              <strong>{rateInfo.remaining}/{MAX_TESTS}</strong>
              <span> (reset tiap 5 menit)</span>
            </div>

            {/* Tombol aksi */}
            <div className="speedtest-actions">
              {!isRunning && !isDone && (
                <button
                  className="btn btn-primary"
                  onClick={handleRun}
                  disabled={isRunning}
                >
                  ▶ Jalankan Pengujian
                </button>
              )}
              {isRunning && (
                <button className="btn btn-danger" onClick={handleReset}>
                  ■ Batalkan
                </button>
              )}
              {isDone && (
                <>
                  {!saved && (
                    <button
                      className="btn btn-success"
                      onClick={saveResult}
                      disabled={!consent}
                    >
                      💾 Simpan Hasil
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={handleReset}>
                    🔄 Ulangi Pengujian
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Panel Hasil ── */}
          <div className="card speedtest-result-panel">
            <h3>Hasil Pengujian</h3>

            {/* Progress bar */}
            {(isRunning || isDone) && (
              <div className="speedtest-progress">
                <div className="progress-bar-wrap">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="progress-status">{msg}</div>
              </div>
            )}

            {phase === 'idle' && (
              <div className="speedtest-placeholder">
                <div className="placeholder-icon">📡</div>
                <p>Pilih provider dan checkpoint, lalu klik "Jalankan Pengujian".</p>
              </div>
            )}

            {isDone && result && (
              <div className="speedtest-results">
                <div className="metric-grid">
                  <MetricCard label="Download" value={result.download} unit="Mbps" icon="⬇️" good={result.download > 10} />
                  <MetricCard label="Upload"   value={result.upload}   unit="Mbps" icon="⬆️" good={result.upload > 5} />
                  <MetricCard label="Ping"     value={result.ping}     unit="ms"   icon="📶" good={result.ping < 50} invert />
                  <MetricCard label="Jitter"   value={result.jitter}   unit="ms"   icon="📉" good={result.jitter < 10} invert />
                  <MetricCard label="Packet Loss" value={result.packet_loss} unit="%" icon="📦" good={result.packet_loss < 1} invert />
                </div>

                {rsrp && (
                  <div className="signal-summary">
                    <div className="signal-badge">RSRP: <strong>{rsrp} dBm</strong></div>
                    {rsrq && <div className="signal-badge">RSRQ: <strong>{rsrq} dB</strong></div>}
                  </div>
                )}

                {saved && (
                  <div className={`save-status ${saved.status}`}>
                    {saved.status === 'valid'
                      ? '✅ Tersimpan & valid — akan digunakan dalam training model berikutnya.'
                      : `❌ Ditolak: ${saved.rejection_reason}`}
                  </div>
                )}

                {msg && !saved && (
                  <div className="save-msg">{msg}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Info Dataset ── */}
        <div className="card speedtest-info">
          <h3>Alur Data Speed Test</h3>
          <div className="data-flow">
            <div className="flow-step">
              <span className="flow-num">1</span>
              <span>Pengguna melakukan Speed Test</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="flow-num">2</span>
              <span>Validasi otomatis nilai pengukuran</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="flow-num">3</span>
              <span>Simpan ke dataset historis</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="flow-num">4</span>
              <span>Admin memicu retraining saat data cukup</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="flow-num">5</span>
              <span>Model baru dievaluasi sebelum diaktifkan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponen kartu metrik
// ---------------------------------------------------------------------------
function MetricCard({ label, value, unit, icon, good, invert }) {
  const isGood = invert ? !good : good;
  return (
    <div className={`metric-card ${isGood ? 'metric-good' : 'metric-bad'}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-value">
        {typeof value === 'number' ? value.toFixed(value >= 10 ? 1 : 2) : '—'}
      </div>
      <div className="metric-unit">{unit}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
