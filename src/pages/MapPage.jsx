import { useState, useCallback, useMemo } from 'react'
import FloorPlan from '../components/FloorPlan'
import ProviderSelector from '../components/ProviderSelector'
import FloorToggle from '../components/FloorToggle'
import DetailPanel from '../components/DetailPanel'
import RecommendationPanel from '../components/RecommendationPanel'
import Legend from '../components/Legend'
import { signalData } from '../data/signalData'
import { predictCategory } from '../data/modelPredictions'
import { predictAnomaly } from '../utils/modelManager'

const HEATMAP_MODES = [
  { key: 'rsrp',         label: 'RSRP (Kualitas Sinyal)',    unit: 'dBm' },
  { key: 'anomaly',      label: 'Anomaly Score (IF)',         unit: 'score' },
  { key: 'download',     label: 'Download Speed',             unit: 'Mbps' },
  { key: 'upload',       label: 'Upload Speed',               unit: 'Mbps' },
  { key: 'ping',         label: 'Ping (Latensi)',             unit: 'ms' },
  { key: 'jitter',       label: 'Jitter',                     unit: 'ms' },
  { key: 'packet_loss',  label: 'Packet Loss',                unit: '%' },
];

export default function MapPage() {
  const [selectedProvider, setSelectedProvider] = useState('Telkomsel')
  const [selectedFloor, setSelectedFloor] = useState(1)
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [heatmapMode, setHeatmapMode] = useState('rsrp')

  // Get prediction for the selected checkpoint + provider
  const prediction = useMemo(() => {
    if (!selectedCheckpoint) return null
    const result = predictCategory(
      selectedCheckpoint.x,
      selectedCheckpoint.y,
      selectedCheckpoint.floor,
      selectedCheckpoint.zona,
      selectedProvider
    )
    return result.category
  }, [selectedCheckpoint, selectedProvider])

  // IF anomaly data for selected checkpoint
  const anomalyResult = useMemo(() => {
    if (!selectedCheckpoint) return null
    const cpData = signalData.find(
      (s) => s.checkpoint_id === selectedCheckpoint.id && s.provider === selectedProvider
    )
    if (!cpData) return null
    return {
      nc: predictAnomaly('IF_Network_Condition', cpData),
      ip: predictAnomaly('IF_Internet_Performance', cpData),
    }
  }, [selectedCheckpoint, selectedProvider])

  const handleCheckpointClick = useCallback((checkpoint) => {
    setSelectedCheckpoint(checkpoint)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedCheckpoint(null)
  }, [])

  return (
    <div className="page">
      <div className="map-layout">
        {/* Toolbar */}
        <div className="map-toolbar">
          <div className="toolbar">
            <span className="toolbar-label">Provider</span>
            <ProviderSelector
              selected={selectedProvider}
              onChange={setSelectedProvider}
            />
            <div className="toolbar-separator" />
            <span className="toolbar-label">Lantai</span>
            <FloorToggle
              selected={selectedFloor}
              onChange={setSelectedFloor}
            />
            <div className="toolbar-separator" />
            <div className="switch-container">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showHeatmap}
                  onChange={(e) => setShowHeatmap(e.target.checked)}
                />
                <span className="switch-slider" />
              </label>
              <span className="switch-label">Heatmap</span>
            </div>
            <div className="toolbar-separator" />
            <span className="toolbar-label">Mode</span>
            <select
              className="form-select select-sm toolbar-select"
              value={heatmapMode}
              onChange={(e) => setHeatmapMode(e.target.value)}
            >
              {HEATMAP_MODES.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main floor plan */}
        <div className="map-main card">
          <FloorPlan
            floor={selectedFloor}
            provider={selectedProvider}
            onCheckpointClick={handleCheckpointClick}
            selectedCheckpoint={selectedCheckpoint}
            showHeatmap={showHeatmap}
            heatmapMode={heatmapMode}
          />
        </div>

        {/* Sidebar */}
        <div className="map-sidebar">
          {selectedCheckpoint ? (
            <div className="slide-in">
              <DetailPanel
                checkpoint={selectedCheckpoint}
                signalData={signalData}
                prediction={prediction}
                anomalyResult={anomalyResult}
                onClose={handleCloseDetail}
              />
            </div>
          ) : (
            <div className="card fade-in" style={{ textAlign: 'center', padding: '2rem 1rem', color: '#888' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📍</div>
              <p style={{ fontWeight: 500 }}>Pilih Checkpoint</p>
              <p style={{ fontSize: '0.85rem' }}>
                Klik titik pengukuran pada denah untuk melihat detail kualitas sinyal
              </p>
            </div>
          )}
          <RecommendationPanel
            provider={selectedProvider}
            floor={selectedFloor}
          />
        </div>

        {/* Footer legend */}
        <div className="map-footer">
          <Legend heatmapMode={heatmapMode} />
        </div>
      </div>
    </div>
  )
}
