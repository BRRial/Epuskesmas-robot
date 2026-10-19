
const fs = require('fs');
const XLSX = require('xlsx');

const {
    PENDAFTARAN_URL,
    EXCEL_FILE,
    SELECTOR
} = require('./config');

const { delay } = require('./utils');

// ======================================================
// 1. MEMBACA DATA DARI EXCEL
// ======================================================

function bacaDataPasien() {
    // Pastikan file Excel tersedia.
    if (!fs.existsSync(EXCEL_FILE)) {
        throw new Error(`File Excel tidak ditemukan: ${EXCEL_FILE}`);
    }

    // Baca file Excel.
    const workbook = XLSX.readFile(EXCEL_FILE, {
        cellText: true,
        cellDates: false
    });

    // Ambil sheet pertama.
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Ubah isi Excel menjadi array objek JavaScript.
    // Nama header Excel menjadi nama properti objek.
    return XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false
    });
}

// ======================================================
// 2. MEMBUKA HALAMAN PENCARIAN PENDAFTARAN
// ======================================================

async function bukaPendaftaran(page) {
    console.log('Membuka halaman pencarian pasien...');

    await page.goto(PENDAFTARAN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    console.log('URL:', page.url());

    // Tunggu kolom pencarian NIK tampil.
    await page.waitForSelector(SELECTOR.nik, {
        visible: true,
        timeout: 30000
    });

    console.log('✓ Halaman pencarian siap.');
}

// ======================================================
// 3. MENEMUKAN TOMBOL CARI
// ======================================================

async function cariTombolCari(page) {
    // Ambil semua tombol yang cocok dengan selector konfigurasi.
    const buttons = await page.$$(SELECTOR.cari);

    for (const button of buttons) {
        const teks = await page.evaluate(
            el => el.textContent.trim().replace(/\s+/g, ' '),
            button
        );

        // Pilih tombol dengan teks "Cari".
        if (teks.toLowerCase() === 'cari') {
            return button;
        }
    }

    return null;
}

// ======================================================
// 4. MENCARI PASIEN BERDASARKAN NIK
// ======================================================

async function cariPasien(page, nik) {
    // Pastikan kolom NIK tersedia.
    await page.waitForSelector(SELECTOR.nik, {
        visible: true,
        timeout: 30000
    });

    // Kosongkan kolom pencarian sebelumnya.
    await page.click(SELECTOR.nik);

    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');

    // Masukkan NIK dari Excel.
    await delay(5000);
    await page.type(SELECTOR.nik, nik, {
        delay: 50
    });

    // Cari tombol Cari.
    const tombolCari = await cariTombolCari(page);

    if (!tombolCari) {
        throw new Error('Tombol Cari tidak ditemukan.');
    }

    // Klik Cari dan tunggu hasilnya diperbarui.
    await tombolCari.click();
    console.log('✓ Pencarian dikirim.');

    await delay(2000);

    // Cari baris tabel yang NIK-nya sama persis.
    const hasil = await page.evaluate((nilaiNIK) => {
        const baris = [
            ...document.querySelectorAll('tbody tr')
        ].find(tr => {
            const kolom = tr.querySelectorAll('td');
            return kolom.length > 5 &&
                kolom[5].textContent.trim() === String(nilaiNIK);
        });

        if (!baris) return null;

        const kolom = baris.querySelectorAll('td');

        return {
            // Ambil sebagai teks agar nol di depan tidak hilang.
            erm: kolom[1].textContent.trim()
        };
    }, nik);

    if (!hasil || !hasil.erm) {
        console.log('✗ Pasien atau nomor ERM tidak ditemukan.');
        return null;
    }

    // Simpan ERM sementara selama program berjalan.
    global.ermSementara = hasil.erm;

    console.log('✓ Nomor ERM ditemukan:', hasil.erm);

    return hasil.erm;
}

// ======================================================
// 5. MEMBUKA HALAMAN DETAIL ERM
// ======================================================

async function bukaHalamanERM(page, erm) {
    // Berdasarkan pola URL yang Anda gunakan:
    // /pasien/show/ + 8 nol + nomor ERM.
    // padStart menjaga format ID menjadi 16 karakter.
    const idPasien = String(erm).padStart(16, '0');

    const urlERM =
        `https://situbondo.epuskesmas.id/pasien/show/${idPasien}`;

    console.log('Membuka halaman detail ERM...');

    await page.goto(urlERM, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    console.log('URL detail:', page.url());
}

// ======================================================
// 6. MENGKLIK TOMBOL PENDAFTARAN
// ======================================================

async function klikPendaftaran(page) {
    const selector = 'a#button_next';

    // Tunggu tombol Pendaftaran muncul.
    await page.waitForSelector(selector, {
        visible: true,
        timeout: 15000
    });

    // Mulai menunggu navigasi sebelum tombol diklik,
    // agar perubahan halaman tidak terlewat.
    const navigasi = page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 30000
    }).catch(() => null);

    await page.click(selector);
    await navigasi;

    console.log('✓ Tombol Pendaftaran diklik.');
    console.log('URL formulir:', page.url());
}

