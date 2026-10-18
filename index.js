
const { delay, pilihMenu } = require('./utils');
const { hubungkanChrome, cariTabEPuskesmas } = require('./browser');
const { bukaHalamanLogin, login } = require('./auth');
const { pilihPuskesmas } = require('./puskesmas');
const { bukaPendaftaran, prosesNIK } = require('./pendaftaran');
const {
  bukaDatabase,
  simpanSemuaHalamanKeExcel
} = require('./database');

const {
    prosesSemuaERM
} = require('./hapus');


(async () => {
    let browser;

    try {
        console.log('\n========================================');
        console.log('       E-PUSKESMAS AUTOMATION');
        console.log('========================================');

        // 1. Hubungkan Chrome satu kali
        console.log('\n[1] Menghubungkan ke Chrome...');

        browser = await hubungkanChrome();

        console.log('✓ Chrome terhubung');

        // 2. Cari tab e-Puskesmas
        console.log('\n[2] Mencari tab e-Puskesmas...');

        let page = await cariTabEPuskesmas(browser);

        if (!page) {
            console.log('Tab belum ada; membuka tab baru.');

            page = await browser.newPage();

            await bukaHalamanLogin(page);
        } else {
            console.log('✓ Tab e-Puskesmas ditemukan');
        }

        console.log('URL saat ini:', page.url());

        // 3. Login jika diperlukan
        if (page.url().includes('/login')) {
            console.log('\n[3] Menjalankan proses login...');

            await login(page);
        } else {
            console.log('\n[3] Melewati proses login.');
        }

        await delay(1500);

        // 4. Pilih Puskesmas satu kali
        console.log('\n[4] Memeriksa pilihan Puskesmas...');

        await pilihPuskesmas(page);

        console.log('✓ Persiapan selesai');

        // 5. Menu utama berulang
        while (true) {
            const pilihan = await pilihMenu();

            try {
                if (pilihan === 'pendaftaran') {
                    console.log('\nMembuka menu Pendaftaran...');

                    await bukaPendaftaran(page);
                    await prosesNIK(page);

                    console.log('\n✓ Proses Pendaftaran selesai.');
                } else if (pilihan === 'pelayanan') {
                    console.log('\nMenu Pelayanan dipilih.');
                    console.log('Menu Pelayanan belum dikonfigurasi.');
                } else if (pilihan === 'database') {
                    console.log('\nMembuka Menu database.');

                    await bukaDatabase(page);
                    await simpanSemuaHalamanKeExcel(page);
                }
                else if (pilihan === 'hapus') {
                    console.log('\nMembuka Menu Hapus Pasien...');

                    try {
                        console.log('[HAPUS] Memulai proses ERM...');
                        await prosesSemuaERM(page);
                        console.log('[HAPUS] Proses ERM selesai.');
                    } catch (error) {
                        console.error('[HAPUS] Gagal:', error.stack || error.message);
                    }
                }
            } catch (error) {
                console.error('\nERROR:', error.message);
                console.log('Kembali ke menu utama...');
            }

            // Beri jeda sebelum menu ditampilkan kembali
            await delay(1000);
        }

    } catch (error) {
        console.error('\nERROR UTAMA:', error.message);
    }

    // Browser tidak ditutup agar Chrome tetap terbuka.
})();
