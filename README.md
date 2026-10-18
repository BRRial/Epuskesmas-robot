# Epuskesmas-robot
mempermudah tenaga kesehatan di wilayah untuk entry pasien

E-PUSKESMAS MODULAR

File:
- index.js: alur utama
- config.js: URL dan selector
- browser.js: koneksi Chrome dan pencarian tab
- auth.js: login
- puskesmas.js: pemilihan Puskesmas
- utils.js: delay dan pilihan menu CMD
- pendaftaran.js: baca Excel dan cari NIK
- Hapus.js: mengahapus pasien yang tidak diperluka
- 

Persiapan:
1. Isi email/password milik Anda di credentials.json.
2. Letakkan pasien.xlsx dengan kolom bernama NIK.

Dependensi:
npm install puppeteer xlsx