// ======================================================
// 7. MENGISI TINGGI BADAN DARI EXCEL
// ======================================================

async function isiTinggiBadan(page, tinggi) {
    // Jika sel Excel kosong, jangan mengisi apa pun.
    if (tinggi === undefined || String(tinggi).trim() === '') {
        console.log('Tinggi badan kosong di Excel, dilewati.');
        return false;
    }

    // Mendukung angka desimal dengan koma atau titik.
    const nilai = Number(String(tinggi).replace(',', '.'));

    if (!Number.isFinite(nilai) || nilai <= 0) {
        console.log('Nilai tinggi badan tidak valid, dilewati.');
        return false;
    }

    // Pastikan formulir sudah terbuka dan field tersedia.
    await page.waitForSelector('#tinggi_badan', {
        visible: true,
        timeout: 30000
    });

    // Isi field dan kirim event agar perubahan dikenali formulir.
    await page.$eval('#tinggi_badan', (el, value) => {
        el.value = String(value);

        el.dispatchEvent(
            new Event('input', { bubbles: true })
        );

        el.dispatchEvent(
            new Event('change', { bubbles: true })
        );
    }, nilai);

    console.log(`✓ Tinggi badan diisi: ${nilai} cm`);

    return true;
}

// ======================================================
// 8. MENGISI BERAT BADAN DARI EXCEL
// ======================================================

async function isiBeratBadan(page, berat) {
    // Jika sel Excel kosong, jangan mengisi apa pun.
    if (berat === undefined || String(berat).trim() === '') {
        console.log('Berat badan kosong di Excel, dilewati.');
        return false;
    }

    // Mendukung angka desimal dengan koma atau titik.
    const nilai = Number(String(berat).replace(',', '.'));

    if (!Number.isFinite(nilai) || nilai <= 0) {
        console.log('Nilai Berat badan tidak valid, dilewati.');
        return false;
    }

    // Pastikan formulir sudah terbuka dan field tersedia.
    await page.waitForSelector('#berat_badan', {
        visible: true,
        timeout: 30000
    });

    // Isi field dan kirim event agar perubahan dikenali formulir.
    await page.$eval('#berat_badan', (el, value) => {
        el.value = String(value);

        el.dispatchEvent(
            new Event('input', { bubbles: true })
        );

        el.dispatchEvent(
            new Event('change', { bubbles: true })
        );
    }, nilai);

    console.log(`✓ Berat badan diisi: ${nilai} cm`);

    return true;
}

// ======================================================
// 9. Mengisi No HP
// ======================================================

