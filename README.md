# GPS Tracking System

Sistem pelacakan GPS yang terdiri dari aplikasi driver, aplikasi monitoring, dan server backend untuk pelacakan kendaraan secara real-time dengan dukungan rute optimal dan estimasi biaya tol.

## Fitur Utama

### Aplikasi Driver
- Pelacakan lokasi real-time dengan GPS
- Navigasi rute optimal dengan dukungan GraphHopper API
- Perhitungan estimasi biaya tol berdasarkan golongan kendaraan
- Mode khusus untuk kendaraan berat (HGV) dengan:
  - Pembatasan rute berdasarkan dimensi kendaraan
  - Peringatan untuk tikungan tajam dan hambatan
  - Estimasi biaya tol khusus truk

### Aplikasi Monitoring
- Tampilan real-time posisi semua driver
- Rute alternatif menggunakan OSRM API
- Analisis rute dan estimasi waktu tempuh
- Antarmuka interaktif untuk pemantauan armada

### Server Backend
- Manajemen koneksi WebSocket untuk komunikasi real-time
- Integrasi data jalan tol Indonesia
- Penanganan multiple koneksi driver dan monitor

## Teknologi yang Digunakan

- **Frontend**: React.js dengan Leaflet untuk pemetaan
- **Backend**: Node.js dengan Socket.IO
- **API Routing**:
  - GraphHopper: Rute optimal untuk kendaraan berat
  - OSRM: Rute alternatif dan navigasi umum

## Instalasi dan Penggunaan

### Prasyarat
- Node.js (versi 14 atau lebih baru)
- NPM atau Yarn
- API Key GraphHopper (untuk fitur rute)

### Langkah Instalasi

1. Clone repositori:
```bash
git clone https://github.com/theoxgn/gps-tracking-system.git
cd gps-tracking-system
```

2. Instal dependensi untuk setiap komponen:

```bash
# Server
cd server
npm install

# Aplikasi Driver
cd ../driver-app
npm install

# Aplikasi Monitoring
cd ../monitoring-app
npm install
```

3. Konfigurasi environment:
- Buat file `.env` di folder driver-app:
```
REACT_APP_GRAPHHOPPER_API_KEY=your_api_key_here
REACT_APP_SERVER_URL=http://localhost:3001
```

### Menjalankan Aplikasi

1. Jalankan server:
```bash
cd server
npm start
```

2. Jalankan aplikasi driver:
```bash
cd driver-app
npm start
```

3. Jalankan aplikasi monitoring:
```bash
cd monitoring-app
npm start
```

## Dokumentasi API

### GraphHopper API
- Digunakan untuk rute kendaraan berat dan estimasi biaya tol
- Endpoint: `https://graphhopper.com/api/1/route`
- Mendukung parameter khusus untuk truk:
  - Dimensi (tinggi, berat, lebar, panjang)
  - Jumlah sumbu
  - Preferensi jalan tol

### OSRM API
- Digunakan untuk rute alternatif dan navigasi umum
- Endpoint: `https://router.project-osrm.org/route/v1`
- Mendukung berbagai mode transportasi:
  - Mobil (car)
  - Sepeda (bike)
  - Pejalan kaki (foot)

## Kontribusi

Kontribusi selalu diterima! Silakan buat pull request atau laporkan issues jika menemukan bug atau memiliki saran pengembangan.

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).