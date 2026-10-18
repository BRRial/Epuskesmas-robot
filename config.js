module.exports = {
  DEBUG_URL: 'http://127.0.0.1:9222',
  LOGIN_URL: 'https://situbondo.epuskesmas.id/login',
  PENDAFTARAN_URL: 'https://situbondo.epuskesmas.id/pasien?broadcastNotif=1',
  EXCEL_FILE: './pasien.xlsx',
  CREDENTIAL_FILE: './credentials.json',
  PUSKESMAS_NAME: '', // ganti dengan akun puskesmas atau akun wilayah example PUSKESMAS A / PUSTU A
  SELECTOR: {
    email: 'input[name="email"]',
    password: 'input[name="password"]',
    puskesmas: 'button.btn.btn-list.btn-info',
    nik: 'input[name="typeSearchValue"]',
    cari: 'button.btn.btn-sm.btn-info'
  }
};