async function isiNomorHP(page, nomorHP) {
    if (
        nomorHP === undefined ||
        String(nomorHP).trim() === ''
    ) {
        console.log('Nomor HP kosong di Excel, dilewati.');
        return false;
    }

    // Hapus spasi dan pastikan nilainya berupa teks.
    const nilai = String(nomorHP).trim();

    await page.waitForSelector('#pasien_no_hp', {
        visible: true,
        timeout: 30000
    });

    // Isi nomor HP tanpa mengubahnya menjadi angka.
    await page.$eval('#pasien_no_hp', (el, value) => {
        el.value = value;

        el.dispatchEvent(
            new Event('input', { bubbles: true })
        );

        el.dispatchEvent(
            new Event('change', { bubbles: true })
        );
    }, nilai);

    console.log('✓ Nomor HP berhasil diisi.');

    return true;
}
// ======================================================
// 10. Memilih sakit atau sehat
// ======================================================

async function pilihStatusKunjungan(page, status) {
    const pilihanDiizinkan = ['SAKIT', 'SEHAT'];
    const nilai = String(status).trim().toUpperCase();

    if (!pilihanDiizinkan.includes(nilai)) {
        throw new Error(
            'Status harus SAKIT atau SEHAT.'
        );
    }

    const selector =
        `input[name="Pendaftaran[status]"][value="${nilai}"]`;

    // Tunggu radio button tersedia.
    await page.waitForSelector(selector, {
        visible: true,
        timeout: 15000
    });

    // Pilih status jika belum terpilih.
    const sudahDipilih = await page.$eval(
        selector,
        el => el.checked
    );

    if (!sudahDipilih) {
        await page.click(selector);
    }

    // Pastikan pilihan berhasil.
    const terpilih = await page.$eval(
        selector,
        el => el.checked
    );

    if (!terpilih) {
        throw new Error(
            `Gagal memilih status ${nilai}.`
        );
    }

    console.log(
        `✓ Status dipilih: KUNJUNGAN ${nilai}`
    );

    return true;
}

// ======================================================
// 11. Memilih Instalasi
// ======================================================


async function pilihInstalasi(page, kode = '01') {
    const selector = `button[name="instalasi_id_${kode}"]`;

    await page.waitForSelector(selector, {
        visible: true,
        timeout: 30000
    });

    const nilaiSaatIni = await page.$eval(
        'input[name="Pelayanan[instalasi_id]"]',
        el => el.value
    );

    if (nilaiSaatIni !== kode) {
        // Jalankan fungsi asli milik halaman.
        await page.evaluate((kode) => {
            if (typeof setOptionRuangan !== 'function') {
                throw new Error(
                    'Fungsi setOptionRuangan tidak tersedia'
                );
            }

            setOptionRuangan(kode);
        }, kode);

        // Tunggu proses AJAX mengisi input instalasi.
        await page.waitForFunction(
            kode => {
                const input = document.querySelector(
                    'input[name="Pelayanan[instalasi_id]"]'
                );

                return input && input.value === kode;
            },
            { timeout: 30000 },
            kode
        );
    }

    // Tunggu tombol poli muncul dari respons AJAX.
    await page.waitForFunction(() => {
        const container = document.querySelector(
            'span[name="ruangan"]'
        );

        return container &&
            container.querySelector('button[name^="ruangan_id_"]');
    }, { timeout: 30000 });

    console.log(`✓ Instalasi ${kode} berhasil dipilih.`);
    console.log('✓ Daftar poli/ruangan sudah dimuat.');
}


// ======================================================
// 12. Memilih Poli
// ======================================================

async function pilihRuangan(page, kode = '0001') {
    const selector = `button[name="ruangan_id_${kode}"]`;

    await page.waitForSelector(selector, {
        visible: true,
        timeout: 30000
    });

    const sudahDipilih = await page.$eval(
        selector,
        el => el.classList.contains('radio-btn-selected')
    );

    if (!sudahDipilih) {
        await page.click(selector);
    }

    await page.waitForFunction(
        kode => {
            const input = document.querySelector(
                'input[name="Pelayanan[ruangan_id]"]'
            );

            return input && input.value === kode;
        },
        { timeout: 30000 },
        kode
    );

    console.log(`✓ Ruangan ${kode} berhasil dipilih.`);
}


// ======================================================
// 14. Klik SImpan
// ======================================================

