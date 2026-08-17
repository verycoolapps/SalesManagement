/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * SalesDesk Pro v1.0.0 — afterPack hook: tanda tangan app.asar (anti-modifikasi)
 * Dipanggil electron-builder setelah app dipack. Menghasilkan app.asar.sig
 * yang diverifikasi aplikasi saat startup.
 * =============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const asarPath = path.join(appOutDir, 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) {
    console.log('[after-pack] app.asar tidak ditemukan — skip signing');
    return;
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(asarPath)).digest('hex');
  fs.writeFileSync(path.join(appOutDir, 'resources', 'app.asar.sig'), JSON.stringify({ hash, brand: 'VeryCoolApps', date: new Date().toISOString() }));
  console.log('[after-pack] app.asar signed (sha256: ' + hash.slice(0, 16) + '…)');
};
