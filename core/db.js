/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * @product    SalesDesk Pro v1.0.0 — Data Access Layer (SQLite via sql.js + AES-256-GCM at rest)
 * @license    PROPRIETARY — lihat LICENSE.md. Dilarang copy/modifikasi/tiru tanpa izin.
 * =============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const C = require('./crypto');

const FILE_HEADER = Buffer.from('VCSDP1'); // signature file database
const SCHEMA_VERSION = 1;

let SQL = null;         // sql.js factory
let db = null;          // Database instance
let appDataPath = null;
let dbPath = null;
let keyHex = null;
let dirty = false;
let saveTimer = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Sales',
  team_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Active',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT, last_login TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, manager_id INTEGER, created_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, company TEXT, contact_id INTEGER, source TEXT,
  estimated_value REAL NOT NULL DEFAULT 0, stage TEXT NOT NULL DEFAULT 'Prospek',
  owner_id INTEGER, team_id INTEGER, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, position TEXT, email TEXT, phone TEXT, company TEXT,
  notes TEXT, owner_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, stage TEXT NOT NULL DEFAULT 'Prospek',
  owner_id INTEGER, product_id INTEGER, product_name TEXT, qty REAL NOT NULL DEFAULT 1,
  estimated_close TEXT, status TEXT NOT NULL DEFAULT 'Open',
  won_date TEXT, lost_reason TEXT, scheme_snapshot TEXT,
  prospect_id INTEGER, contact_id INTEGER, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, prospect_id INTEGER, deal_id INTEGER, user_id INTEGER,
  note TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, prospect_id INTEGER, deal_id INTEGER, owner_id INTEGER,
  due_date TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Normal',
  status TEXT NOT NULL DEFAULT 'Open', completed_at TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, participants TEXT, start_time TEXT NOT NULL,
  location TEXT, agenda TEXT, prospect_id INTEGER, deal_id INTEGER,
  reminder_min INTEGER NOT NULL DEFAULT 15,
  created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, month TEXT NOT NULL,
  target_revenue REAL NOT NULL DEFAULT 0,
  activity_target INTEGER NOT NULL DEFAULT 0,
  followup_target INTEGER NOT NULL DEFAULT 0,
  deal_target INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT,
  UNIQUE(user_id, month)
);
CREATE TABLE IF NOT EXISTS commission_schemes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, type TEXT NOT NULL, params TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0, effective_date TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
  deal_value REAL NOT NULL, percent REAL NOT NULL DEFAULT 0, nominal REAL NOT NULL,
  scheme_snapshot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Confirmed',
  reason_override TEXT, created_at TEXT NOT NULL, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, username TEXT, action TEXT NOT NULL,
  entity TEXT, entity_id INTEGER, detail TEXT, timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT, size INTEGER, date TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, position INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS followup_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, template TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prospects_owner ON prospects(owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_followups_owner ON followups(owner_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(due_date);
CREATE INDEX IF NOT EXISTS idx_meetings_start ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp);
`;

function now() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }

function today() { return new Date().toISOString().slice(0, 10); }

/** Buka/init database. fingerprint dipakai sebagai salah satu komponen kunci enkripsi. */
async function init(dataDir, fingerprint) {
  appDataPath = dataDir;
  keyHex = C.dbKey(fingerprint);
  fs.mkdirSync(appDataPath, { recursive: true });
  dbPath = path.join(appDataPath, 'salesdesk.data');

  SQL = await initSqlJs({ locateFile: (f) => path.join(__dirname, f) });
  const raw = loadRawFile(dbPath);
  if (raw) {
    try {
      const plain = C.decrypt(raw.toString('base64'), keyHex, 'sdp-db');
      db = new SQL.Database(Buffer.from(plain, 'binary'));
      ensureSchema();
      return { created: false };
    } catch (e) {
      // File korup / kunci salah → rename .corrupt, buat baru (sesuai SOP D)
      try { fs.renameSync(dbPath, dbPath + '.corrupt-' + Date.now()); } catch (e2) {}
      db = new SQL.Database();
      ensureSchema();
      seed();
      saveNow();
      return { created: true, recoveredCorrupt: true };
    }
  }
  db = new SQL.Database();
  ensureSchema();
  seed();
  saveNow();
  return { created: true };
}

function loadRawFile(p) {
  try {
    const buf = fs.readFileSync(p);
    if (!buf.slice(0, 6).equals(FILE_HEADER)) return null;
    return buf.slice(6);
  } catch (e) { return null; }
}

function ensureSchema() {
  db.exec(SCHEMA);
  const r = db.exec("SELECT value FROM settings WHERE key='schema_version'");
  if (!r.length) {
    db.run("INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version',?)", [String(SCHEMA_VERSION)]);
  }
}

function seed() {
  const t = now();
  const th = today();
  const run = db.run.bind(db);
  // Default stages
  const stages = ['Prospek', 'Kualifikasi', 'Penawaran', 'Deal'];
  stages.forEach((s, i) => run("INSERT OR IGNORE INTO stages(name,position,created_at) VALUES(?,?,?)", [s, i, t]));
  // Default sources
  ['Website', 'WhatsApp', 'Instagram', 'Referensi', 'Telepon', 'Event', 'Walk-in', 'Lainnya'].forEach(s =>
    run("INSERT OR IGNORE INTO sources(name,created_at) VALUES(?,?)", [s, t]));
  // Produk dikosongkan — Admin mengisi produk sendiri (TANPA dummy data)
  // Default commission scheme (percent 5%)
  run("INSERT OR IGNORE INTO commission_schemes(name,type,params,active,effective_date,created_at) VALUES(?,?,?,?,?,?)",
    ['Komisi Standar 5%', 'percent', JSON.stringify({ percent: 5 }), 1, th, t]);
  // Default followup templates
  const tmpls = [
    ['Follow-up Prospek Baru', 'Halo {nama}, sebelumnya kami mengirimkan penawaran untuk {produk}. Bagaimana perkembangannya?'],
    ['Follow-up Penawaran', 'Halo {nama}, apakah Bapak/Ibu sudah sempat mereview penawaran kami?'],
    ['Follow-up Deal', 'Halo {nama}, kami ingin memastikan kelanjutan kerja sama {produk}.']
  ];
  tmpls.forEach(tp => run("INSERT OR IGNORE INTO followup_templates(name,template,created_at) VALUES(?,?,?)", [tp[0], tp[1], t]));
  // Default admin
  const hash = C.hashPassword('admin123');
  run("INSERT OR IGNORE INTO users(username,password_hash,name,role,status,must_change_password,created_at) VALUES('admin',?,'Administrator','Admin','Active',1,?)", [hash, t]);
  // Settings
  const settings = {
    company_name: '',
    currency: 'Rp',
    date_format: 'DD/MM/YYYY',
    auto_lock_min: '10',
    min_password_len: '8',
    lockout_attempts: '5',
    backup_hour: '22',
    backup_enabled: '1',
    theme: 'dark',
    meeting_reminder_min: '15',
    notification_enabled: '1',
    license_holder: ''
  };
  Object.keys(settings).forEach(k => run("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", [k, settings[k]]));
  dirty = true;
}

function query(sql, params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params || []);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally { stmt.free(); }
}

function get(sql, params) {
  const rows = query(sql, params);
  return rows.length ? rows[0] : null;
}

function run(sql, params) {
  db.run(sql, params || []);
  dirty = true;
}

function runMany(statements) {
  db.run('BEGIN TRANSACTION');
  try {
    for (const s of statements) db.run(s.sql, s.params || []);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  dirty = true;
}

function lastId() { return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]); }

function getSetting(key, def) {
  const r = get("SELECT value FROM settings WHERE key=?", [key]);
  return r ? r.value : (def !== undefined ? def : null);
}

function setSetting(key, value) {
  run("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", [key, String(value)]);
}

function saveNow() {
  if (!db) return;
  try {
    const data = db.export();
    const enc = C.encrypt(Buffer.from(data).toString('binary'), keyHex, 'sdp-db');
    const tmp = dbPath + '.tmp';
    fs.writeFileSync(tmp, Buffer.concat([FILE_HEADER, Buffer.from(enc, 'base64')]));
    fs.renameSync(tmp, dbPath);
    dirty = false;
  } catch (e) {
    console.error('[DB] save failed', e);
    throw e;
  }
}

function saveDebounced(ms) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, ms || 400);
}

function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (dirty) saveNow();
}

/** Backup terenkripsi dengan metadata. Rolling dipakai di BackupService. */
function backupTo(filePath, type) {
  flush();
  const data = db.export();
  const payload = JSON.stringify({ v: SCHEMA_VERSION, type: type || 'manual', date: now(), data: Buffer.from(data).toString('base64') });
  const enc = C.encrypt(payload, keyHex, 'sdp-bak');
  const meta = JSON.stringify({ app: 'SalesDeskPro', ver: '1.0.0', brand: 'VeryCoolApps', date: now() });
  const out = Buffer.concat([
    Buffer.from('VCSDBK1'), Buffer.from(meta + '\n', 'utf8'),
    Buffer.from(enc, 'base64')
  ]);
  fs.writeFileSync(filePath, out);
  return fs.statSync(filePath).size;
}

/** Restore dari backup: validasi signature, decrypt, load. */
function restoreFrom(filePath) {
  const buf = fs.readFileSync(filePath);
  if (!buf.slice(0, 7).toString('utf8').startsWith('VCSDBK1')) throw new Error('File bukan backup SalesDesk Pro yang valid.');
  const metaEnd = buf.indexOf(0x0a);
  const meta = JSON.parse(buf.slice(7, metaEnd).toString('utf8'));
  // Payload tersimpan sebagai bytes biner hasil decode base64 — encode ulang ke base64 untuk decrypt
  const payloadB64 = buf.slice(metaEnd + 1).toString('base64');
  const payload = JSON.parse(C.decrypt(payloadB64, keyHex, 'sdp-bak'));
  const newDb = new SQL.Database(Buffer.from(payload.data, 'base64'));
  // integrity check: query tabel inti
  const r = newDb.exec("SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('users','deals','commissions','audit_logs')");
  if (!r.length || r[0].values[0][0] < 4) throw new Error('Backup tidak lengkap / korup.');
  db = newDb;
  ensureSchema();
  // simpan file lama sebagai .pre-restore
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, dbPath + '.pre-restore-' + Date.now());
  }
  saveNow();
  return meta;
}

function integrityCheck() {
  try {
    const r = db.exec("PRAGMA integrity_check");
    const status = r && r.length ? r[0].values[0][0] : 'unknown';
    const counts = {};
    for (const t of ['users', 'prospects', 'contacts', 'deals', 'followups', 'meetings', 'targets', 'commissions', 'audit_logs']) {
      try { counts[t] = Number(db.exec('SELECT count(*) FROM ' + t)[0].values[0][0]); } catch (e) { counts[t] = -1; }
    }
    return { status, counts, dbPath, size: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0 };
  } catch (e) { return { status: 'error', error: String(e && e.message || e) }; }
}

function exportRawBytes() { return db.export(); }

function close() { flush(); if (db) { db.close(); db = null; } }

module.exports = { init, query, get, run, runMany, lastId, getSetting, setSetting, saveNow, saveDebounced, flush, backupTo, restoreFrom, integrityCheck, exportRawBytes, close, now, today };
