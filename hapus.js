
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

// Nama Excel khusus untuk proses Hapus Pasien
const EXCEL_FILE = path.join(__dirname, 'hapus.xlsx');

const {
    PENDAFTARAN_URL,
    SELECTOR
} = require('./config');

const { delay } = require('./utils');

console.log('hapus_pasien.js mulai dijalankan');

// ======================================================
// 1. MEMBACA DATA DARI EXCEL
// ======================================================

function bacaDataPasien() {
    if (!fs.existsSync(EXCEL_FILE)) {
        throw new Error(`File Excel tidak ditemukan: ${EXCEL_FILE}`);
    }

    const workbook = XLSX.readFile(EXCEL_FILE, {
        cellText: true,
        cellDates: false
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    return XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false
    });
}

// ======================================================
// 2. MEMBACA RIWAYAT PASIEN
// ======================================================
async function cekRiwayat(page) {
    console.log('Membuka riwayat pasien...');

    await page.waitForSelector('#button_modal', {
        visible: true,
        timeout: 30000
    });

    await page.click('#button_modal');

    await page.waitForSelector('#accordion', {
        visible: true,
        timeout: 15000
    });

    // Tunggu konten riwayat dimuat
    await delay(2000);

    const hasil = await page.evaluate(() => {
        const accordion = document.querySelector('#accordion');

        if (!accordion) {
            return {
                status: 'TIDAK_DIKETAHUI',
                jumlahRiwayat: 0
            };
        }

        const daftarRiwayat =
            accordion.querySelectorAll('#table_data');

        return {
            status: daftarRiwayat.length > 0
                ? 'ADA_RIWAYAT'
                : 'KOSONG',
            jumlahRiwayat: daftarRiwayat.length
        };
    });

    console.log('Hasil pemeriksaan:', hasil);

    // Tutup modal setelah pemeriksaan
    await page.waitForSelector('#button_close', {
        visible: true,
        timeout: 10000
    });

    await page.click('#button_close');

    // Pastikan modal sudah tertutup
    await page.waitForFunction(() => {
        const tombol = document.querySelector('#button_close');

        return !tombol ||
            tombol.offsetParent === null;
    }, { timeout: 10000 });

    console.log('Modal riwayat sudah ditutup.');

    return hasil;
}


// ======================================================
// 3. MEMBUKA HALAMAN DETAIL ERM
// ======================================================


