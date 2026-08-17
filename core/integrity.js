/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * @product    SalesDesk Pro v1.0.0 — Integrity Self-Check (anti-modifikasi)
 * @license    PROPRIETARY. Dilarang memodifikasi aplikasi tanpa izin.
 * =============================================================================
 * Memverifikasi integritas app.asar & modul inti saat startup. Jika ada file
 * yang dimodifikasi/ditambal, aplikasi masuk mode terkunci (tamper screen).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./crypto');

function hashFile(p) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  } catch (e) { return null; }
}

function hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Verifikasi file inti terhadap manifest yang ditanam saat build. */
function verifyCore() {
  const manifestDir = __dirname; // dist/core saat build, core/ saat dev
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, 'manifest.sig'), 'utf8')); }
  catch (e) { manifest = null; }

  const results = [];
  const coreFiles = ['crypto.js', 'db.js', 'license.js', 'services.js', 'integrity.js'];
  let tampered = false;
  let unsigned = false;

  for (const f of coreFiles) {
    const p = path.join(__dirname, f);
    const h = hashFile(p);
    const expected = manifest && manifest.files ? manifest.files[f] : null;
    if (expected) {
      const ok = h === expected;
      results.push({ file: f, ok });
      if (!ok) tampered = true;
    } else {
      unsigned = true; // dev mode (belum build) — file tidak di-manifest
    }
  }

  // Aplikasi produksi wajib punya manifest
  if (!manifest) {
    return { ok: true, devMode: true, tampered: false, results, message: 'Dev mode (manifest belum di-generate).' };
  }
  return { ok: !tampered, devMode: false, tampered, results };
}

/** Verifikasi app.asar (seluruh payload) bila ada. */
function verifyAsar() {
  const asarPath = process.env.VCSDP_ASAR_PATH || (process.resourcesPath ? path.join(process.resourcesPath, 'app.asar') : null);
  if (!asarPath || !fs.existsSync(asarPath)) return { ok: true, checked: false };
  const h = hashFile(asarPath);
  const sigPath = path.join(process.resourcesPath, 'app.asar.sig');
  if (!fs.existsSync(sigPath)) return { ok: true, checked: false, note: 'signature absent' };
  let sig = null;
  try { sig = JSON.parse(fs.readFileSync(sigPath, 'utf8')); } catch (e) { sig = null; }
  if (!sig || !sig.hash) return { ok: true, checked: false, note: 'invalid sig' };
  const expected = C.hmac(C.integrityKey(), sig.hash).slice(0, 64);
  const ok = h === expected;
  return { ok, checked: true };
}

module.exports = { verifyCore, verifyAsar, hashFile, hashBuffer };
