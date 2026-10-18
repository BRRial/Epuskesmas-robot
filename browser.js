
const puppeteer = require('puppeteer');
const { DEBUG_URL } = require('./config');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let prosesChrome = null;
let browserTerhubung = null;

function cariChrome() {
    const kandidat = [
        path.join(
            process.env.PROGRAMFILES || 'C:\\Program Files',
            'Google', 'Chrome', 'Application', 'chrome.exe'
        ),
        path.join(
            process.env['PROGRAMFILES(X86)'] ||
                'C:\\Program Files (x86)',
            'Google', 'Chrome', 'Application', 'chrome.exe'
        ),
        path.join(
            process.env.LOCALAPPDATA || '',
            'Google', 'Chrome', 'Application', 'chrome.exe'
        )
    ];

    return kandidat.find(lokasi => fs.existsSync(lokasi));
}

async function hubungkanChrome() {
    // Coba hubungkan terlebih dahulu ke Chrome yang sudah aktif.
    try {
        browserTerhubung = await puppeteer.connect({
            browserURL: DEBUG_URL
        });

        return browserTerhubung;
    } catch (error) {
        console.log('Chrome remote debugging belum aktif.');
    }

    const chromePath = cariChrome();

    if (!chromePath) {
        throw new Error(
            'Google Chrome tidak ditemukan. ' +
            'Periksa instalasi Chrome di komputer.'
        );
    }

    // Gunakan profil khusus aplikasi agar tidak bentrok
    // dengan profil Chrome utama yang sedang digunakan.
    const profil = path.join(
        os.homedir(),
        'epuskesmas-chrome-profile'
    );

    fs.mkdirSync(profil, { recursive: true });

    const port = new URL(DEBUG_URL).port || '9222';

    console.log('Membuka Chrome dengan remote debugging...');

    prosesChrome = spawn(chromePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profil}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--start-maximized'
    ], {
        detached: false,
        stdio: 'ignore',
        windowsHide: false
    });

    // Tunggu Chrome memulai layanan remote debugging.
    const batasWaktu = Date.now() + 20000;
    let errorTerakhir;

    while (Date.now() < batasWaktu) {
        try {
            browserTerhubung = await puppeteer.connect({
                browserURL: DEBUG_URL
            });

            return browserTerhubung;
        } catch (error) {
            errorTerakhir = error;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    throw new Error(
        'Chrome gagal memulai remote debugging dalam 20 detik. ' +
        (errorTerakhir?.message || '')
    );
}

async function cariTabEPuskesmas(browser) {
    const pages = await browser.pages();

    for (const page of pages) {
        if (page.url().includes('situbondo.epuskesmas.id')) {
            return page;
        }
    }

    // Jika belum ada tab e-Puskesmas, buka tab baru.
    const page = await browser.newPage();

    await page.goto(
        'https://situbondo.epuskesmas.id/',
        { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    return page;
}

module.exports = {
    hubungkanChrome,
    cariTabEPuskesmas
};
