// ============================================================================
// checkpoints.js — Checkpoint coordinates & building geometry
// SignalMap: Gedung Teknik Elektro, Universitas Nusa Cendana
// Coordinate system: (0,0) = bottom-left of building, meters
// ============================================================================

export const BUILDING_WIDTH = 60;
export const BUILDING_HEIGHT = 20;

// ---------------------------------------------------------------------------
// Building floor geometry
// ---------------------------------------------------------------------------
export const buildingFloors = {
  1: {
    label: 'Lantai 1',
    width: BUILDING_WIDTH,
    height: BUILDING_HEIGHT,
    corridor: { x: 0, y: 10, width: 60, height: 3 }, // y 10-13
    rooms: [
      // South side (y 0–10)
      { id: 'R1-01', label: 'Ruang Dosen',          x: 0,  y: 0,  width: 15, height: 10 },
      { id: 'R1-02', label: 'Lab Telekomunikasi',    x: 15, y: 0,  width: 15, height: 10 },
      { id: 'R1-03', label: 'Lab Komputer',           x: 30, y: 0,  width: 15, height: 10 },
      { id: 'R1-04', label: 'Ruang Kuliah 1',         x: 45, y: 0,  width: 15, height: 10 },
      // North side (y 13–20)
      { id: 'R1-05', label: 'Ruang TU',               x: 0,  y: 13, width: 15, height: 7 },
      { id: 'R1-06', label: 'Lab Elektronika',        x: 15, y: 13, width: 15, height: 7 },
      { id: 'R1-07', label: 'Ruang Kuliah 2',         x: 30, y: 13, width: 15, height: 7 },
      { id: 'R1-08', label: 'Ruang Kuliah 3',         x: 45, y: 13, width: 15, height: 7 },
    ],
    walls: [
      // Outer walls
      { x1: 0,  y1: 0,  x2: 60, y2: 0 },   // south
      { x1: 60, y1: 0,  x2: 60, y2: 20 },  // east
      { x1: 60, y1: 20, x2: 0,  y2: 20 },  // north
      { x1: 0,  y1: 20, x2: 0,  y2: 0 },   // west
      // Corridor boundaries
      { x1: 0,  y1: 10, x2: 60, y2: 10 },
      { x1: 0,  y1: 13, x2: 60, y2: 13 },
      // Room dividers south
      { x1: 15, y1: 0,  x2: 15, y2: 10 },
      { x1: 30, y1: 0,  x2: 30, y2: 10 },
      { x1: 45, y1: 0,  x2: 45, y2: 10 },
      // Room dividers north
      { x1: 15, y1: 13, x2: 15, y2: 20 },
      { x1: 30, y1: 13, x2: 30, y2: 20 },
      { x1: 45, y1: 13, x2: 45, y2: 20 },
    ],
  },
  2: {
    label: 'Lantai 2',
    width: BUILDING_WIDTH,
    height: BUILDING_HEIGHT,
    corridor: { x: 0, y: 10, width: 60, height: 3 },
    rooms: [
      // South side (y 0–10)
      { id: 'R2-01', label: 'Lab Microprocessor',     x: 0,  y: 0,  width: 15, height: 10 },
      { id: 'R2-02', label: 'Lab Jaringan',           x: 15, y: 0,  width: 15, height: 10 },
      { id: 'R2-03', label: 'Ruang Seminar',          x: 30, y: 0,  width: 15, height: 10 },
      { id: 'R2-04', label: 'Ruang Kuliah 4',         x: 45, y: 0,  width: 15, height: 10 },
      // North side (y 13–20)
      { id: 'R2-05', label: 'Lab Listrik',            x: 0,  y: 13, width: 15, height: 7 },
      { id: 'R2-06', label: 'Lab Kendali',            x: 15, y: 13, width: 15, height: 7 },
      { id: 'R2-07', label: 'Ruang Kuliah 5',         x: 30, y: 13, width: 15, height: 7 },
      { id: 'R2-08', label: 'Ruang Kuliah 6',         x: 45, y: 13, width: 15, height: 7 },
    ],
    walls: [
      { x1: 0,  y1: 0,  x2: 60, y2: 0 },
      { x1: 60, y1: 0,  x2: 60, y2: 20 },
      { x1: 60, y1: 20, x2: 0,  y2: 20 },
      { x1: 0,  y1: 20, x2: 0,  y2: 0 },
      { x1: 0,  y1: 10, x2: 60, y2: 10 },
      { x1: 0,  y1: 13, x2: 60, y2: 13 },
      { x1: 15, y1: 0,  x2: 15, y2: 10 },
      { x1: 30, y1: 0,  x2: 30, y2: 10 },
      { x1: 45, y1: 0,  x2: 45, y2: 10 },
      { x1: 15, y1: 13, x2: 15, y2: 20 },
      { x1: 30, y1: 13, x2: 30, y2: 20 },
      { x1: 45, y1: 13, x2: 45, y2: 20 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Checkpoints — ~20 per floor, distributed across rooms, corridor, entrances
// zona: 'Indoor' (inside rooms), 'Semi-outdoor' (corridor near doors),
//        'Outdoor' (near building exits at corridor ends)
// ---------------------------------------------------------------------------
export const checkpoints = [
  // ===================== FLOOR 1 =====================
  // Lt1_Ruang1 → Ruang Seminar Kiri (kanan-atas gedung utama)
  { id: 'F1-CP01', x: 52, y: 5,  floor: 1, zona: 'Indoor',       label: 'Ruang Seminar Kiri - K1' },
  { id: 'F1-CP02', x: 48, y: 8,  floor: 1, zona: 'Indoor',       label: 'Ruang Seminar Kiri - K2' },
  // Lt1_Ruang2 → Ruang Kelas Kanan Lantai 1 atas (kiri-atas gedung)
  { id: 'F1-CP03', x: 7,  y: 5,  floor: 1, zona: 'Indoor',       label: 'Ruang Kelas Kanan Atas - K1' },
  { id: 'F1-CP04', x: 7,  y: 8,  floor: 1, zona: 'Indoor',       label: 'Ruang Kelas Kanan Atas - K2' },
  // Lt1_Ruang3 → Ruang Kelas Kanan Lantai 1 bawah (kiri-bawah gedung)
  { id: 'F1-CP05', x: 7,  y: 3,  floor: 1, zona: 'Indoor',       label: 'Ruang Kelas Kanan Bawah - K1' },
  // Lt1_Ruang4 → Ruang Kelas Kiri Lantai 1 (kanan-bawah gedung)
  { id: 'F1-CP06', x: 52, y: 3,  floor: 1, zona: 'Indoor',       label: 'Ruang Kelas Kiri - K1' },
  { id: 'F1-CP07', x: 48, y: 5,  floor: 1, zona: 'Indoor',       label: 'Ruang Kelas Kiri - K2' },
  // Koridor
  // Outdoor
  { id: 'F1-CP12', x: 26, y: 11, floor: 1, zona: 'Indoor', label: 'Gedung Utama LT1 - Titik 1' },
  { id: 'F1-CP13', x: 34, y: 11, floor: 1, zona: 'Indoor', label: 'Gedung Utama LT1 - Titik 2' },
  // Teras
  { id: 'F1-CP14', x: 30, y: 19, floor: 1, zona: 'Semi-outdoor', label: 'Teras dan Pintu Masuk Utama' },
  // Lab LT1
  { id: 'F1-CP15', x: 25, y: 2,  floor: 1, zona: 'Indoor',       label: 'RL2 LT1 - Kiri Atas' },
  { id: 'F1-CP16', x: 35, y: 2,  floor: 1, zona: 'Indoor',       label: 'RL1 LT1 - Kanan Atas' },
  { id: 'F1-CP17', x: 25, y: 0,  floor: 1, zona: 'Indoor',       label: 'RL3 LT1 - Kiri Bawah' },
  { id: 'F1-CP18', x: 35, y: 0,  floor: 1, zona: 'Indoor',       label: 'RL4 LT1 - Kanan Bawah' },
  { id: 'F1-CP19', x: 30, y: 1,  floor: 1, zona: 'Indoor',       label: 'Lab LT1 - Tangga' },
  // Tangga
  { id: 'F1-CP20', x: 30, y: 11.5, floor: 1, zona: 'Semi-outdoor', label: 'Tangga Utama Lantai 1' },

  // ===================== FLOOR 2 =====================
  // Lt2_Ruang1 → Ruang HME (kanan tangga, tengah-bawah gedung)
  { id: 'F2-CP01', x: 42, y: 11, floor: 2, zona: 'Semi-outdoor', label: 'Ruang HME - K1' },
  { id: 'F2-CP02', x: 42, y: 12, floor: 2, zona: 'Semi-outdoor', label: 'Ruang HME - K2' },
  // Lt2_Ruang2 → Ruang Kelas Kanan Lantai 2 (kanan-bawah gedung)
  { id: 'F2-CP03', x: 52, y: 3,  floor: 2, zona: 'Indoor',       label: 'Ruang Kelas Kanan Lt2 - K1' },
  { id: 'F2-CP04', x: 52, y: 5,  floor: 2, zona: 'Indoor',       label: 'Ruang Kelas Kanan Lt2 - K2' },
  // Lt2_Ruang3 → Ruang Seminar Kanan Lantai 2 (kanan-atas gedung)
  { id: 'F2-CP05', x: 52, y: 8,  floor: 2, zona: 'Indoor',       label: 'Ruang Seminar Kanan Lt2 - K1' },
  // Lt2_Ruang4 → Ruang Operator Lantai 2 (kiri-atas gedung)
  { id: 'F2-CP06', x: 7,  y: 8,  floor: 2, zona: 'Indoor',       label: 'Ruang Operator Lt2 - K1' },
  { id: 'F2-CP07', x: 7,  y: 10, floor: 2, zona: 'Indoor',       label: 'Ruang Operator Lt2 - K2' },
  // Koridor
  { id: 'F2-CP08', x: 7,  y: 11, floor: 2, zona: 'Semi-outdoor', label: 'Koridor - Depan Ruang Operator' },
  { id: 'F2-CP09', x: 30, y: 11, floor: 2, zona: 'Semi-outdoor', label: 'Koridor - Lorong Bawah' },
  { id: 'F2-CP10', x: 52, y: 11, floor: 2, zona: 'Semi-outdoor', label: 'Koridor - Depan Ruang Seminar' },
  // Lt2_Ruang5 → Ruang Dosen Lantai 2 (kiri-bawah gedung)
  { id: 'F2-CP14', x: 7,  y: 3,  floor: 2, zona: 'Indoor',       label: 'Ruang Dosen Lt2 - K1' },
  // Lt2_Ruang6 → Ruang Kecil (kiri tangga, tengah-bawah gedung)
  { id: 'F2-CP15', x: 25, y: 11, floor: 2, zona: 'Semi-outdoor', label: 'Ruang Kecil Lt2 - K1' },
  { id: 'F2-CP16', x: 25, y: 12, floor: 2, zona: 'Semi-outdoor', label: 'Ruang Kecil Lt2 - K2' },
  // Lab LT2
  { id: 'F2-CP17', x: 25, y: 2,  floor: 2, zona: 'Indoor',       label: 'Ruang Lab LT2 - Kiri' },
  { id: 'F2-CP18', x: 35, y: 2,  floor: 2, zona: 'Indoor',       label: 'Ruang Lab Lantai 2 - Kanan' },
  { id: 'F2-CP19', x: 30, y: 1,  floor: 2, zona: 'Indoor',       label: 'Lab LT2 - Tangga' },
  // Tangga utama Lt2
  { id: 'F2-CP20', x: 30, y: 11.5, floor: 2, zona: 'Semi-outdoor', label: 'Tangga Utama Lantai 2' },

  // Titik K2 yang sebelumnya belum dialokasikan untuk dua ruang walk-test.
  { id: 'F1-CP21', x: 9, y: 3.5, floor: 1, zona: 'Indoor', label: 'Ruang Kelas Kanan Bawah - K2' },
  { id: 'F2-CP21', x: 54, y: 7, floor: 2, zona: 'Indoor', label: 'Ruang Seminar Kanan Lt2 - K2' },
  { id: 'F2-CP22', x: 9, y: 3.5, floor: 2, zona: 'Indoor', label: 'Ruang Dosen Lt2 - K2' },

  // K2 untuk empat ruang pada blok laboratorium lantai 1.
  { id: 'F1-CP22', x: 27, y: 2, floor: 1, zona: 'Indoor', label: 'RL2 LT1 - K2' },
  { id: 'F1-CP23', x: 37, y: 2, floor: 1, zona: 'Indoor', label: 'RL1 LT1 - K2' },
  { id: 'F1-CP24', x: 27, y: 0.5, floor: 1, zona: 'Indoor', label: 'RL3 LT1 - K2' },
  { id: 'F1-CP25', x: 37, y: 0.5, floor: 1, zona: 'Indoor', label: 'RL4 LT1 - K2' },

  // Dua koordinat per area parkir/lopo yang ditandai pada denah lantai 1.
  { id: 'F1-CP26', x: 12, y: 17, floor: 1, zona: 'Outdoor', label: 'Lopo dan Parkiran Kanan - Titik 1' },
  { id: 'F1-CP27', x: 15, y: 16, floor: 1, zona: 'Outdoor', label: 'Lopo dan Parkiran Kanan - Titik 2' },
  { id: 'F1-CP28', x: 45, y: 17, floor: 1, zona: 'Outdoor', label: 'Parkiran Kiri - Titik 1' },
  { id: 'F1-CP29', x: 48, y: 16, floor: 1, zona: 'Outdoor', label: 'Parkiran Kiri - Titik 2' },
  { id: 'F1-CP30', x: 7, y: 6, floor: 1, zona: 'Outdoor', label: 'Lopo Parkiran Belakang - Titik 1' },
  { id: 'F1-CP31', x: 9, y: 5.5, floor: 1, zona: 'Outdoor', label: 'Lopo Parkiran Belakang - Titik 2' },
  { id: 'F1-CP32', x: 43, y: 6, floor: 1, zona: 'Outdoor', label: 'Parkiran Panjang Belakang - Titik 1' },
  { id: 'F1-CP33', x: 50, y: 5.5, floor: 1, zona: 'Outdoor', label: 'Parkiran Panjang Belakang - Titik 2' },
  { id: 'F1-CP34', x: 30, y: 6.5, floor: 1, zona: 'Semi-outdoor', label: 'Lorong Belakang - Titik 1' },
  { id: 'F1-CP35', x: 30, y: 4.5, floor: 1, zona: 'Semi-outdoor', label: 'Lorong Belakang - Titik 2' },

  // K2 untuk dua ruang kecil laboratorium pada denah lantai 2.
  { id: 'F2-CP23', x: 26, y: 0.5, floor: 2, zona: 'Indoor', label: 'Ruang Lab LT2 Kiri - K2' },
  { id: 'F2-CP24', x: 36, y: 0.5, floor: 2, zona: 'Indoor', label: 'Ruang Lab LT2 Kanan - K2' },

  // Dua titik pengukuran tambahan untuk area Lab LT2, dekat titik lab yang ada.
  { id: 'F2-CP25', x: 28, y: 1.5, floor: 2, zona: 'Indoor', label: 'Lab LT2 - K1' },
  { id: 'F2-CP26', x: 32, y: 1.5, floor: 2, zona: 'Indoor', label: 'Lab LT2 - K2' },
];

