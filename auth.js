const fs = require('fs');
const { LOGIN_URL, CREDENTIAL_FILE, SELECTOR } = require('./config');
const { delay } = require('./utils');

async function bukaHalamanLogin(page) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
}

async function login(page) {
  console.log('Menunggu form login. Selesaikan pemeriksaan Cloudflare secara manual jika diminta.');
  await page.waitForSelector(SELECTOR.email, { visible: true, timeout: 120000 });

  if (!fs.existsSync(CREDENTIAL_FILE)) {
    throw new Error(`File ${CREDENTIAL_FILE} tidak ditemukan`);
  }
  const credentials = JSON.parse(fs.readFileSync(CREDENTIAL_FILE, 'utf8'));
  if (!credentials.email || !credentials.password) {
    throw new Error('credentials.json harus berisi email dan password');
  }

  await delay(3000);
  await page.click(SELECTOR.email);
  await page.type(SELECTOR.email, credentials.email, { delay: 80 });
  console.log('✓ Email diisi');

  await delay(3000);
  await page.click(SELECTOR.password);
  await page.type(SELECTOR.password, credentials.password, { delay: 80 });
  console.log('✓ Password diisi');

  await delay(5000);
  await page.click('button[type="submit"]');
  console.log('✓ Tombol submit diklik');
  await delay(5000);
  console.log('URL setelah login:', page.url());
}

module.exports = { bukaHalamanLogin, login };
