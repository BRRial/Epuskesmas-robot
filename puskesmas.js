const { SELECTOR, PUSKESMAS_NAME } = require('./config');
const { delay } = require('./utils');

async function pilihPuskesmas(page) {
  try {
    await page.waitForSelector(SELECTOR.puskesmas, { visible: true, timeout: 8000 });
  } catch {
    console.log('Pilihan Puskesmas tidak muncul; kemungkinan sudah berada di area aplikasi.');
    return;
  }

  const buttons = await page.$$(SELECTOR.puskesmas);
  let target = null;

  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent.trim().replace(/\s+/g, ' '), button);
    console.log(`Puskesmas ditemukan: ${text}`);
    if (text.toUpperCase().includes(PUSKESMAS_NAME)) {
      target = button;
      break;
    }
  }

  if (!target) throw new Error(`${PUSKESMAS_NAME} tidak ditemukan`);
  await target.click();
  await delay(2500);
  console.log(`✓ ${PUSKESMAS_NAME} dipilih`);
}

module.exports = { pilihPuskesmas };
