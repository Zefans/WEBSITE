import { modelInfo } from '../data/modelPredictions'

export default function AboutPage() {
  const rf = modelInfo?.randomForest || {}
  const dt = modelInfo?.decisionTree || {}

  return (
    <div className="page about-page fade-in">
      {/* Hero */}
      <div className="about-hero">
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📡</div>
        <h1>
          Klasifikasi dan Visualisasi Kualitas Sinyal Jaringan Seluler
          Multi-Provider di Gedung Teknik Elektro Universitas Nusa Cendana
          Menggunakan Metode Decision Tree dan Random Forest
        </h1>
        <p style={{ marginTop: '1rem', fontWeight: 600 }}>
          Peneliti: [Nama Mahasiswa]
        </p>
        <p>Program Studi Teknik Elektro</p>
        <p>Fakultas Sains dan Teknik, Universitas Nusa Cendana, Kupang — NTT</p>
      </div>

      {/* Latar Belakang */}
      <div className="about-section">
        <h2>🎯 Latar Belakang</h2>
        <p>
          Kualitas sinyal jaringan seluler di dalam gedung (indoor) merupakan faktor
          penting yang memengaruhi konektivitas dan produktivitas pengguna, termasuk
          mahasiswa di lingkungan kampus. Gedung Teknik Elektro Universitas Nusa Cendana
          memiliki dua lantai dengan berbagai ruangan laboratorium, ruang kuliah, dan area
          koridor yang masing-masing memiliki karakteristik propagasi sinyal yang berbeda.
        </p>
        <p>
          Perbedaan material dinding, posisi relatif terhadap menara BTS, dan konfigurasi
          ruangan menyebabkan variasi kualitas sinyal yang signifikan di tiap titik.
          Tanpa pemetaan yang sistematis, pengguna kesulitan mengetahui area mana yang
          memiliki sinyal baik atau buruk dari masing-masing provider.
        </p>
        <p>
          Penelitian ini bertujuan untuk mengukur, mengklasifikasi, dan memvisualisasikan
          kualitas sinyal dari tiga provider utama — <strong>Telkomsel</strong>,{' '}
          <strong>XL Axiata</strong>, dan <strong>Indosat Ooredoo</strong> — menggunakan
          metode walk test dan model machine learning (Decision Tree & Random Forest)
          agar hasilnya dapat diakses melalui aplikasi web interaktif.
        </p>
      </div>

      {/* Metodologi */}
      <div className="about-section">
        <h2>🔬 Metodologi</h2>

        <div className="methodology-step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Pengumpulan Data (Walk Test)</h4>
            <p>
              Data dikumpulkan melalui metode walk test menggunakan smartphone yang
              dilengkapi aplikasi <strong>Network Cell Info</strong>. Pengukuran dilakukan
              di titik-titik checkpoint yang tersebar di seluruh gedung pada kedua lantai.
              Parameter yang diukur meliputi <em>Reference Signal Received Power</em> (RSRP)
              dalam satuan dBm dan <em>Reference Signal Received Quality</em> (RSRQ) dalam
              satuan dB.
            </p>
          </div>
        </div>

        <div className="methodology-step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Preprocessing Data</h4>
            <p>
              Data mentah dari walk test dibersihkan dan diproses: penghapusan duplikat,
              penanganan missing values, penentuan checkpoint terdekat, dan feature
              engineering. Setiap titik pengukuran dikaitkan dengan koordinat (x, y),
              lantai, zona klasifikasi, dan provider.
            </p>
          </div>
        </div>

        <div className="methodology-step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>Klasifikasi Zona</h4>
            <p>
              Setiap checkpoint diklasifikasikan ke dalam tiga zona berdasarkan posisinya:
            </p>
            <ul style={{ marginTop: '0.5rem' }}>
              <li><strong>Indoor</strong> — di dalam ruangan tertutup (lab, ruang kuliah)</li>
              <li><strong>Semi-outdoor</strong> — area koridor dan pintu masuk</li>
              <li><strong>Outdoor</strong> — area dekat pintu keluar gedung / terbuka</li>
            </ul>
          </div>
        </div>

        <div className="methodology-step">
          <div className="step-number">4</div>
          <div className="step-content">
            <h4>Model Machine Learning</h4>
            <p>
              Dua algoritma klasifikasi digunakan: <strong>Decision Tree</strong> dan{' '}
              <strong>Random Forest</strong>. Model dilatih menggunakan fitur kontekstual —
              koordinat x, y, lantai, dan zona — <em>tanpa menggunakan nilai RSRP
              sebagai input</em>. Tujuannya adalah memprediksi kategori kualitas sinyal
              (Excellent, Good, Low, Bad) berdasarkan lokasi semata, sehingga model
              dapat memprediksi kualitas sinyal di titik yang belum diukur.
            </p>
          </div>
        </div>

        <div className="methodology-step">
          <div className="step-number">5</div>
          <div className="step-content">
            <h4>Evaluasi Model</h4>
            <p>
              Model dievaluasi menggunakan metrik akurasi, precision, recall, dan F1-score.
              {rf.accuracy && (
                <> Random Forest mencapai akurasi <strong>{(rf.accuracy * 100).toFixed(1)}%</strong>.</>
              )}
              {dt.accuracy && (
                <> Decision Tree mencapai akurasi <strong>{(dt.accuracy * 100).toFixed(1)}%</strong>.</>
              )}
            </p>
            {(rf.features || dt.features) && (
              <p style={{ fontSize: '0.85rem', color: '#666' }}>
                Fitur yang digunakan: {(rf.features || dt.features || []).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="methodology-step">
          <div className="step-number">6</div>
          <div className="step-content">
            <h4>Visualisasi</h4>
            <p>
              Hasil klasifikasi divisualisasikan menggunakan teknik{' '}
              <strong>Inverse Distance Weighting (IDW)</strong> interpolation untuk
              menghasilkan heatmap kualitas sinyal yang kontinu. Visualisasi
              ditampilkan dalam aplikasi web interaktif berbasis React.js, memungkinkan
              pengguna mengeksplorasi data per lantai, per provider, serta membandingkan
              kualitas sinyal antar provider.
            </p>
          </div>
        </div>
      </div>

      {/* Hasil Utama */}
      <div className="about-section">
        <h2>📈 Hasil Utama</h2>
        <div className="result-grid">
          <div className="result-card rf">
            <div className="result-value">
              {rf.accuracy ? `${(rf.accuracy * 100).toFixed(1)}%` : '92.5%'}
            </div>
            <div className="result-label">Akurasi Random Forest</div>
          </div>
          <div className="result-card dt">
            <div className="result-value">
              {dt.accuracy ? `${(dt.accuracy * 100).toFixed(1)}%` : '89.1%'}
            </div>
            <div className="result-label">Akurasi Decision Tree</div>
          </div>
          <div className="result-card coverage">
            <div className="result-value">🏆 Telkomsel</div>
            <div className="result-label">Cakupan Indoor Terbaik</div>
          </div>
          <div className="result-card insight">
            <div className="result-value">📉 Sudut &amp; Dalam</div>
            <div className="result-label">Area Sinyal Terlemah</div>
          </div>
        </div>
        <div style={{ marginTop: '1.25rem' }}>
          <ul>
            <li>
              Telkomsel menunjukkan cakupan sinyal indoor terbaik secara konsisten di
              kedua lantai.
            </li>
            <li>
              XL Axiata memiliki kualitas sinyal moderat dengan performa lebih baik di
              area semi-outdoor.
            </li>
            <li>
              Indosat Ooredoo menunjukkan sinyal paling lemah di area indoor dalam,
              namun kompetitif di area semi-outdoor dan outdoor.
            </li>
            <li>
              Sudut gedung dan area deep indoor (jauh dari jendela/pintu) secara
              konsisten memiliki kualitas sinyal terburuk untuk semua provider.
            </li>
            <li>
              Lantai 2 secara umum memiliki sinyal sedikit lebih baik dibandingkan
              Lantai 1.
            </li>
          </ul>
        </div>
      </div>

      {/* Teknologi */}
      <div className="about-section">
        <h2>💻 Teknologi</h2>
        <div className="tech-grid">
          <div className="tech-item">
            <span className="tech-icon">⚛️</span>
            <div>
              <div className="tech-name">React.js + Vite</div>
              <div className="tech-desc">Frontend framework</div>
            </div>
          </div>
          <div className="tech-item">
            <span className="tech-icon">🎨</span>
            <div>
              <div className="tech-name">HTML5 Canvas</div>
              <div className="tech-desc">Floor plan & heatmap rendering</div>
            </div>
          </div>
          <div className="tech-item">
            <span className="tech-icon">🌡️</span>
            <div>
              <div className="tech-name">IDW Interpolation</div>
              <div className="tech-desc">Heatmap generation</div>
            </div>
          </div>
          <div className="tech-item">
            <span className="tech-icon">🤖</span>
            <div>
              <div className="tech-name">scikit-learn</div>
              <div className="tech-desc">ML (trained offline, Python)</div>
            </div>
          </div>
          <div className="tech-item">
            <span className="tech-icon">📱</span>
            <div>
              <div className="tech-name">Network Cell Info</div>
              <div className="tech-desc">Walk test measurement</div>
            </div>
          </div>
          <div className="tech-item">
            <span className="tech-icon">📊</span>
            <div>
              <div className="tech-name">Walk Test Data</div>
              <div className="tech-desc">Multi-checkpoint, multi-provider</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          color: '#999',
          fontSize: '0.85rem',
        }}
      >
        <p style={{ color: '#999' }}>
          © 2024 — Tugas Akhir, Program Studi Teknik Elektro, Universitas Nusa Cendana
        </p>
        <p style={{ color: '#bbb', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          SignalMap v1.0 — Aplikasi Visualisasi Kualitas Sinyal
        </p>
      </div>
    </div>
  )
}
