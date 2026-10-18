
const readline = require('readline');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function pilihMenu() {
    while (true) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n========================================');
        console.log('          PILIH JENIS PELAYANAN');
        console.log('========================================');
        console.log('[1] Pendaftaran');
        console.log('[2] Pelayanan');
        console.log('[3] Ambil Database')
        console.log('[4] Hapus Pasien')

        const answer = await new Promise(resolve => {
            rl.question('Masukkan pilihan (1/2/3/4): ', value => {
                rl.close();
                resolve(value.trim());
            });
        });

        if (answer === '1') return 'pendaftaran';
        if (answer === '2') return 'pelayanan';
        if (answer === '3') return 'database';
        if (answer === '4') return 'hapus';

        console.log('Pilihan tidak valid. Silakan pilih 1 atau 2.');
    }
}

module.exports = {
    delay,
    pilihMenu
};
