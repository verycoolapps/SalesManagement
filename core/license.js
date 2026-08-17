/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * @product    SalesDesk Pro v1.0.0 — License & Machine Binding (anti-copy)
 * @license    PROPRIETARY. Dilarang menyalin/mendistribusikan tanpa lisensi resmi.
 * =============================================================================
 * Proteksi anti-pembajakan: aplikasi terikat ke fingerprint hardware mesin.
 * Menyalin folder instalasi ke komputer lain TANPA aktivasi ulang akan gagal
 * (fingerprint berbeda → lisensi tidak valid).
 */
'use strict';
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const C = require('./crypto');

function run(cmd, args) {
  try { return execFileSync(cmd, args, { timeout: 8000, windowsHide: true }).toString().trim(); }
  catch (e) { return ''; }
}

/** Ambil fingerprint mesin (Windows MachineGuid preferred). */
function getFingerprint() {
  const parts = [];
  if (process.platform === 'win32') {
    const guid = run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
    const m = guid.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{8,})/);
    if (m && m[1]) parts.push('guid:' + m[1].toLowerCase());
    const uuid = run('wmic', ['csproduct', 'get', 'uuid']);
    const um = uuid.match(/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/);
    if (um) parts.push('uuid:' + um[0].toLowerCase());
    const disk = run('wmic', ['diskdrive', 'get', 'serialnumber']);
    const d = disk.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(1).join(',');
    if (d) parts.push('disk:' + d.toLowerCase().slice(0, 40));
  }
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        parts.push('mac:' + iface.mac.toLowerCase().replace(/:/g, ''));
        break;
      }
    }
    if (parts.some(p => p.startsWith('mac:'))) break;
  }
  parts.push('host:' + os.hostname().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const joined = parts.join('|');
  return crypto.createHash('sha256').update('VCSDP|' + joined).digest('hex').slice(0, 32);
}

/** Lisensi saat ini (tersimpan di settings). */
function loadLicense(db) {
  const raw = db.getSetting('license_data', null);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function saveLicense(db, data) {
  db.setSetting('license_data', JSON.stringify(data));
}

/** Status lisensi: valid | invalid | pending */
function licenseStatus(db, fingerprint) {
  const lic = loadLicense(db);
  if (!lic || !lic.fingerprint) return { state: 'pending', license: null };
  if (lic.fingerprint !== fingerprint) return { state: 'invalid', license: lic };
  if (!lic.key) return { state: 'pending', license: lic };
  const ok = C.verifyLicense(fingerprint, lic.key);
  return { state: ok ? 'valid' : 'invalid', license: lic };
}

/** Aktivasi dengan license key. */
function activate(db, fingerprint, key) {
  if (!key || !key.trim()) return { ok: false, error: 'License key wajib diisi.' };
  const valid = C.verifyLicense(fingerprint, key.trim());
  if (!valid) return { ok: false, error: 'License key tidak valid untuk mesin ini.' };
  saveLicense(db, {
    fingerprint,
    key: key.trim().toUpperCase(),
    activated_at: db.now(),
    holder: db.getSetting('license_holder', '') || 'Pemegang Lisensi'
  });
  db.saveDebounced();
  return { ok: true };
}

function fingerprintLabel(fp) {
  return fp ? fp.slice(0, 8).toUpperCase() + '-' + fp.slice(8, 16).toUpperCase() : '';
}

module.exports = { getFingerprint, licenseStatus, activate, loadLicense, saveLicense, fingerprintLabel };
