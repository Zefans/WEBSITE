// Script untuk konversi koordinat display → PNG pixel
// Canvas: 900×637 CSS px | PNG: 2000×1414 px
// SX = 2000/900 = 2.2222, SY = 1414/637 = 2.2196

const SX = 2000 / 900;
const SY = 1414 / 637;

// Koordinat DISPLAY (CSS px) berdasarkan analisa screenshot terbaru (lt1.png)
// Screenshot gambar ≈ 710px lebar, skala screenshot = 710/900 = 0.789
// Jadi: display_px = screenshot_px / 0.789

const SS = 710 / 900; // screenshot scale

function toPNG(sx, sy) {
  const dx = sx / SS;  // display px
  const dy = sy / SS;
  return [Math.round(dx * SX), Math.round(dy * SY)];
}

console.log('=== LANTAI 1 ===');
console.log('Ruang Seminar Kiri (kanan atas gedung):');
console.log('  K1 (bawah-dalam):', toPNG(400, 195));  // right block, mid-lower
console.log('  K2 (atas-dalam):', toPNG(400, 165));   // right block, upper

console.log('Ruang Kelas Kanan Atas (kiri atas gedung):');
console.log('  K1:', toPNG(145, 220));   // left black box upper, mid
console.log('  K2:', toPNG(145, 195));   // left black box upper, upper-mid

console.log('Ruang Kelas Kanan Bawah (kiri bawah gedung):');
console.log('  K1:', toPNG(145, 255));   // left black box lower, mid

console.log('Ruang Kelas Kiri (kanan bawah gedung):');
console.log('  K1 (bawah):', toPNG(400, 255));  // right block, lower
console.log('  K2 (atas):', toPNG(400, 225));

console.log('Koridor:');
console.log('  CP08 kiri:', toPNG(100, 300));
console.log('  CP09 tengah-kiri:', toPNG(195, 300));
console.log('  CP10 tengah:', toPNG(275, 300));
console.log('  CP11 kanan:', toPNG(380, 300));

console.log('Outdoor:');
console.log('  CP12 Pintu Barat:', toPNG(55, 230));
console.log('  CP13 Pintu Timur:', toPNG(455, 230));

console.log('Teras:', toPNG(265, 148));
console.log('Tangga:', toPNG(270, 300));

console.log('\n=== LANTAI 2 ===');
console.log('Ruang HME:', toPNG(360, 240));
console.log('Ruang Kelas Kanan K1:', toPNG(430, 240));
console.log('Ruang Kelas Kanan K2:', toPNG(430, 215));
console.log('Ruang Seminar Kanan:', toPNG(430, 185));
console.log('Ruang Operator K1:', toPNG(115, 185));
console.log('Ruang Operator K2:', toPNG(115, 165));
console.log('Ruang Dosen:', toPNG(115, 240));
console.log('Ruang Kecil K1:', toPNG(300, 240));
console.log('Ruang Kecil K2:', toPNG(300, 220));
