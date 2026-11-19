# SignalMap

SignalMap adalah aplikasi web untuk melihat dan membandingkan kualitas sinyal seluler pada denah beberapa lantai. Aplikasi dibuat dengan React dan Vite, dan berjalan sebagai situs statis.

## Fitur

- Peta sinyal per lantai dan operator.
- Heatmap untuk kualitas sinyal, anomaly score, kecepatan unduh/unggah, ping, jitter, dan packet loss.
- Perbandingan operator, rekomendasi, uji kecepatan, serta halaman pengelolaan model dan kontribusi data.
- Dataset pengujian tersedia di `public/dummy/`.

## Menjalankan lokal

Gunakan Node.js `22.12.0` atau yang lebih baru pada jalur Node 22. Pasang dependency dan jalankan Vite:

```bash
npm ci
npm run dev
```

Buat build produksi dan pratinjau hasilnya dengan:

```bash
npm run build
npm run preview
```

## Deploy gratis dengan Cloudflare Pages

Cloudflare Pages cocok untuk versi demo ini karena aplikasi berupa aset statis dan folder data dapat diterbitkan bersama build.

1. Push folder proyek ini ke sebuah repositori GitHub.
2. Di Cloudflare, buka **Workers & Pages → Create application → Pages → Connect to Git** dan pilih repo tersebut.
3. Isi konfigurasi build:
   - **Framework preset:** React (Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** kosongkan jika isi repo adalah isi folder `signalmap`; isi `signalmap` jika repo berisi folder ini di dalam direktori proyek yang lebih besar.
4. Deploy. Setiap push ke branch produksi akan memicu build dan deployment baru.

Node.js untuk build cloud dipatok lewat `.nvmrc` agar sesuai dengan versi Vite yang digunakan proyek.

## Batas data aplikasi saat ini

Data pengukuran contoh disajikan sebagai file statis. Hasil uji kecepatan, pilihan persetujuan, riwayat training, dan registri model disimpan di `localStorage` browser. Karena belum ada backend atau database bersama, data yang dibuat pengguna tidak tersinkron ke perangkat atau pengguna lain. Gunakan versi ini sebagai demo; untuk pengumpulan data bersama diperlukan backend dan penyimpanan server.

