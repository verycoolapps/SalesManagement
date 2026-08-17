/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * SalesDesk Pro v1.0.0 — License Generator OFFLINE (hanya untuk pemilik brand)
 * Menghasilkan License Key untuk fingerprint mesin customer.
 * =============================================================================
 * Penggunaan:
 *   node scripts/license-gen.js <fingerprint> [label]
 * Contoh:
 *   node scripts/license-gen.js a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 PT Maju
 */
'use strict';
const C = require('../core/crypto');

const fp = process.argv[2];
if (!fp) {
  console.log('Penggunaan: node scripts/license-gen.js <fingerprint> [label]');
  console.log('Fingerprint didapat dari layar Aktivasi di aplikasi (32 karakter hex).');
  process.exit(1);
}

const key = C.generateLicense(fp.trim());
console.log('');
console.log('  Fingerprint : ' + fp.trim());
console.log('  License Key : ' + key);
console.log('  Label       : ' + (process.argv[3] || '-'));
console.log('');
console.log('Kirimkan License Key ini ke customer. Verifikasi otomatis oleh aplikasi.');
