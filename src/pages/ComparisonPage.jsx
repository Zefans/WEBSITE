import { useState, useMemo } from 'react'
import FloorToggle from '../components/FloorToggle'
import ComparisonView from '../components/ComparisonView'
import StatsCard from '../components/StatsCard'
import { getFloorStats } from '../utils/signalUtils'
import { signalData, PROVIDERS } from '../data/signalData'
import { getProviderColor } from '../utils/colorScale'

export default function ComparisonPage() {
  const [selectedFloor, setSelectedFloor] = useState(1)

  const stats = useMemo(() => {
    return PROVIDERS.map((provider) => {
      const s = getFloorStats(signalData, selectedFloor, provider)
      return { provider, ...s }
    })
  }, [selectedFloor])

  return (
    <div className="page comparison-page">
      <div className="container">
        {/* Header */}
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div className="flex-between flex-wrap gap-md">
            <div>
              <h1>⚖️ Perbandingan Provider</h1>
              <p>Bandingkan kualitas sinyal ketiga provider pada setiap lantai</p>
            </div>
            <div className="flex gap-md" style={{ alignItems: 'center' }}>
              <span className="toolbar-label">Lantai</span>
              <FloorToggle selected={selectedFloor} onChange={setSelectedFloor} />
            </div>
          </div>
        </div>

        {/* Comparison view */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <ComparisonView floor={selectedFloor} />
        </div>

        {/* Stats summary */}
        <h2 style={{ marginBottom: '1rem' }}>📊 Ringkasan Statistik — Lantai {selectedFloor}</h2>
        <div className="stats-row">
          {stats.map(({ provider, avgRsrp, avgRsrq, counts, percentages, total }) => (
            <div className="card" key={provider} style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: getProviderColor(provider),
                    flexShrink: 0,
                  }}
                />
                <h3 style={{ margin: 0 }}>{provider}</h3>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                    {avgRsrp != null ? `${avgRsrp}` : '—'}
                  </div>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Rata-rata RSRP (dBm)</div>
                </div>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                    {total ?? '—'}
                  </div>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Checkpoint</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Excellent', count: counts?.Excellent, cls: 'badge-excellent' },
                  { label: 'Good', count: counts?.Good, cls: 'badge-good' },
                  { label: 'Low', count: counts?.Low, cls: 'badge-low' },
                  { label: 'Bad', count: counts?.Bad, cls: 'badge-bad' },
                ].map((b) => (
                  <span key={b.label} className={`badge ${b.cls}`}>
                    {b.label}: {b.count ?? 0}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