/**
 * Mengeklik tombol Simpan pada formulir Pendaftaran.
 */
async function klikSimpan(page) {
    const selector = '#button_save';

    // Tunggu sampai tombol Simpan tampil.
    await page.waitForSelector(selector, {
        visible: true,
        timeout: 15000
    });

    // Pastikan tombol dapat digunakan.
    const tombolAktif = await page.$eval(
        selector,
        el => !el.disabled
    );

    if (!tombolAktif) {
        throw new Error('Tombol Simpan belum aktif.');
    }

    console.log('Mengeklik tombol Simpan...');

    // Tunggu navigasi jika penyimpanan memuat halaman baru.
    const navigasi = page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 30000
    }).catch(() => null);

    await page.click(selector);
    await navigasi;

    console.log('✓ Tombol Simpan telah diklik.');
    console.log('URL saat ini:', page.url());
}

// ======================================================
// 15. PROSES SELURUH NIK DARI EXCEL
// ======================================================

async function prosesNIK(page) {
    // Baca daftar pasien dari Excel satu kali.
    const data = bacaDataPasien();

    console.log(`Jumlah baris Excel: ${data.length}`);

    // Proses pasien satu per satu.
    for (let i = 0; i < data.length; i++) {
        // Ambil NIK dan tinggi badan berdasarkan header Excel.
        const nik = String(data[i].NIK || '').trim();
        const tinggi = data[i]['Tinggi Badan'];
        const berat = data[i]['Berat Badan'];
        const nomorHP = data[i]['No HP'];
        const status = data[i]['Status'];

        // Lewati baris yang tidak memiliki NIK.
        if (!nik) {
            console.log(`[${i + 1}] NIK kosong, dilewati.`);
            continue;
        }

        console.log(`\n[${i + 1}/${data.length}] Memulai proses pasien.`);

        try {
            // A. Pastikan kita berada di halaman pencarian.
            await bukaPendaftaran(page);

            // B. Cari pasien berdasarkan NIK.
            const erm = await cariPasien(page, nik);

            if (!erm) {
                console.log('Pasien tidak ditemukan; lanjut ke data berikutnya.');
                continue;
            }

            // C. Buka halaman detail pasien berdasarkan ERM.
            await bukaHalamanERM(page, erm);

            // D. Klik tombol Pendaftaran pada halaman detail.
            await klikPendaftaran(page);

            // E. Isi tinggi badan dari Excel.
            // Field ini harus tersedia pada formulir yang terbuka.
            await delay(2000);
            await isiTinggiBadan(page, tinggi);

            // F. Isi Berat badan dari Excel.
            // Field ini harus tersedia pada formulir yang terbuka.
            await delay(2000);
            await isiBeratBadan(page, berat);

            // G. Isi No Handphone
            // Field ini harus tersedia pada formulir yang terbuka.
            await isiNomorHP(page, nomorHP);

            // H. Isi status.
            // Field ini harus tersedia pada formulir yang terbuka.
            await pilihStatusKunjungan(page, status);

            // instalasi
            await pilihInstalasi(page, '01');

            //pilih Ruangan
            await pilihRuangan(page, '0001');

            //Klik Simpan
            await klikSimpan(page);

            console.log(`✓ Proses data ke-${i + 1} selesai.`);

        } catch (error) {
            // Error satu pasien tidak menghentikan seluruh daftar.
            console.error(
                `✗ Gagal memproses data ke-${i + 1}: ${error.message}`
            );
        }
    }

    console.log('\n✓ Semua data selesai diproses.');
}

// ======================================================
// 9. EKSPOR FUNGSI AGAR BISA DIPAKAI DI index.js
// ======================================================

module.exports = {
    bukaPendaftaran,
    bacaDataPasien,
    prosesNIK,
    cariPasien,
    bukaHalamanERM,
    klikPendaftaran,
    isiTinggiBadan,
    isiBeratBadan,
    isiNomorHP,
    pilihStatusKunjungan,
    pilihInstalasi,
    pilihRuangan,
    klikSimpan
};  
