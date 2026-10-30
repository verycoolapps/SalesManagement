'use strict';
// MIT License — no license activation required. Free for everyone.
// Semua orang bebas menggunakan SalesDesk Pro tanpa kunci lisensi.

function getFingerprint() { return 'open-source'; }
function fingerprintLabel() { return 'MIT-OPEN'; }

function licenseStatus() {
  return { state: 'valid', license: { key: 'MIT-OPEN', holder: 'Open Source User', activated_at: new Date().toISOString() } };
}

function activate() {
  return { ok: true };
}

function loadLicense() {
  return { key: 'MIT-OPEN', holder: 'Open Source User' };
}

function saveLicense() {}

module.exports = { getFingerprint, licenseStatus, activate, loadLicense, saveLicense, fingerprintLabel };