async function bukaHalamanERM(page, erm) {
    // Pertahankan angka nol di depan.
    let nomorERM = String(erm).trim();

    if (!nomorERM) {
        throw new Error('Nomor ERM kosong.');
    }

    // Jika ERM kurang dari 16 karakter, tambahkan nol di depan.
    const idPasien = nomorERM.padStart(16, '0');

    const urlERM =
        `https://situbondo.epuskesmas.id/pasien/show/${idPasien}`;

    console.log('Nomor ERM Excel:', nomorERM);
    console.log('ID pasien URL:', idPasien);
    console.log('Membuka URL:', urlERM);

    await page.goto(urlERM, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    await delay(5000);

    console.log('URL saat ini:', page.url());
}

async function periksaTombolHapus(page) {
    const info = await page.evaluate(() => {
        const tombol = document.querySelector('#button_delete');

        if (!tombol) {
            return {
                ditemukan: false,
                pesan: 'Tombol Hapus tidak ditemukan.'
            };
        }

        return {
            ditemukan: true,
            teks: tombol.innerText.trim(),
            aktif: !tombol.disabled,
            fungsi: tombol.getAttribute('onclick')
        };
    });

    console.log('Pemeriksaan tombol Hapus:', info);

    return info;
}

async function hapusPasien(page) {
  // Pantau sebelum tombol diklik
  const pantauRespons = page.waitForResponse(
    response =>
      response.url().includes('/pasien/delete') &&
      response.request().method() === 'POST',
    { timeout: 15000 }
  ).catch(() => null);

  page.on('console', msg => {
    console.log('[Browser]', msg.text());
  });

  page.on('pageerror', error => {
    console.log('[JavaScript Error]', error.message);
  });

  await page.waitForSelector('#button_delete', {
    visible: true,
    timeout: 20000
  });

  // Pastikan tombol terlihat di layar
await page.$eval('#button_delete', el => {
  el.scrollIntoView({
    block: 'center',
    inline: 'center'
  });
});

// Tunggu 500 milidetik
await new Promise(resolve => setTimeout(resolve, 500));

// Periksa fungsi halaman
const status = await page.evaluate(() => ({
  tombolAda: !!document.querySelector('#button_delete'),
  fungsiAda: typeof window.deleteData === 'function',
  jqueryAda: typeof window.$ === 'function'
}));

console.log('Status halaman:', status);

  if (!status.tombolAda || !status.fungsiAda || !status.jqueryAda) {
    throw new Error(
      'Tombol, fungsi deleteData, atau jQuery belum tersedia.'
    );
  }

  // Klik tombol melalui interaksi Puppeteer
  await page.click('#button_delete', { delay: 120 });

  console.log('Tombol Hapus diklik. Menunggu respons server...');

  const response = await pantauRespons;

  if (!response) {
    console.log(
      'Permintaan POST tidak terdeteksi dalam 15 detik.'
    );
    return;
  }

  //console.log('HTTP status:', response.status());

  try {
    const data = await response.json();

    console.log('Respons aplikasi:', {
      status: data.status,
      message: data.message,
      message_klinisia: data.message_klinisia
    });
  } catch {
    console.log('Respons diterima, tetapi bukan JSON yang dapat dibaca.');
  }
}


// ======================================================
// 3. MEMBUKA ERM SESUAI DATA EXCEL
// ======================================================

async function prosesSemuaERM(page) {
    console.log('Fungsi prosesSemuaERM dipanggil');

    const daftarPasien = bacaDataPasien();

    console.log('Jumlah data Excel:', daftarPasien.length);

    if (daftarPasien.length === 0) {
        console.log('Excel tidak berisi data pasien.');
        return;
    }

    for (let i = 0; i < daftarPasien.length; i++) {
        const pasien = daftarPasien[i];

        // Sesuaikan dengan nama header kolom Excel Anda.
        const kolomERM = Object.keys(pasien).find(kolom => {
        const namaKolom = kolom
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');

    return namaKolom === 'noerm';
        });

const erm = kolomERM ? pasien[kolomERM] : '';   

        if (!String(erm).trim()) {
            console.log(
                `Baris ${i + 2}: nomor ERM kosong, dilewati.`
            );
            continue;
        }

        console.log(
            `Memproses pasien ${i + 1} dari ${daftarPasien.length}`
        );

        
        try {
            await bukaHalamanERM(page, erm);
            const hasilRiwayat = await cekRiwayat(page);

            if (hasilRiwayat.status === 'ADA_RIWAYAT') {
                console.log(
                    `ERM ${erm}: memiliki riwayat. Pasien dilewati.`
                );
                continue;
            }

            if (hasilRiwayat.status !== 'KOSONG') {
                console.log(
                    `ERM ${erm}: riwayat tidak dapat dipastikan. Pasien dilewati.`
                );
                continue;
            }

            console.log(
                `ERM ${erm}: riwayat kosong dan modal sudah ditutup.`
            );

            // Lanjutkan ke tahap verifikasi penghapusan di sini.

            await periksaTombolHapus(page);

            //
            page.on('request', req => {
            if (req.url().includes('/pasien/delete')) {
                console.log('Permintaan:', req.method(), req.url());
            }
            });

            page.on('response', async response => {
            if (
                response.url().includes('/pasien/delete') &&
                response.request().method() === 'POST'
            ) {
                console.log('Respons penghapusan:', response.status());

                try {
                const data = await response.json();
                console.log('Hasil aplikasi:', data);
                } catch (error) {
                console.log('Respons bukan JSON atau tidak dapat dibaca.');
                }
            }
            });

            page.on('console', msg => {
            console.log('Browser:', msg.text());
            });

            page.on('pageerror', err => {
            console.log('JavaScript error:', err.message);
            });
            await hapusPasien(page);

            // Pastikan identitas pasien dan tombol tindakan
            // telah diverifikasi terlebih dahulu.
        } catch (error) {
            console.error(
                `Gagal memproses ERM ${erm}: ${error.message}`
            );
        }

    }

    console.log('Selesai memproses daftar ERM dari Excel.');
}


// ======================================================
// 4. EXPORT FUNGSI
// ======================================================

module.exports = {
    bacaDataPasien,
    bukaHalamanERM,
    cekRiwayat,
    periksaTombolHapus,
    hapusPasien,
    prosesSemuaERM
};
