/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * @product    SalesDesk Pro
 * @version    1.0.0
 * @author     HermesClaw / VeryCoolApps
 * @contact    WA: +62 815-1925-0845 | TG: https://t.me/VeryCoolApps
 * @license    PROPRIETARY — Unauthorized use strictly prohibited
 * =============================================================================
 * NOTICE: This file is the exclusive intellectual property of VeryCoolApps
 * (PT. Agra Karya Digital). Reproduction, distribution, or modification
 * without written consent is a violation of UU No. 28/2014 and applicable
 * international copyright treaties.
 * =============================================================================
 */
'use strict';
const crypto = require('crypto');

// ---- Master secrets (dilindungi lebih lanjut oleh obfuscation) ----
const SECRETS = {
  license: '51f0b96157df859a41c1e1f8f41b83e55ec63de16a091364c7976ccd0e55fef2',
  integrity: 'dbd621cca98d1d872d67a6ea6fc4246a04a609fd3977bfa4630aa59a1e527f8b',
  dbMaster: '004ddc4524bbc7a12470e6aa0d336283e6850c3c1b7ed16e05d416fffe729a10'
};
const SECRETS_KEY = 'vca-sdp-secrets-v1';

function _unwrap() {
  // Obfuscation-friendly indirection: constant-time join of reversed chunks.
  let s = '';
  const k = SECRETS_KEY;
  for (let i = 0; i < k.length; i++) s += String.fromCharCode(k.charCodeAt(i) + (i % 7));
  const map = ['license', 'integrity', 'dbMaster'];
  const out = {};
  for (let j = 0; j < map.length; j++) {
    const v = SECRETS[map[j]];
    out[map[j]] = v.split('').reverse().join('') + s.slice(0, 8);
  }
  return out;
}

/** PBKDF2-SHA256 — 100.000 iterasi, salt acak per user (sesuai PRD SC-001) */
function hashPassword(password, salt, iterations) {
  const saltBuf = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(16);
  const iter = iterations || 100000;
  const hash = crypto.pbkdf2Sync(String(password), saltBuf, iter, 32, 'sha256');
  return iter + ':' + saltBuf.toString('hex') + ':' + hash.toString('hex');
}

function verifyPassword(password, stored) {
  try {
    const parts = stored.split(':');
    const iter = parseInt(parts[0], 10);
    const salt = parts[1];
    const expected = parts[2];
    const calc = hashPassword(password, salt, iter).split(':')[2];
    const a = Buffer.from(calc, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

/** AES-256-GCM encrypt */
function encrypt(plaintext, keyHex, aad) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** AES-256-GCM decrypt (throws on tamper) */
function decrypt(payloadB64, keyHex, aad) {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(payloadB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** HMAC-SHA256 */
function hmac(secretHex, data) {
  return crypto.createHmac('sha256', Buffer.from(secretHex, 'hex')).update(String(data)).digest('hex');
}

/** License key dari machine fingerprint */
function generateLicense(fingerprint) {
  const u = _unwrap();
  const h = hmac(u.license, 'SDKP|' + fingerprint);
  const raw = h.slice(0, 24);
  let key = '';
  for (let i = 0; i < raw.length; i += 4) {
    key += (i > 0 ? '-' : '') + raw.slice(i, i + 4).toUpperCase();
  }
  return 'SDKP-' + key;
}

function verifyLicense(fingerprint, key) {
  const expected = generateLicense(fingerprint);
  const a = String(key || '').toUpperCase().trim();
  const b = expected.toUpperCase();
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function dbKey(fingerprint) {
  const u = _unwrap();
  const seed = u.dbMaster + '|' + fingerprint;
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function integrityKey() {
  const u = _unwrap();
  return u.integrity;
}

module.exports = {
  hashPassword, verifyPassword, encrypt, decrypt, hmac,
  generateLicense, verifyLicense, dbKey, integrityKey, _unwrap
};
