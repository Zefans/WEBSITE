import { useState, useEffect, useCallback } from 'react';
import {
  getAllSpeedTests,
  getModelRegistry,
  getActiveModel,
  getAllModelVersions,
  activateModel,
  rollbackModel,
  getTrainingHistory,
  saveModelToRegistry,
  addTrainingHistoryEntry,
  markRecordsAsUsedForTraining,
  getUnusedValidSpeedTests,
  initDB,
} from '../data/db.js';
import {
  buildDatasets,
  trainNetworkConditionModel,
  trainInternetPerformanceModel,
  evaluateModel,
  DEFAULT_RETRAIN_CONFIG,
  shouldRetrain,
} from '../utils/modelManager.js';
import {
  extractFeaturesNetworkCondition,
  extractFeaturesInternetPerformance,
} from '../utils/isolationForest.js';
import { signalData } from '../data/signalData.js';
import { loadAllDummyFiles, loadDummyIndex } from '../data/dummyLoader.js';
import '../components/MLPages.css';

const CONFIG_KEY    = 'signalmap_retrain_config';
function getSavedConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_RETRAIN_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_RETRAIN_CONFIG };
  } catch {
    return { ...DEFAULT_RETRAIN_CONFIG };
  }
}
function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------
export default function ModelManagementPage() {
  const [registry,    setRegistry]    = useState({});
  const [history,     setHistory]     = useState([]);
  const [config,      setConfig]      = useState(getSavedConfig());
  const [configEdit,  setConfigEdit]  = useState(getSavedConfig());

  const [trainingLog, setTrainingLog] = useState([]);
  const [isTraining,  setIsTraining]  = useState(false);
  const [evalReport,  setEvalReport]  = useState(null);
  const [evalTarget,  setEvalTarget]  = useState('IF_Network_Condition');
  const [statusMsg,   setStatusMsg]   = useState('');
  const [newDataCount, setNewDataCount] = useState(0);

  // Dummy file loader state
  const [dummyIndex,     setDummyIndex]     = useState(null);  // null = belum dimuat
  const [dummyLoading,   setDummyLoading]   = useState(false);
  const [dummyLoaded,    setDummyLoaded]    = useState([]);    // walk test records hasil load
  const [dummyProgress,  setDummyProgress]  = useState({ loaded: 0, total: 0, current: '' });
  const [extraWalkTest,  setExtraWalkTest]  = useState([]);    // gabungan signalData + dummy

  useEffect(() => {
    initDB();
    refresh();
    // Cek apakah index.json tersedia
    fetch('/dummy/index.json')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setDummyIndex(data); })
      .catch(() => {});
  }, []);

  const refresh = useCallback(() => {
    setRegistry(getModelRegistry());
    setHistory(getTrainingHistory());
    const unused = getUnusedValidSpeedTests();
    setNewDataCount(unused.length);
  }, []);

  // ---------------------------------------------------------------------------
  // Dummy file loader
  // ---------------------------------------------------------------------------
  async function handleLoadDummy() {
    setDummyLoading(true);
    setDummyProgress({ loaded: 0, total: 0, current: 'Memuat index...' });
    setStatusMsg('');

    try {
      const records = await loadAllDummyFiles({
        includeAll: false, // hanya Telkomsel, XL Axiata, Indosat Ooredoo
        onProgress: (loaded, total, filename) => {
          setDummyProgress({ loaded, total, current: filename });
        },
      });

      setDummyLoaded(records);
      // Gabungkan dengan signalData yang sudah ada (deduplicate by checkpoint+provider)
      const combined = [...signalData];
      for (const rec of records) {
        const exists = combined.some(
          (d) => d.checkpoint_id === rec.checkpoint_id && d.provider === rec.provider
        );
        if (!exists) combined.push(rec);
      }
      setExtraWalkTest(combined);
      setStatusMsg(`✅ ${records.length} record walk test dimuat dari ${dummyIndex?.count || '?'} file dummy. Siap untuk training.`);
    } catch (err) {
      setStatusMsg(`❌ Gagal memuat dummy files: ${err.message}`);
    } finally {
      setDummyLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Training
  // ---------------------------------------------------------------------------
  function appendLog(msg) {
    setTrainingLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  async function handleTrain() {
    setIsTraining(true);
    setTrainingLog([]);
    setEvalReport(null);
    setStatusMsg('');

    try {
      appendLog('Memuat data walk test…');
      // Gunakan extraWalkTest (sudah include dummy) jika tersedia, else signalData saja
      const walkTestData = extraWalkTest.length > 0 ? extraWalkTest : signalData;
      appendLog(`Walk test: ${walkTestData.length} record (${dummyLoaded.length > 0 ? `termasuk ${dummyLoaded.length} dari dummy files` : 'hanya signalData'})`);

      appendLog('Memuat speed test dari database…');
      const speedTests = getAllSpeedTests().filter(
        (r) => r.status === 'valid' || r.status === 'used_for_training'
      );

      appendLog(`Walk test: ${walkTestData.length} record | Speed test: ${speedTests.length} record`);

      appendLog('Membangun Dataset A (Combined) dan Dataset B (Internet)…');
      const { datasetA, datasetB } = buildDatasets(walkTestData, speedTests);
      appendLog(`Dataset A: ${datasetA.length} record | Dataset B: ${datasetB.length} record`);

      const trainedModels = [];

      // ── Train IF_Network_Condition ──
      if (datasetA.length >= config.minTotalDataForFit) {
        appendLog(`Training IF_Network_Condition (n=${config.nEstimators}, contamination=${config.contamination})…`);
        const { model, meta } = trainNetworkConditionModel(datasetA, config);
        const saved = saveModelToRegistry('IF_Network_Condition', meta);
        trainedModels.push({ type: 'IF_Network_Condition', version: saved.version, size: datasetA.length });
        appendLog(`✅ IF_Network_Condition selesai — versi ${saved.version} (${meta.anomaly_count} anomali / ${datasetA.length} data)`);
      } else {
        appendLog(`⚠️ Dataset A terlalu kecil (${datasetA.length} < ${config.minTotalDataForFit}) — IF_Network_Condition dilewati.`);
      }

      // ── Train IF_Internet_Performance ──
      if (datasetB.length >= config.minTotalDataForFit) {
        appendLog(`Training IF_Internet_Performance (n=${config.nEstimators}, contamination=${config.contamination})…`);
        const { model, meta } = trainInternetPerformanceModel(datasetB, config);
        const saved = saveModelToRegistry('IF_Internet_Performance', meta);
        trainedModels.push({ type: 'IF_Internet_Performance', version: saved.version, size: datasetB.length });
        appendLog(`✅ IF_Internet_Performance selesai — versi ${saved.version} (${meta.anomaly_count} anomali / ${datasetB.length} data)`);
      } else {
        appendLog(`⚠️ Dataset B terlalu kecil (${datasetB.length} < ${config.minTotalDataForFit}) — IF_Internet_Performance dilewati.`);
      }

      // ── Tandai speed test yang dipakai ──
      const usedIds = getAllSpeedTests()
        .filter((r) => r.status === 'valid')
        .map((r) => r.id);
      if (usedIds.length && trainedModels.length) {
        const latestVersion = trainedModels.map((m) => m.version).join(', ');
        markRecordsAsUsedForTraining(usedIds, latestVersion);
        appendLog(`📌 ${usedIds.length} record speed test ditandai 'used_for_training'.`);
      }

      // ── Simpan histori ──
      addTrainingHistoryEntry({
        models: trainedModels,
        dataset_a_size: datasetA.length,
        dataset_b_size: datasetB.length,
        config: { ...config },
        status: trainedModels.length ? 'success' : 'skipped',
      });

      appendLog('Training selesai. Model baru BELUM aktif — evaluasi dan aktifkan secara manual.');
      setStatusMsg(trainedModels.length
        ? `✅ ${trainedModels.length} model baru tersedia. Evaluasi dan aktifkan di tabel versi di bawah.`
        : '⚠️ Tidak ada model yang ditraining. Tambahkan lebih banyak data terlebih dahulu.');

      refresh();
    } catch (err) {
      appendLog(`❌ Error: ${err.message}`);
      setStatusMsg(`❌ Training gagal: ${err.message}`);
    } finally {
      setIsTraining(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Evaluasi model
  // ---------------------------------------------------------------------------
  function handleEvaluate() {
    setEvalReport(null);
    setStatusMsg('');
    try {
      const walkTestData  = signalData;
      const speedTests    = getAllSpeedTests().filter(
        (r) => r.status === 'valid' || r.status === 'used_for_training'
      );
      const { datasetA, datasetB } = buildDatasets(walkTestData, speedTests);

      const versions = getAllModelVersions(evalTarget);
      if (!versions.length) {
        setStatusMsg('Belum ada model yang ditraining untuk tipe ini.');
        return;
      }

      // Evaluasi model terbaru (atau aktif)
      const target = versions.find((v) => v.is_active) || versions[versions.length - 1];
      const dataset = evalTarget === 'IF_Network_Condition' ? datasetA : datasetB;
      const extractFn = evalTarget === 'IF_Network_Condition'
        ? extractFeaturesNetworkCondition
        : extractFeaturesInternetPerformance;

      if (dataset.length < 5) {
        setStatusMsg(`Dataset terlalu kecil untuk evaluasi (${dataset.length} record).`);
        return;
      }

      const report = evaluateModel(target, dataset, extractFn);
      setEvalReport({ ...report, model_type: evalTarget, version: target.version });
      setStatusMsg(`✅ Evaluasi ${evalTarget} selesai.`);
    } catch (err) {
      setStatusMsg(`❌ Evaluasi gagal: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Aktifkan / rollback model
  // ---------------------------------------------------------------------------
  function handleActivate(modelType, version) {
    activateModel(modelType, version);
    setStatusMsg(`✅ Model ${modelType} versi ${version} diaktifkan.`);
    refresh();
  }

  function handleRollback(modelType) {
    const ok = rollbackModel(modelType);
    setStatusMsg(ok
      ? `↩️ Rollback ${modelType} ke versi sebelumnya.`
      : `⚠️ Tidak ada versi sebelumnya untuk ${modelType}.`);
    refresh();
  }

  // ---------------------------------------------------------------------------
  // Simpan config
  // ---------------------------------------------------------------------------
  function handleSaveConfig() {
    const parsed = {
      minNewDataForRetrain: parseInt(configEdit.minNewDataForRetrain, 10),
      minTotalDataForFit:   parseInt(configEdit.minTotalDataForFit, 10),
      contamination:        parseFloat(configEdit.contamination),
      nEstimators:          parseInt(configEdit.nEstimators, 10),
      maxSamples:           parseInt(configEdit.maxSamples, 10),
    };
    setConfig(parsed);
    setConfigEdit(parsed);
    saveConfig(parsed);
    setStatusMsg('✅ Konfigurasi disimpan.');
  }

  // ---------------------------------------------------------------------------
  // Render — Model management dashboard
  // ---------------------------------------------------------------------------
  const ncVersions = getAllModelVersions('IF_Network_Condition');
  const ipVersions = getAllModelVersions('IF_Internet_Performance');
  const ncActive   = getActiveModel('IF_Network_Condition');
  const ipActive   = getActiveModel('IF_Internet_Performance');
  const needRetrain = newDataCount >= config.minNewDataForRetrain;

  return (
    <div className="page">
      <div className="mgmt-layout">
        {/* ── Header ── */}
        <div className="mgmt-header">
          <div>
            <h1 className="mgmt-title">🤖 Model Management</h1>
            <p className="mgmt-subtitle">Kelola model Isolation Forest untuk deteksi anomali sinyal.</p>
          </div>
          <span className="mgmt-subtitle">Data disimpan di browser ini.</span>
        </div>

        {/* ── Status bar ── */}
        {statusMsg && (
          <div className={`alert ${statusMsg.startsWith('❌') ? 'alert-danger' : 'alert-success'}`}>
            {statusMsg}
          </div>
        )}

        {/* ── Overview cards ── */}
        <div className="model-overview-grid">
          <ModelStatusCard
            type="IF_Network_Condition"
            label="IF Network Condition"
            desc="RSRP + RSRQ + Kecepatan Internet"
            active={ncActive}
            versionCount={ncVersions.length}
          />
          <ModelStatusCard
            type="IF_Internet_Performance"
            label="IF Internet Performance"
            desc="Kecepatan Internet saja"
            active={ipActive}
            versionCount={ipVersions.length}
          />
          <div className="card model-data-card">
            <div className="model-data-title">📊 Status Data</div>
            <div className="model-data-row">
              <span>Data valid baru</span>
              <strong className={newDataCount >= config.minNewDataForRetrain ? 'text-success' : ''}>
                {newDataCount}
              </strong>
            </div>
            <div className="model-data-row">
              <span>Threshold retraining</span>
              <strong>{config.minNewDataForRetrain}</strong>
            </div>
            {needRetrain && (
              <div className="retrain-badge">🔄 Retraining disarankan!</div>
            )}
          </div>
        </div>

        {/* ── Dummy File Loader ── */}
        <div className="card dummy-loader-card">
          <h3>📂 Walk Test Data (File Dummy)</h3>
          <p style={{ fontSize: '0.85rem', color: '#757575', marginBottom: '8px' }}>
            Muat file pengukuran walk test dari folder <code>public/dummy/</code>.
            Mendukung <strong>subfolder</strong> — taruh file <code>.txt</code> di subfolder manapun,
            jalankan <code>npm run index-dummy</code>, lalu klik tombol di bawah.
          </p>
          <div style={{ fontSize: '0.82rem', color: '#9e9e9e', marginBottom: '12px', lineHeight: '1.6' }}>
            💡 Contoh struktur:{' '}
            <code>dummy/sesi1/Telkomsel_Lt1_Ruang1_K1.txt</code> dan{' '}
            <code>dummy/sesi2/Telkomsel_Lt1_Ruang1_K1.txt</code> — nama sama, folder berbeda ✅
          </div>

          {dummyIndex ? (
            <div className="dummy-index-info">
              <span className="dummy-badge">📋 {dummyIndex.count} file tersedia</span>
              <span className="dummy-badge">🕐 {new Date(dummyIndex.generated_at).toLocaleString('id-ID')}</span>
              {dummyLoaded.length > 0 && (
                <span className="dummy-badge loaded">✅ {dummyLoaded.length} record dimuat</span>
              )}
            </div>
          ) : (
            <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
              index.json tidak ditemukan. Jalankan <code>npm run index-dummy</code> terlebih dahulu.
            </div>
          )}

          {/* Ringkasan folder dari index */}
          {dummyIndex?.files?.length > 0 && (() => {
            const folders = {};
            for (const f of dummyIndex.files) {
              const folder = f.folder || '(root)';
              if (!folders[folder]) folders[folder] = 0;
              folders[folder]++;
            }
            const folderEntries = Object.entries(folders);
            if (folderEntries.length <= 1 && folderEntries[0]?.[0] === '(root)') return null;
            return (
              <div style={{ marginTop: '8px', marginBottom: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: '#757575', marginBottom: '4px' }}>📁 Subfolder terdeteksi:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {folderEntries.map(([folder, count]) => (
                    <span key={folder} className="dummy-badge" style={{ fontSize: '0.78rem' }}>
                      📂 {folder} ({count} file)
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {dummyLoading && (
            <div className="dummy-progress">
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${dummyProgress.total ? (dummyProgress.loaded / dummyProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
              <div className="progress-status">
                {dummyProgress.loaded}/{dummyProgress.total} — {dummyProgress.current}
              </div>
            </div>
          )}

          <div className="training-controls" style={{ marginTop: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={handleLoadDummy}
              disabled={dummyLoading || !dummyIndex}
            >
              {dummyLoading ? '⏳ Memuat...' : '📥 Muat Dummy Files'}
            </button>
            {dummyLoaded.length > 0 && (
              <span style={{ fontSize: '0.82rem', color: '#16a34a' }}>
                ✅ Siap — data dummy akan digunakan saat Training
              </span>
            )}
          </div>
        </div>

        {/* ── Training controls ── */}
        <div className="card">
          <h3>⚙️ Training Model</h3>
          <div className="training-controls">
            <button
              className="btn btn-primary"
              onClick={handleTrain}
              disabled={isTraining}
            >
              {isTraining ? '⏳ Training berlangsung…' : '▶ Train Model'}
            </button>
            <div className="eval-controls">
              <select
                className="form-select select-sm"
                value={evalTarget}
                onChange={(e) => setEvalTarget(e.target.value)}
              >
                <option value="IF_Network_Condition">IF_Network_Condition</option>
                <option value="IF_Internet_Performance">IF_Internet_Performance</option>
              </select>
              <button
                className="btn btn-secondary"
                onClick={handleEvaluate}
                disabled={isTraining}
              >
                📊 Evaluate Model
              </button>
            </div>
          </div>

          {/* Training log */}
          {trainingLog.length > 0 && (
            <div className="training-log">
              {trainingLog.map((line, i) => (
                <div key={i} className="log-line">{line}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── Evaluasi report ── */}
        {evalReport && <EvalReportPanel report={evalReport} />}

        {/* ── Versi model ── */}
        <div className="card">
          <h3>📋 Versi Model: IF_Network_Condition</h3>
          <VersionTable
            versions={ncVersions}
            onActivate={(v) => handleActivate('IF_Network_Condition', v)}
            onRollback={() => handleRollback('IF_Network_Condition')}
          />
        </div>

        <div className="card">
          <h3>📋 Versi Model: IF_Internet_Performance</h3>
          <VersionTable
            versions={ipVersions}
            onActivate={(v) => handleActivate('IF_Internet_Performance', v)}
            onRollback={() => handleRollback('IF_Internet_Performance')}
          />
        </div>

        {/* ── Histori training ── */}
        <div className="card">
          <h3>📜 Histori Training</h3>
          {history.length === 0 ? (
            <p className="empty-state">Belum ada riwayat training.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Model</th>
                    <th>Dataset A</th>
                    <th>Dataset B</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.trained_at).toLocaleString('id-ID')}</td>
                      <td>
                        {h.models?.map((m) => (
                          <div key={m.version} className="version-pill">
                            {m.type.replace('IF_', '')}
                          </div>
                        ))}
                      </td>
                      <td>{h.dataset_a_size}</td>
                      <td>{h.dataset_b_size}</td>
                      <td>
                        <span className={`status-badge ${h.status}`}>{h.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Konfigurasi ── */}
        <div className="card">
          <h3>🔧 Konfigurasi Retraining</h3>
          <div className="config-grid">
            <ConfigField
              label="Min. data baru untuk retrain"
              value={configEdit.minNewDataForRetrain}
              onChange={(v) => setConfigEdit((c) => ({ ...c, minNewDataForRetrain: v }))}
            />
            <ConfigField
              label="Min. total data untuk fit"
              value={configEdit.minTotalDataForFit}
              onChange={(v) => setConfigEdit((c) => ({ ...c, minTotalDataForFit: v }))}
            />
            <ConfigField
              label="Contamination (0–0.5)"
              value={configEdit.contamination}
              step={0.01}
              min={0.01}
              max={0.5}
              onChange={(v) => setConfigEdit((c) => ({ ...c, contamination: v }))}
            />
            <ConfigField
              label="N Estimators"
              value={configEdit.nEstimators}
              min={10}
              max={500}
              onChange={(v) => setConfigEdit((c) => ({ ...c, nEstimators: v }))}
            />
            <ConfigField
              label="Max Samples"
              value={configEdit.maxSamples}
              min={16}
              max={1024}
              onChange={(v) => setConfigEdit((c) => ({ ...c, maxSamples: v }))}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSaveConfig}>
            💾 Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-komponen
// ---------------------------------------------------------------------------

function ModelStatusCard({ type, label, desc, active, versionCount }) {
  return (
    <div className={`card model-status-card ${active ? 'has-active' : ''}`}>
      <div className="model-status-label">{label}</div>
      <div className="model-status-desc">{desc}</div>
      {active ? (
        <>
          <div className="model-status-version">{active.version}</div>
          <div className="model-status-meta">
            Ditraining: {active.trained_at ? new Date(active.trained_at).toLocaleDateString('id-ID') : '—'}
          </div>
          <div className="model-status-meta">
            Data training: {active.train_size ?? '—'} | Anomali: {active.anomaly_count ?? '—'}
          </div>
          <div className="model-status-badge active">● Aktif</div>
        </>
      ) : (
        <div className="model-status-badge inactive">○ Tidak ada model aktif</div>
      )}
      <div className="model-status-meta">{versionCount} versi tersimpan</div>
    </div>
  );
}

function VersionTable({ versions, onActivate, onRollback }) {
  if (!versions.length) {
    return <p className="empty-state">Belum ada versi. Jalankan training terlebih dahulu.</p>;
  }

  return (
    <div className="version-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Versi</th>
            <th>Waktu Training</th>
            <th>Data</th>
            <th>Anomali</th>
            <th>Contamination</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {[...versions].reverse().map((v) => (
            <tr key={v.version} className={v.is_active ? 'row-active' : ''}>
              <td><code>{v.version}</code></td>
              <td>{v.trained_at ? new Date(v.trained_at).toLocaleString('id-ID') : '—'}</td>
              <td>{v.train_size ?? '—'}</td>
              <td>{v.anomaly_count ?? '—'} ({v.anomaly_pct != null ? v.anomaly_pct.toFixed(1) : '—'}%)</td>
              <td>{v.contamination ?? '—'}</td>
              <td>
                <span className={`status-badge ${v.is_active ? 'active' : 'inactive'}`}>
                  {v.is_active ? 'Aktif' : 'Tidak aktif'}
                </span>
              </td>
              <td>
                {!v.is_active && (
                  <button className="btn btn-xs btn-success" onClick={() => onActivate(v.version)}>
                    Aktifkan
                  </button>
                )}
                {v.is_active && (
                  <button className="btn btn-xs btn-warning" onClick={onRollback}>
                    Rollback
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvalReportPanel({ report }) {
  const dist = report.score_distribution || [];
  const scores = report.per_record?.map((r) => r.score) || [];
  const minScore = scores.length ? Math.min(...scores) : null;
  const maxScore = scores.length ? Math.max(...scores) : null;

  return (
    <div className="card eval-report">
      <h3>📊 Hasil Evaluasi — {report.model_type} ({report.version})</h3>
      <div className="eval-grid">
        <EvalStat label="Total data" value={report.total} />
        <EvalStat label="Anomali" value={`${report.anomaly_count} (${report.anomaly_pct?.toFixed(1)}%)`} />
        <EvalStat label="Rata-rata score" value={report.avg_anomaly_score?.toFixed(4)} />
        <EvalStat label="Min score" value={minScore?.toFixed(4)} />
        <EvalStat label="Max score" value={maxScore?.toFixed(4)} />
      </div>

      {/* Seed stability */}
      {report.seed_stability && (
        <div className="eval-section">
          <h4>Stabilitas Antar-Seed</h4>
          <p>
            Jumlah anomali per seed: {report.seed_stability.anomaly_counts?.join(', ')} —
            Std dev: {report.seed_stability.std_dev?.toFixed(2)} —
            <strong>{report.seed_stability.stable ? ' ✅ Stabil' : ' ⚠️ Tidak stabil'}</strong>
          </p>
        </div>
      )}

      {/* Distribusi score */}
      {dist.length > 0 && (
        <div className="eval-section">
          <h4>Distribusi Anomaly Score</h4>
          <div className="score-dist-bars">
            {dist.map((bin) => (
              <div key={bin.label} className="dist-bar-item">
                <div className="dist-bar-label">{bin.label}</div>
                <div className="dist-bar-wrap">
                  <div
                    className="dist-bar-fill"
                    style={{
                      width: `${Math.min(100, (bin.count / (report.total || 1)) * 300)}%`,
                    }}
                  />
                </div>
                <div className="dist-bar-count">{bin.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per provider */}
      {report.by_provider && (
        <div className="eval-section">
          <h4>Anomali per Provider</h4>
          <table className="data-table data-table-sm">
            <thead>
              <tr><th>Provider</th><th>Total</th><th>Anomali</th><th>%</th></tr>
            </thead>
            <tbody>
              {Object.entries(report.by_provider).map(([prov, stats]) => (
                <tr key={prov}>
                  <td>{prov}</td>
                  <td>{stats.total}</td>
                  <td>{stats.anomaly}</td>
                  <td>{stats.anomaly_pct?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per lantai */}
      {report.by_floor && (
        <div className="eval-section">
          <h4>Anomali per Lantai</h4>
          <table className="data-table data-table-sm">
            <thead>
              <tr><th>Lantai</th><th>Total</th><th>Anomali</th><th>%</th></tr>
            </thead>
            <tbody>
              {Object.entries(report.by_floor).map(([fl, stats]) => (
                <tr key={fl}>
                  <td>Lantai {fl}</td>
                  <td>{stats.total}</td>
                  <td>{stats.anomaly}</td>
                  <td>{stats.anomaly_pct?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per zona */}
      {report.by_zona && (
        <div className="eval-section">
          <h4>Anomali per Zona</h4>
          <table className="data-table data-table-sm">
            <thead>
              <tr><th>Zona</th><th>Total</th><th>Anomali</th><th>%</th></tr>
            </thead>
            <tbody>
              {Object.entries(report.by_zona).map(([z, stats]) => (
                <tr key={z}>
                  <td>{z}</td>
                  <td>{stats.total}</td>
                  <td>{stats.anomaly}</td>
                  <td>{stats.anomaly_pct?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EvalStat({ label, value }) {
  return (
    <div className="eval-stat">
      <div className="eval-stat-label">{label}</div>
      <div className="eval-stat-value">{value ?? '—'}</div>
    </div>
  );
}

function ConfigField({ label, value, onChange, step = 1, min, max }) {
  return (
    <div className="config-field">
      <label className="config-label">{label}</label>
      <input
        type="number"
        className="form-input"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
