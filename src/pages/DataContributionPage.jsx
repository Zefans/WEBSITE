import { useState, useEffect, useCallback } from 'react';
import {
  initDB,
  getSpeedTestStats,
  getAllSpeedTests,
} from '../data/db.js';
import { PROVIDERS } from '../data/signalData.js';
import '../components/MLPages.css';

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------
export default function DataContributionPage() {
  const [stats, setStats]   = useState(null);
  const [records, setRecords] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [page, setPage]     = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    initDB();
    refresh();
  }, []);

  const refresh = useCallback(() => {
    setStats(getSpeedTestStats());
    setRecords(getAllSpeedTests());
  }, []);

  if (!stats) {
    return (
      <div className="page">
        <div className="loading">Memuat data…</div>
      </div>
    );
  }

  // ── Filtered records ──
  const filtered = records.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterProvider !== 'all' && r.provider !== filterProvider) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Chart data prep ──
  const providerData = PROVIDERS.map((p) => ({
    label: p,
    count: stats.byProvider[p] || 0,
  }));
  const maxProviderCount = Math.max(1, ...providerData.map((d) => d.count));

  const floorData = Object.entries(stats.byFloor)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([fl, count]) => ({ label: `Lantai ${fl}`, count }));
  const maxFloorCount = Math.max(1, ...floorData.map((d) => d.count));

  const dateEntries = Object.entries(stats.byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30); // 30 hari terakhir
  const maxDateCount = Math.max(1, ...dateEntries.map(([, c]) => c));

  return (
    <div className="page">
      <div className="contrib-layout">
        {/* ── Header ── */}
        <div className="contrib-header">
          <h1 className="contrib-title">📊 Data Contribution</h1>
          <p className="contrib-subtitle">
            Statistik hasil Speed Test yang telah dikumpulkan untuk pengembangan model Isolation Forest.
          </p>
        </div>

        {/* ── Info banner ── */}
        <div className="alert alert-info">
          Hasil Speed Test Anda digunakan secara anonim untuk penelitian dan pengembangan
          model deteksi anomali sinyal di Gedung Teknik Elektro Undana. Tidak ada data
          pribadi yang dikumpulkan atau ditampilkan.
        </div>

        {/* ── Summary cards ── */}
        <div className="summary-grid">
          <SummaryCard
            icon="📋"
            label="Total Pengujian"
            value={stats.total}
            color="var(--color-primary)"
          />
          <SummaryCard
            icon="✅"
            label="Data Valid"
            value={stats.valid}
            color="var(--color-success, #4CAF50)"
          />
          <SummaryCard
            icon="❌"
            label="Data Ditolak"
            value={stats.rejected}
            color="var(--color-danger, #F44336)"
          />
          <SummaryCard
            icon="🤖"
            label="Digunakan untuk Training"
            value={stats.usedForTraining}
            color="var(--color-accent, #2196F3)"
          />
          <SummaryCard
            icon="⏳"
            label="Menunggu Validasi"
            value={stats.pending}
            color="var(--color-warning, #FFC107)"
          />
        </div>

        {/* ── Charts row ── */}
        <div className="charts-row">
          {/* Per Provider */}
          <div className="card chart-card">
            <h3>Distribusi per Provider</h3>
            <div className="bar-chart">
              {providerData.map((d) => (
                <div key={d.label} className="bar-row">
                  <div className="bar-label">{d.label}</div>
                  <div className="bar-track">
                    <div
                      className="bar-fill provider-bar"
                      style={{ width: `${(d.count / maxProviderCount) * 100}%` }}
                    />
                  </div>
                  <div className="bar-value">{d.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Per Lantai */}
          <div className="card chart-card">
            <h3>Distribusi per Lantai</h3>
            <div className="bar-chart">
              {floorData.map((d) => (
                <div key={d.label} className="bar-row">
                  <div className="bar-label">{d.label}</div>
                  <div className="bar-track">
                    <div
                      className="bar-fill floor-bar"
                      style={{ width: `${(d.count / maxFloorCount) * 100}%` }}
                    />
                  </div>
                  <div className="bar-value">{d.count}</div>
                </div>
              ))}
            </div>
            {floorData.length === 0 && <p className="empty-state">Belum ada data.</p>}
          </div>
        </div>

        {/* ── Growth over time ── */}
        <div className="card">
          <h3>Pertumbuhan Dataset (30 hari terakhir)</h3>
          {dateEntries.length === 0 ? (
            <p className="empty-state">Belum ada data.</p>
          ) : (
            <div className="growth-chart">
              {dateEntries.map(([date, count]) => (
                <div key={date} className="growth-bar-col">
                  <div
                    className="growth-bar"
                    style={{ height: `${(count / maxDateCount) * 100}%` }}
                    title={`${date}: ${count}`}
                  />
                  <div className="growth-label">{date.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Checkpoint distribution ── */}
        <div className="card">
          <h3>Distribusi per Checkpoint</h3>
          {Object.keys(stats.byCheckpoint).length === 0 ? (
            <p className="empty-state">Belum ada data.</p>
          ) : (
            <div className="checkpoint-grid">
              {Object.entries(stats.byCheckpoint)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cp, count]) => (
                  <div key={cp} className="checkpoint-pill">
                    <span className="cp-id">{cp}</span>
                    <span className="cp-count">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ── Record list ── */}
        <div className="card">
          <h3>Daftar Pengujian</h3>
          <div className="record-filters">
            <div className="filter-group">
              <label>Status:</label>
              <select
                className="form-select select-sm"
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              >
                <option value="all">Semua</option>
                <option value="valid">Valid</option>
                <option value="rejected">Ditolak</option>
                <option value="used_for_training">Digunakan</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Provider:</label>
              <select
                className="form-select select-sm"
                value={filterProvider}
                onChange={(e) => { setFilterProvider(e.target.value); setPage(0); }}
              >
                <option value="all">Semua</option>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="filter-info">
              {filtered.length} dari {records.length} record
            </div>
          </div>

          {paged.length === 0 ? (
            <p className="empty-state">Tidak ada data yang cocok dengan filter.</p>
          ) : (
            <>
              <div className="record-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Checkpoint</th>
                      <th>Provider</th>
                      <th>Lt</th>
                      <th>Zona</th>
                      <th>DL</th>
                      <th>UL</th>
                      <th>Ping</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => (
                      <tr key={r.id}>
                        <td className="cell-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td><code>{r.checkpoint_id}</code></td>
                        <td>{r.provider}</td>
                        <td>{r.floor}</td>
                        <td>{r.zona}</td>
                        <td>{r.download != null ? `${r.download} Mbps` : '—'}</td>
                        <td>{r.upload != null ? `${r.upload} Mbps` : '—'}</td>
                        <td>{r.ping != null ? `${r.ping} ms` : '—'}</td>
                        <td>
                          <span className={`status-badge ${r.status || 'pending'}`}>
                            {r.status || 'pending'}
                          </span>
                          {r.rejection_reason && (
                            <div className="rejection-hint" title={r.rejection_reason}>
                              ⚠
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn btn-xs"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    ← Sebelumnya
                  </button>
                  <span className="pagination-info">
                    Halaman {page + 1} dari {totalPages}
                  </span>
                  <button
                    className="btn btn-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    Berikutnya →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-komponen
// ---------------------------------------------------------------------------

function SummaryCard({ icon, label, value, color }) {
  return (
    <div className="summary-card" style={{ borderTopColor: color }}>
      <div className="summary-icon">{icon}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-label">{label}</div>
    </div>
  );
}
