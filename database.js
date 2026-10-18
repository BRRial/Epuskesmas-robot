
const XLSX = require('xlsx');
const path = require('path');

// URL database pasien
const DATABASE_URL =
  'https://situbondo.epuskesmas.id/pasien?orderedParam=%7B%22key%22%3A%22%22%2C%22type%22%3A%22%22%7D&page=1&limit=100&typeRecord=&typeVerification=&birthDate=&typeName=&typeTypeSearch=nik_no_asuransi&typeTypeSearchValue=';

// Nama file Excel hasil ekspor
const FILE_EXCEL = path.join(__dirname, 'database_pasien.xlsx');

// Jeda singkat
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================================================
// 1. BUKA HALAMAN DATABASE
// ==================================================
async function bukaDatabase(page) {
  console.log('Membuka database pasien...');

  await page.goto(DATABASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Tunggu tabel muncul jika tersedia
  await page.waitForSelector('table', {
    timeout: 30000
  });

  await delay(1000);

  console.log('Halaman database berhasil dibuka.');
}

// ==================================================
// 2. MEMBACA TABEL PASIEN
// ==================================================
async function ambilTabelPasien(page) {
  return await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));

    // Cari tabel yang memiliki kolom ERM dan NIK
    const tabel = tables.find(table => {
      const header = Array.from(
        table.querySelectorAll('thead th')
      ).map(th => th.innerText.trim().toLowerCase());

      return header.some(h => h.includes('erm')) &&
             header.some(h => h.includes('nik'));
    });

    if (!tabel) {
      throw new Error(
        'Tabel pasien dengan kolom ERM dan NIK tidak ditemukan.'
      );
    }

    const headers = Array.from(
      tabel.querySelectorAll('thead th')
    ).map(th => th.innerText.trim());

    const rows = Array.from(
      tabel.querySelectorAll('tbody tr')
    )
      .map(tr =>
        Array.from(tr.querySelectorAll('td'))
          .map(td => td.innerText.trim())
      )
      .filter(row => row.length > 0);

    return { headers, rows };
  });
}

// ==================================================
// 3. MEMBUKA HALAMAN BERDASARKAN NOMOR PAGE
// ==================================================

async function bukaHalamanDatabase(page, nomorHalaman) {
  console.log(`Menuju halaman ${nomorHalaman}...`);

  // Tunggu pagination tersedia
  await page.waitForSelector('ul.pagination', {
    timeout: 30000
  });

  // Periksa nomor halaman yang sedang aktif
  const halamanAktif = await page.evaluate(() => {
    const aktif = document.querySelector(
      'ul.pagination li.active span'
    );

    return aktif ? aktif.textContent.trim() : null;
  });

  // Jika halaman tujuan sudah aktif, tidak perlu mengekliknya
  if (halamanAktif !== String(nomorHalaman)) {
    const berhasilKlik = await page.evaluate((nomor) => {
      const daftarHalaman = Array.from(
        document.querySelectorAll('ul.pagination li[data-page="next"]')
      );

      const tombol = daftarHalaman.find(li => {
        const span = li.querySelector('span');

        return span &&
          span.textContent.trim() === String(nomor) &&
          li.classList.contains('clickable') &&
          !li.classList.contains('disabled');
      });

      if (!tombol) return false;

      tombol.click();
      return true;
    }, nomorHalaman);

    if (!berhasilKlik) {
      throw new Error(
        `Nomor halaman ${nomorHalaman} tidak ditemukan atau tidak dapat diklik.`
      );
    }

    // Tunggu sampai nomor halaman yang dituju aktif
    await page.waitForFunction((nomor) => {
      const aktif = document.querySelector(
        'ul.pagination li.active span'
      );

      return aktif &&
        aktif.textContent.trim() === String(nomor);
    }, { timeout: 30000 }, nomorHalaman);
  }

  // Tunggu 5 detik sebelum membaca data
  console.log('Menunggu 5 detik...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log(`Halaman aktif: ${nomorHalaman}`);
}

// ==================================================
// 5. Mengambil Database di Epuskesmas
// ==================================================

async function ambilSemuaHalaman(page) {
  const semuaData = [];
  const dataUnik = new Set();

  let nomorHalaman = 1;

  while (true) {
    await bukaHalamanDatabase(page, nomorHalaman);

    const { headers, rows } = await ambilTabelPasien(page);

    console.log(
      `Halaman ${nomorHalaman}: ${rows.length} baris`
    );

    if (nomorHalaman === 1) {
      semuaData.push(headers);
    }

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const kunci = JSON.stringify(row);

      if (!dataUnik.has(kunci)) {
        dataUnik.add(kunci);
        semuaData.push(row);
      }
    }

    // Berhenti jika data kurang dari 100
    if (rows.length < 100) {
      break;
    }

    nomorHalaman++;
  }

  return semuaData;
}
// ==================================================
// 6. SIMPAN DATA KE EXCEL
// ==================================================
async function simpanSemuaHalamanKeExcel(page) {
  console.log('Mulai mengambil seluruh data pasien...');

  const data = await ambilSemuaHalaman(page);

  if (data.length <= 1) {
    console.log('Tidak ada data untuk diekspor.');
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Database Pasien'
  );

  const fileExcel = path.join(
    __dirname,
    'database_pasien.xlsx'
  );

  XLSX.writeFile(workbook, fileExcel);

  console.log(`Ekspor selesai: ${fileExcel}`);
  console.log(`Total data: ${data.length - 1} baris`);
}

// ==================================================
// 6. EXPORT FUNGSI
// ==================================================
module.exports = {
  bukaDatabase,
  bukaHalamanDatabase,
  ambilTabelPasien,
  ambilSemuaHalaman,
  simpanSemuaHalamanKeExcel
};
