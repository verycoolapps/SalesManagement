/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * SalesDesk Pro v1.0.0 — Build: obfuscate main process + generate manifest.sig
 * Anti-reverse-engineering + anti-modifikasi untuk distribusi Windows.
 * =============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const obfuscator = require('javascript-obfuscator');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const OBF_OPTS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false,
  numbersToExpressions: true,
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  rotateStringArray: true,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  renameGlobals: false,
  identifierNamesGenerator: 'hexadecimal',
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  log: false
};

function obfuscateFile(src, dest) {
  const code = fs.readFileSync(src, 'utf8');
  const result = obfuscator.obfuscate(code, OBF_OPTS).getObfuscatedCode();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, result);
  console.log('  obfuscated:', path.relative(root, dest), '(' + Math.round(result.length / 1024) + ' KB)');
}

function main() {
  console.log('== SalesDesk Pro build: obfuscation ==');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'core'), { recursive: true });

  // 1) Obfuscate main process files
  obfuscateFile(path.join(root, 'main.js'), path.join(dist, 'main.js'));
  obfuscateFile(path.join(root, 'preload.js'), path.join(dist, 'preload.js'));
  for (const f of ['crypto.js', 'db.js', 'license.js', 'integrity.js', 'services.js']) {
    obfuscateFile(path.join(root, 'core', f), path.join(dist, 'core', f));
  }

  // 2) Copy sql.js wasm untuk runtime
  const wasm = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  fs.copyFileSync(wasm, path.join(dist, 'core', 'sql-wasm.wasm'));
  fs.copyFileSync(wasm, path.join(root, 'core', 'sql-wasm.wasm')); // untuk dev
  console.log('  wasm copied');

  // 3) Generate manifest.sig (hash file inti — diverifikasi saat runtime)
  const files = ['crypto.js', 'db.js', 'license.js', 'integrity.js', 'services.js'];
  const manifest = { app: 'SalesDeskPro', version: '1.0.0', generated: new Date().toISOString(), files: {} };
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dist, 'core', f));
    manifest.files[f] = crypto.createHash('sha256').update(buf).digest('hex');
  }
  fs.writeFileSync(path.join(dist, 'core', 'manifest.sig'), JSON.stringify(manifest, null, 1));
  console.log('  manifest.sig generated');

  // 4) Salin LICENSE notice
  fs.copyFileSync(path.join(root, 'LICENSE.md'), path.join(dist, 'LICENSE.md'));
  console.log('== Build obfuscation selesai ==');
}

main();
