/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * @product    SalesDesk Pro v1.0.0 — Business Logic Layer (deterministik, auditable)
 * @license    PROPRIETARY. Dilarang menyalin/memodifikasi tanpa izin tertulis.
 * =============================================================================
 * Seluruh perhitungan (komisi, target, prioritas, scorecard) bersifat
 * rule-based & transparan — dapat ditelusuri ke transaksi sumber.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const DB = require('./db');
const C = require('./crypto');
const ExcelJS = require('exceljs');

/* ============================= HELPERS ============================= */

const NOW = () => DB.now();
const TODAY = () => DB.today();

function fmtRp(v) {
  const n = Math.round(Number(v) || 0);
  return 'Rp ' + n.toLocaleString('id-ID');
}

function monthOf(dateStr) { return String(dateStr || '').slice(0, 7); }
function currentMonth() { return TODAY().slice(0, 7); }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(TODAY() + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); cur = ''; rows.push(row); row = []; }
    else if (ch === '\r') { /* skip */ }
    else cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

function levenshtein(a, b) {
  a = String(a || '').toLowerCase(); b = String(b || '').toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/\b(pt|cv|toko|ud)\b/g, '').trim();
}

/* ============================= AUTH ============================= */

const lockState = new Map(); // username -> {fails:[ts...], lockedUntil}

function login(username, password) {
  const user = DB.get("SELECT * FROM users WHERE lower(username)=lower(?) AND deleted_at IS NULL", [String(username || '').trim()]);
  if (!user) return { ok: false, error: 'Username tidak ditemukan.' };

  const st = lockState.get(user.username) || { fails: [], lockedUntil: 0 };
  const nowTs = Date.now();
  if (st.lockedUntil > nowTs) {
    const wait = Math.ceil((st.lockedUntil - nowTs) / 1000);
    return { ok: false, error: 'Akun terkunci. Coba lagi dalam ' + wait + ' detik.' };
  }

  if (user.status !== 'Active') {
    audit('LOGIN_BLOCKED', 'user', user.id, { reason: 'Akun nonaktif' }, user);
    return { ok: false, error: 'Akun nonaktif — hubungi Admin.' };
  }

  if (C.verifyPassword(password, user.password_hash)) {
    st.fails = []; st.lockedUntil = 0;
    lockState.set(user.username, st);
    DB.run("UPDATE users SET last_login=? WHERE id=?", [NOW(), user.id]);
    audit('LOGIN_SUCCESS', 'user', user.id, {}, user);
    return { ok: true, user: sanitizeUser(user), mustChangePassword: !!user.must_change_password };
  }

  st.fails.push(nowTs);
  const attempts = Number(DB.getSetting('lockout_attempts', '5'));
  if (st.fails.length >= attempts) {
    st.lockedUntil = nowTs + 30000; // 30 detik (PRD SC-001)
    st.fails = [];
    lockState.set(user.username, st);
    audit('LOCKOUT', 'user', user.id, { attempts }, user);
    return { ok: false, error: 'Terlalu banyak percobaan gagal. Akun terkunci 30 detik.' };
  }
  lockState.set(user.username, st);
  audit('LOGIN_FAILED', 'user', user.id, { remaining: attempts - st.fails.length }, user);
  return { ok: false, error: 'Password salah. Sisa percobaan: ' + (attempts - st.fails.length) };
}

function sanitizeUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, team_id: u.team_id, status: u.status };
}

function changePassword(actor, oldPw, newPw) {
  const user = DB.get('SELECT * FROM users WHERE id=?', [actor.id]);
  if (!user) return { ok: false, error: 'User tidak ditemukan.' };
  if (!C.verifyPassword(oldPw, user.password_hash)) return { ok: false, error: 'Password lama salah.' };
  const min = Number(DB.getSetting('min_password_len', '8'));
  if (String(newPw).length < min) return { ok: false, error: 'Password minimal ' + min + ' karakter.' };
  const hash = C.hashPassword(newPw);
  DB.run("UPDATE users SET password_hash=?, must_change_password=0, updated_at=? WHERE id=?", [hash, NOW(), actor.id]);
  audit('PASSWORD_CHANGE', 'user', actor.id, {}, actor);
  return { ok: true };
}

/* ============================= AUDIT ============================= */

function audit(action, entity, entityId, detail, actor) {
  try {
    DB.run("INSERT INTO audit_logs(user_id,username,action,entity,entity_id,detail,timestamp) VALUES(?,?,?,?,?,?,?)",
      [actor ? actor.id : null, actor ? actor.username : 'system', action, entity, entityId || null,
       JSON.stringify(detail || {}), NOW()]);
  } catch (e) { /* audit tidak boleh mematikan aplikasi */ }
}

/* ============================= USERS & TEAMS ============================= */

function listUsers(actor) {
  return DB.query("SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id=u.team_id WHERE u.deleted_at IS NULL ORDER BY u.role, u.name");
}

function createUser(actor, data) {
  const req = ['username', 'name', 'role'];
  for (const k of req) if (!String(data[k] || '').trim()) return { ok: false, error: 'Field wajib belum lengkap.' };
  const uname = String(data.username).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,}$/.test(uname)) return { ok: false, error: 'Username minimal 3 karakter (huruf/angka/._-).' };
  const exists = DB.get("SELECT id FROM users WHERE lower(username)=? AND deleted_at IS NULL", [uname]);
  if (exists) return { ok: false, error: 'Username sudah dipakai.' };
  const min = Number(DB.getSetting('min_password_len', '8'));
  const pw = String(data.password || '').trim();
  if (pw.length < min) return { ok: false, error: 'Password minimal ' + min + ' karakter.' };
  const hash = C.hashPassword(pw);
  DB.run("INSERT INTO users(username,password_hash,name,role,team_id,status,must_change_password,created_at) VALUES(?,?,?,?,?,?,?,?)",
    [uname, hash, String(data.name).trim(), data.role, data.team_id || null, data.status || 'Active',
     data.must_change ? 1 : 0, NOW()]);
  const id = DB.lastId();
  audit('USER_CREATE', 'user', id, { username: uname, role: data.role }, actor);
  return { ok: true, id };
}

function updateUser(actor, id, data) {
  const user = DB.get('SELECT * FROM users WHERE id=?', [id]);
  if (!user) return { ok: false, error: 'User tidak ditemukan.' };
  if (String(data.username || '').trim().toLowerCase() !== user.username) {
    const dup = DB.get("SELECT id FROM users WHERE lower(username)=? AND id<>? AND deleted_at IS NULL", [String(data.username).trim().toLowerCase(), id]);
    if (dup) return { ok: false, error: 'Username sudah dipakai.' };
  }
  DB.run("UPDATE users SET username=?, name=?, role=?, team_id=?, status=?, updated_at=? WHERE id=?",
    [String(data.username).trim().toLowerCase(), String(data.name).trim(), data.role, data.team_id || null, data.status || 'Active', NOW(), id]);
  if (user.role !== data.role) audit('ROLE_CHANGE', 'user', id, { old: user.role, new: data.role }, actor);
  if (user.status !== data.status && data.status === 'Inactive') audit('USER_DEACTIVATE', 'user', id, {}, actor);
  audit('USER_UPDATE', 'user', id, {}, actor);
  return { ok: true };
}

function resetPassword(actor, id, newPw) {
  const user = DB.get('SELECT * FROM users WHERE id=?', [id]);
  if (!user) return { ok: false, error: 'User tidak ditemukan.' };
  const min = Number(DB.getSetting('min_password_len', '8'));
  if (String(newPw || '').length < min) return { ok: false, error: 'Password minimal ' + min + ' karakter.' };
  DB.run("UPDATE users SET password_hash=?, must_change_password=1, updated_at=? WHERE id=?", [C.hashPassword(newPw), NOW(), id]);
  audit('PASSWORD_RESET', 'user', id, { by: actor.username }, actor);
  return { ok: true };
}

function listTeams() {
  return DB.query("SELECT t.*, u.name AS manager_name, (SELECT count(*) FROM users WHERE team_id=t.id AND deleted_at IS NULL) AS member_count FROM teams t LEFT JOIN users u ON u.id=t.manager_id WHERE t.deleted_at IS NULL ORDER BY t.name");
}

function createTeam(actor, data) {
  if (!String(data.name || '').trim()) return { ok: false, error: 'Nama team wajib.' };
  DB.run("INSERT INTO teams(name,manager_id,created_at) VALUES(?,?,?)", [String(data.name).trim(), data.manager_id || null, NOW()]);
  audit('TEAM_CREATE', 'team', DB.lastId(), { name: data.name }, actor);
  return { ok: true };
}

function updateTeam(actor, id, data) {
  DB.run("UPDATE teams SET name=?, manager_id=?, updated_at=? WHERE id=?", [String(data.name).trim(), data.manager_id || null, NOW(), id]);
  audit('TEAM_UPDATE', 'team', id, {}, actor);
  return { ok: true };
}

/* ============================= SCOPE ============================= */

function scopeCondition(user, alias) {
  const a = alias || '';
  if (user.role === 'Sales') return a + 'owner_id=' + user.id + ' AND ';
  if (user.role === 'TeamLeader') {
    const members = teamMemberIds(user);
    if (members.length) return a + 'owner_id IN (' + members.join(',') + ') AND ';
  }
  return '';
}

function teamMemberIds(user) {
  if (user.role === 'Sales') return [user.id];
  const teamId = user.team_id;
  const rows = DB.query("SELECT id FROM users WHERE deleted_at IS NULL AND status='Active' AND (team_id=? OR id=?)", [teamId, user.id]);
  if (!rows.length && user.role === 'TeamLeader') return [user.id];
  return rows.map(r => r.id);
}

function visibleUserIds(user) {
  if (user.role === 'Sales') return [user.id];
  if (user.role === 'TeamLeader') return teamMemberIds(user);
  return DB.query("SELECT id FROM users WHERE deleted_at IS NULL").map(r => r.id);
}

/* ============================= PROSPECTS ============================= */

function listProspects(user, filters) {
  filters = filters || {};
  let sql = "SELECT p.*, u.name AS owner_name FROM prospects p LEFT JOIN users u ON u.id=p.owner_id WHERE p.deleted_at IS NULL AND ";
  sql += scopeCondition(user, 'p.');
  const params = [];
  if (filters.search) {
    sql += "(p.name LIKE ? OR p.company LIKE ?) AND ";
    params.push('%' + filters.search + '%', '%' + filters.search + '%');
  }
  if (filters.stage) { sql += "p.stage=? AND "; params.push(filters.stage); }
  if (filters.owner) { sql += "p.owner_id=? AND "; params.push(Number(filters.owner)); }
  sql = sql.replace(/ AND $/, '');
  sql += " ORDER BY p.created_at DESC";
  return DB.query(sql, params);
}

function getProspect(actor, id) {
  return DB.get("SELECT p.*, u.name AS owner_name FROM prospects p LEFT JOIN users u ON u.id=p.owner_id WHERE p.id=? AND p.deleted_at IS NULL", [id]);
}

function findDuplicates(name, company, excludeId) {
  const norm = normalize(name) + '|' + normalize(company);
  const rows = DB.query("SELECT id,name,company FROM prospects WHERE deleted_at IS NULL AND id<>?", [excludeId || 0]);
  const hits = [];
  for (const r of rows) {
    const other = normalize(r.name) + '|' + normalize(r.company);
    if (other === norm || levenshtein(other, norm) <= 2) hits.push(r);
  }
  return hits;
}

function createProspect(actor, data) {
  if (!String(data.name || '').trim()) return { ok: false, error: 'Nama prospek wajib diisi.' };
  const dups = findDuplicates(data.name, data.company);
  const val = Math.max(0, Number(data.estimated_value) || 0);
  DB.run("INSERT INTO prospects(name,company,contact_id,source,estimated_value,stage,owner_id,team_id,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    [String(data.name).trim(), String(data.company || '').trim(), data.contact_id || null, data.source || 'Lainnya',
     val, data.stage || 'Prospek', actor.id, actor.team_id || null, String(data.notes || '').trim(), NOW(), NOW()]);
  const id = DB.lastId();
  audit('PROSPECT_CREATE', 'prospect', id, { name: data.name }, actor);
  return { ok: true, id, duplicates: dups };
}

function updateProspect(actor, id, data) {
  const p = getProspect(actor, id);
  if (!p) return { ok: false, error: 'Prospek tidak ditemukan.' };
  if (!actorPermission(actor, p)) return { ok: false, error: 'Tidak punya akses ke prospek ini.' };
  const dups = findDuplicates(data.name, data.company, id);
  DB.run("UPDATE prospects SET name=?, company=?, contact_id=?, source=?, estimated_value=?, stage=?, notes=?, updated_at=? WHERE id=?",
    [String(data.name).trim(), String(data.company || '').trim(), data.contact_id || null, data.source || 'Lainnya',
     Math.max(0, Number(data.estimated_value) || 0), data.stage || p.stage, String(data.notes || '').trim(), NOW(), id]);
  audit('PROSPECT_UPDATE', 'prospect', id, {}, actor);
  return { ok: true, duplicates: dups };
}

function softDeleteProspect(actor, id, reason) {
  const p = getProspect(actor, id);
  if (!p) return { ok: false, error: 'Prospek tidak ditemukan.' };
  if (!actorPermission(actor, p)) return { ok: false, error: 'Tidak punya akses.' };
  DB.run("UPDATE prospects SET deleted_at=?, updated_at=? WHERE id=?", [NOW(), NOW(), id]);
  audit('PROSPECT_DELETE', 'prospect', id, { reason: reason || '' }, actor);
  return { ok: true };
}

function actorPermission(actor, entity) {
  if (actor.role === 'Admin' || actor.role === 'Manager') return true;
  if (actor.role === 'TeamLeader') {
    const members = teamMemberIds(actor);
    return members.includes(entity.owner_id);
  }
  return entity.owner_id === actor.id;
}

/* ============================= CONTACTS ============================= */

function listContacts(user, filters) {
  filters = filters || {};
  let sql = "SELECT c.*, u.name AS owner_name FROM contacts c LEFT JOIN users u ON u.id=c.owner_id WHERE c.deleted_at IS NULL";
  const params = [];
  if (user.role === 'Sales' || user.role === 'TeamLeader') {
    const ids = visibleUserIds(user);
    sql += " AND c.owner_id IN (" + ids.join(',') + ")";
  }
  if (filters.search) { sql += " AND (c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ?)"; params.push('%' + filters.search + '%', '%' + filters.search + '%', '%' + filters.search + '%'); }
  sql += " ORDER BY c.name";
  return DB.query(sql, params);
}

function createContact(actor, data) {
  if (!String(data.name || '').trim()) return { ok: false, error: 'Nama kontak wajib.' };
  DB.run("INSERT INTO contacts(name,position,email,phone,company,notes,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    [String(data.name).trim(), String(data.position || '').trim(), String(data.email || '').trim(), String(data.phone || '').trim(),
     String(data.company || '').trim(), String(data.notes || '').trim(), actor.id, NOW(), NOW()]);
  const id = DB.lastId();
  audit('CONTACT_CREATE', 'contact', id, {}, actor);
  return { ok: true, id };
}

function updateContact(actor, id, data) {
  DB.run("UPDATE contacts SET name=?, position=?, email=?, phone=?, company=?, notes=?, updated_at=? WHERE id=?",
    [String(data.name).trim(), String(data.position || '').trim(), String(data.email || '').trim(), String(data.phone || '').trim(),
     String(data.company || '').trim(), String(data.notes || '').trim(), NOW(), id]);
  audit('CONTACT_UPDATE', 'contact', id, {}, actor);
  return { ok: true };
}

function deleteContact(actor, id, reason) {
  DB.run("UPDATE contacts SET deleted_at=?, updated_at=? WHERE id=?", [NOW(), NOW(), id]);
  audit('CONTACT_DELETE', 'contact', id, { reason: reason || '' }, actor);
  return { ok: true };
}

/* ============================= DEALS & PIPELINE ============================= */

function getStages() {
  return DB.query("SELECT * FROM stages ORDER BY position");
}

function listDeals(user, filters) {
  filters = filters || {};
  let sql = "SELECT d.*, u.name AS owner_name, p.name AS prospect_name FROM deals d LEFT JOIN users u ON u.id=d.owner_id LEFT JOIN prospects p ON p.id=d.prospect_id WHERE d.deleted_at IS NULL AND ";
  sql += scopeCondition(user, 'd.');
  const params = [];
  if (filters.search) { sql += "(d.name LIKE ? OR d.product_name LIKE ?) AND "; params.push('%' + filters.search + '%', '%' + filters.search + '%'); }
  if (filters.stage) { sql += "d.stage=? AND "; params.push(filters.stage); }
  if (filters.status) { sql += "d.status=? AND "; params.push(filters.status); }
  if (filters.owner) { sql += "d.owner_id=? AND "; params.push(Number(filters.owner)); }
  sql = sql.replace(/ AND $/, '');
  sql += " ORDER BY CASE d.status WHEN 'Won' THEN 1 WHEN 'Open' THEN 0 ELSE 2 END, d.created_at DESC";
  return DB.query(sql, params);
}

function getDeal(actor, id) {
  return DB.get("SELECT d.*, u.name AS owner_name, p.name AS prospect_name FROM deals d LEFT JOIN users u ON u.id=d.owner_id LEFT JOIN prospects p ON p.id=d.prospect_id WHERE d.id=? AND d.deleted_at IS NULL", [id]);
}

function createDeal(actor, data) {
  if (!String(data.name || '').trim()) return { ok: false, error: 'Nama deal wajib.' };
  const value = Math.max(0, Number(data.value) || 0);
  DB.run("INSERT INTO deals(name,value,stage,owner_id,product_id,product_name,qty,estimated_close,status,prospect_id,contact_id,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [String(data.name).trim(), value, data.stage || 'Prospek', actor.id, data.product_id || null,
     String(data.product_name || '').trim(), Number(data.qty) || 1, data.estimated_close || null,
     'Open', data.prospect_id || null, data.contact_id || null, String(data.notes || '').trim(), NOW(), NOW()]);
  const id = DB.lastId();
  if (data.prospect_id) {
    DB.run("UPDATE prospects SET stage=? WHERE id=?", [data.stage || 'Kualifikasi', data.prospect_id]);
  }
  audit('DEAL_CREATE', 'deal', id, { name: data.name, value }, actor);
  return { ok: true, id };
}

function updateDeal(actor, id, data) {
  const d = getDeal(actor, id);
  if (!d) return { ok: false, error: 'Deal tidak ditemukan.' };
  if (d.status === 'Won' && actor.role !== 'Admin') return { ok: false, error: 'Deal Won terkunci — hanya Admin yang bisa mengubah.' };
  if (!actorPermission(actor, d)) return { ok: false, error: 'Tidak punya akses.' };
  DB.run("UPDATE deals SET name=?, value=?, stage=?, product_id=?, product_name=?, qty=?, estimated_close=?, prospect_id=?, contact_id=?, notes=?, updated_at=? WHERE id=?",
    [String(data.name).trim(), Math.max(0, Number(data.value) || 0), data.stage || d.stage, data.product_id || null,
     String(data.product_name || '').trim(), Number(data.qty) || 1, data.estimated_close || null,
     data.prospect_id || null, data.contact_id || null, String(data.notes || '').trim(), NOW(), id]);
  audit('DEAL_UPDATE', 'deal', id, {}, actor);
  return { ok: true };
}

/** Transisi kanban: pindah tahapan / won / lost. Won → hitung komisi + kunci. */
function moveDeal(actor, id, newStage, opts) {
  opts = opts || {};
  const d = getDeal(actor, id);
  if (!d) return { ok: false, error: 'Deal tidak ditemukan.' };
  if (!actorPermission(actor, d)) return { ok: false, error: 'Tidak punya akses.' };
  if (d.status === 'Won') return { ok: false, error: 'Deal sudah Won dan terkunci.' };

  // Validasi transisi
  if (newStage === 'Won' || (opts.status === 'Won')) {
    if (actor.role === 'Sales') return { ok: false, error: 'Konfirmasi deal menang memerlukan Team Leader / Manager.' };
    if (!(d.value > 0)) return { ok: false, error: 'Nilai deal harus lebih dari 0 sebelum ditutup.' };
    DB.run("UPDATE deals SET status='Won', won_date=?, stage='Deal', lost_reason=NULL, scheme_snapshot=?, updated_at=? WHERE id=?",
      [opts.wonDate || TODAY(), JSON.stringify(activeSchemeSnapshot()), NOW(), id]);
    const res = calculateCommissionForDeal(actor, id);
    audit('DEAL_WON', 'deal', id, { value: d.value, commission: res.nominal }, actor);
    return { ok: true, result: res };
  }
  if (newStage === 'Lost' || (opts.status === 'Lost')) {
    const reason = String(opts.lostReason || '').trim();
    if (!reason) return { ok: false, error: 'Alasan deal gagal (lost) wajib diisi.' };
    if (actor.role === 'Sales') return { ok: false, error: 'Konfirmasi deal gagal memerlukan Team Leader / Manager.' };
    DB.run("UPDATE deals SET status='Lost', lost_reason=?, updated_at=? WHERE id=?", [reason, NOW(), id]);
    audit('DEAL_LOST', 'deal', id, { reason }, actor);
    return { ok: true };
  }
  // Pindah tahapan biasa
  DB.run("UPDATE deals SET stage=?, updated_at=? WHERE id=?", [newStage, NOW(), id]);
  if (d.prospect_id) DB.run("UPDATE prospects SET stage=? WHERE id=?", [newStage, d.prospect_id]);
  audit('DEAL_STAGE', 'deal', id, { from: d.stage, to: newStage }, actor);
  return { ok: true };
}

function deleteDeal(actor, id, reason) {
  const d = getDeal(actor, id);
  if (!d) return { ok: false, error: 'Deal tidak ditemukan.' };
  DB.run("UPDATE deals SET deleted_at=?, updated_at=? WHERE id=?", [NOW(), NOW(), id]);
  audit('DEAL_DELETE', 'deal', id, { reason: reason || '' }, actor);
  return { ok: true };
}

/* ============================= COMMISSION ENGINE ============================= */

function activeSchemeSnapshot() {
  const s = DB.get("SELECT * FROM commission_schemes WHERE active=1 AND deleted_at IS NULL ORDER BY effective_date DESC LIMIT 1");
  if (!s) return { type: 'percent', params: { percent: 0 }, name: 'Tanpa Skema' };
  return { type: s.type, params: JSON.parse(s.params || '{}'), name: s.name, id: s.id };
}

/** Kalkulasi murni: nominal komisi dari skema + nilai deal. (AC-CM-01) */
function calcCommission(scheme, dealValue) {
  const v = Number(dealValue) || 0;
  const type = scheme.type;
  const p = scheme.params || {};
  let nominal = 0, percentApplied = 0, detail = [];
  if (type === 'percent') {
    const pct = Number(p.percent) || 0;
    nominal = v * pct / 100;
    percentApplied = pct;
    detail.push({ label: pct + '% dari nilai deal', value: nominal });
  } else if (type === 'tier') {
    const tiers = Array.isArray(p.tiers) ? p.tiers : [];
    let remaining = v, from = 0;
    for (const t of tiers) {
      const hi = t[1] == null ? Infinity : Number(t[1]);
      const pct = Number(t[2]) || 0;
      const span = Math.max(0, Math.min(hi, remaining) - from);
      if (span > 0) {
        const amt = span * pct / 100;
        nominal += amt;
        percentApplied = pct;
        detail.push({ label: 'Tier ' + fmtRp(from) + '–' + (t[1] == null ? '∞' : fmtRp(t[1])) + ' @ ' + pct + '%', value: amt });
      }
      from = hi;
      if (remaining <= from) break;
    }
  } else if (type === 'target') {
    // base vs bonus — keputusan di true-up
    const base = Number(p.basePercent) || 0;
    nominal = v * base / 100;
    percentApplied = base;
    detail.push({ label: 'Base ' + base + '% (target-based)', value: nominal });
  }
  return { nominal: Math.round(nominal), percentApplied, detail, type };
}

function listSchemes() {
  return DB.query("SELECT * FROM commission_schemes WHERE deleted_at IS NULL ORDER BY active DESC, effective_date DESC");
}

function createScheme(actor, data) {
  if (!String(data.name || '').trim()) return { ok: false, error: 'Nama skema wajib.' };
  if (!['percent', 'tier', 'target'].includes(data.type)) return { ok: false, error: 'Tipe skema tidak valid.' };
  let params;
  try { params = JSON.parse(data.params || '{}'); } catch (e) { return { ok: false, error: 'Parameter JSON tidak valid.' }; }
  DB.run("INSERT INTO commission_schemes(name,type,params,active,effective_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
    [String(data.name).trim(), data.type, JSON.stringify(params), data.active ? 1 : 0, data.effective_date || TODAY(), NOW(), NOW()]);
  if (data.active) DB.run("UPDATE commission_schemes SET active=0 WHERE id<>?", [DB.lastId()]);
  audit('SCHEME_CREATE', 'commission_scheme', DB.lastId(), { name: data.name, type: data.type }, actor);
  return { ok: true };
}

function updateScheme(actor, id, data) {
  const s = DB.get('SELECT * FROM commission_schemes WHERE id=?', [id]);
  if (!s) return { ok: false, error: 'Skema tidak ditemukan.' };
  let params;
  try { params = JSON.parse(data.params || '{}'); } catch (e) { return { ok: false, error: 'Parameter JSON tidak valid.' }; }
  const oldParams = s.params;
  DB.run("UPDATE commission_schemes SET name=?, type=?, params=?, active=?, effective_date=?, updated_at=? WHERE id=?",
    [String(data.name).trim(), data.type, JSON.stringify(params), data.active ? 1 : 0, data.effective_date || s.effective_date, NOW(), id]);
  if (data.active) DB.run("UPDATE commission_schemes SET active=0 WHERE id<>?", [id]);
  audit('SCHEME_UPDATE', 'commission_scheme', id, { old: JSON.parse(oldParams), new: params }, actor);
  return { ok: true };
}

function calculateCommissionForDeal(actor, dealId) {
  const d = getDeal(actor, dealId);
  const scheme = JSON.parse(d.scheme_snapshot || '{}');
  const res = calcCommission(scheme, d.value);
  const pct = res.percentApplied;
  DB.run("INSERT INTO commissions(deal_id,user_id,deal_value,percent,nominal,scheme_snapshot,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    [dealId, d.owner_id, d.value, pct, res.nominal, JSON.stringify({ type: scheme.type, params: scheme.params, name: scheme.name }), 'Confirmed', NOW(), NOW()]);
  const id = DB.lastId();
  audit('COMMISSION_CALC', 'commission', id, { deal: dealId, value: d.value, pct, nominal: res.nominal }, actor);
  return { ok: true, id, nominal: res.nominal, detail: res.detail, percentApplied: pct };
}

/** Override komisi — wajib alasan + audit (CM-005, AC-CM-02) */
function overrideCommission(actor, commissionId, newNominal, reason) {
  if (!String(reason || '').trim()) return { ok: false, error: 'Alasan override WAJIB diisi.' };
  const c = DB.get('SELECT * FROM commissions WHERE id=?', [commissionId]);
  if (!c) return { ok: false, error: 'Komisi tidak ditemukan.' };
  DB.run("UPDATE commissions SET nominal=?, status='Overridden', reason_override=?, updated_at=? WHERE id=?",
    [Math.max(0, Number(newNominal) || 0), String(reason).trim(), NOW(), commissionId]);
  audit('COMMISSION_OVERRIDE', 'commission', commissionId, {
    deal: c.deal_id, oldValue: c.nominal, newValue: Number(newNominal), reason
  }, actor);
  return { ok: true };
}

/** True-up target-based di akhir bulan / saat target tercapai. */
function runTrueUp(actor, month) {
  month = month || currentMonth();
  const scheme = DB.get("SELECT * FROM commission_schemes WHERE type='target' AND deleted_at IS NULL AND active=1");
  if (!scheme) return { ok: true, added: 0, note: 'Tidak ada skema target-based aktif.' };
  const params = JSON.parse(scheme.params || '{}');
  const base = Number(params.basePercent) || 0, bonus = Number(params.bonusPercent) || 0;
  if (bonus <= base) return { ok: true, added: 0, note: 'Bonus tidak lebih besar dari base.' };
  const users = DB.query("SELECT DISTINCT owner_id FROM deals WHERE status='Won' AND won_date LIKE ? AND deleted_at IS NULL", [month + '%']);
  let added = 0;
  for (const u of users) {
    const ach = achievementFor(u.owner_id, month);
    if (ach.percent >= 100) {
      const deals = DB.query("SELECT d.*, c.id AS cid, c.nominal AS paid FROM deals d LEFT JOIN commissions c ON c.deal_id=d.id AND c.status='Confirmed' WHERE d.status='Won' AND d.owner_id=? AND d.won_date LIKE ? AND d.deleted_at IS NULL", [u.owner_id, month + '%']);
      for (const d of deals) {
        if (d.cid == null) continue;
        const snap = JSON.parse(d.scheme_snapshot || '{}');
        if (snap.type !== 'target') continue;
        const diff = Math.round(d.value * (bonus - base) / 100);
        if (diff <= 0) continue;
        const exists = DB.get("SELECT id FROM commissions WHERE deal_id=? AND reason_override LIKE 'TRUE-UP%'", [d.id]);
        if (exists) continue;
        DB.run("INSERT INTO commissions(deal_id,user_id,deal_value,percent,nominal,scheme_snapshot,status,reason_override,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
          [d.id, d.owner_id, d.value, bonus, diff, JSON.stringify(snap), 'Confirmed', 'TRUE-UP target tercapai', NOW(), NOW()]);
        added++;
      }
    }
  }
  if (added) audit('TRUE_UP', 'commission', 0, { month, added }, { id: null, username: 'system' });
  return { ok: true, added };
}

/** Forecast: Σ deal open × pct skema aktif (F-12) */
function commissionForecast(user) {
  const scheme = activeSchemeSnapshot();
  const deals = DB.query("SELECT * FROM deals WHERE status='Open' AND deleted_at IS NULL AND " + scopeCondition(user, '').replace(/ AND $/, ''));
  let total = 0;
  for (const d of deals) total += calcCommission(scheme, d.value).nominal;
  return { total: Math.round(total), count: deals.length };
}

function listCommissions(user, filters) {
  filters = filters || {};
  let sql = "SELECT c.*, d.name AS deal_name, u.name AS owner_name FROM commissions c LEFT JOIN deals d ON d.id=c.deal_id LEFT JOIN users u ON u.id=c.user_id WHERE 1=1";
  const params = [];
  if (user.role === 'Sales') { sql += " AND c.user_id=?"; params.push(user.id); }
  else if (user.role === 'TeamLeader') {
    const ids = teamMemberIds(user);
    sql += " AND c.user_id IN (" + ids.join(',') + ")";
  }
  if (filters.month) { sql += " AND strftime('%Y-%m', c.created_at)=?"; params.push(filters.month); }
  if (filters.status) { sql += " AND c.status=?"; params.push(filters.status); }
  sql += " ORDER BY c.created_at DESC";
  return DB.query(sql, params);
}

/* ============================= ACTIVITIES ============================= */

function addActivity(actor, data) {
  const type = data.type || 'note';
  DB.run("INSERT INTO activities(type,prospect_id,deal_id,user_id,note,created_at) VALUES(?,?,?,?,?,?)",
    [type, data.prospect_id || null, data.deal_id || null, actor.id, String(data.note || '').trim(), NOW()]);
  return { ok: true, id: DB.lastId() };
}

function listActivities(user, entityType, entityId, limit) {
  let sql = "SELECT a.*, u.name AS user_name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE 1=1";
  const params = [];
  if (entityType === 'prospect') { sql += " AND a.prospect_id=?"; params.push(entityId); }
  if (entityType === 'deal') { sql += " AND a.deal_id=?"; params.push(entityId); }
  if (user.role === 'Sales') { sql += " AND a.user_id=?"; params.push(user.id); }
  sql += " ORDER BY a.created_at DESC LIMIT " + (limit || 100);
  return DB.query(sql, params);
}

function recentActivities(user, limit) {
  let sql = "SELECT a.*, u.name AS user_name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE 1=1";
  const params = [];
  if (user.role === 'Sales') { sql += " AND a.user_id=?"; params.push(user.id); }
  else if (user.role === 'TeamLeader') {
    const ids = teamMemberIds(user);
    sql += " AND a.user_id IN (" + ids.join(',') + ")";
  }
  sql += " ORDER BY a.created_at DESC LIMIT " + (limit || 10);
  return DB.query(sql, params);
}

/* ============================= FOLLOW-UPS ============================= */

function refreshOverdue() {
  DB.run("UPDATE followups SET status='Overdue' WHERE status='Open' AND due_date < ? AND deleted_at IS NULL", [TODAY()]);
}

function listFollowups(user, filters) {
  filters = filters || {};
  refreshOverdue();
  let sql = "SELECT f.*, u.name AS owner_name, p.name AS prospect_name FROM followups f LEFT JOIN users u ON u.id=f.owner_id LEFT JOIN prospects p ON p.id=f.prospect_id WHERE f.deleted_at IS NULL AND ";
  sql += scopeCondition(user, 'f.');
  const params = [];
  if (filters.status) { sql += "f.status=? AND "; params.push(filters.status); }
  if (filters.search) { sql += "(f.title LIKE ?) AND "; params.push('%' + filters.search + '%'); }
  sql = sql.replace(/ AND $/, '');
  sql += " ORDER BY CASE f.status WHEN 'Overdue' THEN 0 WHEN 'Open' THEN 1 ELSE 2 END, f.due_date ASC";
  return DB.query(sql, params);
}

function createFollowup(actor, data) {
  if (!String(data.title || '').trim()) return { ok: false, error: 'Judul follow-up wajib.' };
  if (!data.due_date) return { ok: false, error: 'Tanggal jatuh tempo wajib.' };
  DB.run("INSERT INTO followups(title,prospect_id,deal_id,owner_id,due_date,priority,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    [String(data.title).trim(), data.prospect_id || null, data.deal_id || null, actor.id, data.due_date,
     data.priority || 'Normal', 'Open', String(data.notes || '').trim(), NOW(), NOW()]);
  audit('FOLLOWUP_CREATE', 'followup', DB.lastId(), { title: data.title, due: data.due_date }, actor);
  return { ok: true, id: DB.lastId() };
}

function completeFollowup(actor, id) {
  const f = DB.get('SELECT * FROM followups WHERE id=?', [id]);
  if (!f) return { ok: false, error: 'Follow-up tidak ditemukan.' };
  DB.run("UPDATE followups SET status='Done', completed_at=?, updated_at=? WHERE id=?", [NOW(), NOW(), id]);
  addActivity(actor, { type: 'note', prospect_id: f.prospect_id, deal_id: f.deal_id, note: 'Follow-up selesai: ' + f.title });
  audit('FOLLOWUP_DONE', 'followup', id, {}, actor);
  return { ok: true };
}

function deleteFollowup(actor, id, reason) {
  DB.run("UPDATE followups SET deleted_at=?, updated_at=? WHERE id=?", [NOW(), NOW(), id]);
  audit('FOLLOWUP_DELETE', 'followup', id, { reason: reason || '' }, actor);
  return { ok: true };
}

/* ============================= MEETINGS ============================= */

function listMeetings(user, filters) {
  filters = filters || {};
  let sql = "SELECT m.*, u.name AS owner_name FROM meetings m LEFT JOIN users u ON u.id=m.user_id WHERE m.deleted_at IS NULL";
  // meetings bersifat bersama (semua role bisa lihat) — scope minimal untuk Sales
  const params = [];
  if (filters.search) { sql += " AND (m.title LIKE ? OR m.location LIKE ?)"; params.push('%' + filters.search + '%', '%' + filters.search + '%'); }
  if (filters.month) { sql += " AND m.start_time LIKE ?"; params.push(filters.month + '%'); }
  sql += " ORDER BY m.start_time";
  return DB.query(sql, params);
}

function createMeeting(actor, data) {
  if (!String(data.title || '').trim()) return { ok: false, error: 'Judul meeting wajib.' };
  if (!data.start_time) return { ok: false, error: 'Waktu meeting wajib.' };
  DB.run("INSERT INTO meetings(title,participants,start_time,location,agenda,prospect_id,deal_id,reminder_min,user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    [String(data.title).trim(), String(data.participants || '').trim(), data.start_time, String(data.location || '').trim(),
     String(data.agenda || '').trim(), data.prospect_id || null, data.deal_id || null,
     Number(data.reminder_min) || 15, actor.id, NOW(), NOW()]);
  audit('MEETING_CREATE', 'meeting', DB.lastId(), { title: data.title }, actor);
  return { ok: true, id: DB.lastId() };
}

function deleteMeeting(actor, id, reason) {
  DB.run("UPDATE meetings SET deleted_at=?, updated_at=? WHERE id=?", [NOW(), NOW(), id]);
  audit('MEETING_DELETE', 'meeting', id, { reason: reason || '' }, actor);
  return { ok: true };
}

/* ============================= TARGETS & KPI ============================= */

function setTarget(actor, userId, month, data) {
  const exists = DB.get('SELECT id FROM targets WHERE user_id=? AND month=?', [userId, month]);
  if (exists) {
    DB.run("UPDATE targets SET target_revenue=?, activity_target=?, followup_target=?, deal_target=?, updated_at=? WHERE id=?",
      [Math.max(0, Number(data.target_revenue) || 0), Number(data.activity_target) || 0, Number(data.followup_target) || 0, Number(data.deal_target) || 0, NOW(), exists.id]);
  } else {
    DB.run("INSERT INTO targets(user_id,month,target_revenue,activity_target,followup_target,deal_target,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      [userId, month, Math.max(0, Number(data.target_revenue) || 0), Number(data.activity_target) || 0, Number(data.followup_target) || 0, Number(data.deal_target) || 0, NOW(), NOW()]);
  }
  audit('TARGET_SET', 'target', userId, { month, target: data.target_revenue }, actor);
  return { ok: true };
}

function achievementFor(userId, month) {
  const target = DB.get('SELECT * FROM targets WHERE user_id=? AND month=?', [userId, month]);
  const revenue = DB.get("SELECT COALESCE(SUM(value),0) AS v FROM deals WHERE status='Won' AND owner_id=? AND won_date LIKE ? AND deleted_at IS NULL", [userId, month + '%']);
  const rev = Number(revenue.v) || 0;
  const tgt = target ? Number(target.target_revenue) || 0 : 0;
  const activities = DB.get("SELECT count(*) AS c FROM activities WHERE user_id=? AND created_at LIKE ?", [userId, month + '%']);
  const followupsDone = DB.get("SELECT count(*) AS c FROM followups WHERE owner_id=? AND status='Done' AND completed_at LIKE ? AND deleted_at IS NULL", [userId, month + '%']);
  const dealsWon = DB.get("SELECT count(*) AS c FROM deals WHERE status='Won' AND owner_id=? AND won_date LIKE ? AND deleted_at IS NULL", [userId, month + '%']);
  const aTarget = target ? Number(target.activity_target) || 0 : 0;
  const fTarget = target ? Number(target.followup_target) || 0 : 0;
  const dTarget = target ? Number(target.deal_target) || 0 : 0;
  const percent = tgt > 0 ? Math.round(rev / tgt * 1000) / 10 : null;
  return {
    target: tgt, revenue: rev, percent,
    activities: Number(activities.c) || 0, activity_target: aTarget,
    followups_done: Number(followupsDone.c) || 0, followup_target: fTarget,
    deals_won: Number(dealsWon.c) || 0, deal_target: dTarget
  };
}

/** Personal Scorecard (TG-004): 0.2 aktivitas + 0.2 follow-up + 0.3 deal + 0.3 revenue */
function scorecard(user, month) {
  const a = achievementFor(user.id, month);
  const norm = (val, target) => { const t = Number(target) || 0; return t > 0 ? Math.min(100, Math.round(val / t * 100)) : 0; };
  const sActivity = norm(a.activities, a.activity_target);
  const sFollowup = norm(a.followups_done, a.followup_target);
  const sDeal = norm(a.deals_won, a.deal_target);
  const sRevenue = norm(a.revenue, a.target);
  const score = Math.round(0.2 * sActivity + 0.2 * sFollowup + 0.3 * sDeal + 0.3 * sRevenue);
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Focus';
  return { score, label, sActivity, sFollowup, sDeal, sRevenue, achievement: a };
}

function listTargets(user, month) {
  let sql = "SELECT t.*, u.name AS user_name FROM targets t JOIN users u ON u.id=t.user_id WHERE t.month=? AND u.deleted_at IS NULL";
  const params = [month];
  if (user.role === 'Sales') { sql += " AND t.user_id=?"; params.push(user.id); }
  else if (user.role === 'TeamLeader') {
    const ids = teamMemberIds(user);
    sql += " AND t.user_id IN (" + ids.join(',') + ")";
  }
  const rows = DB.query(sql, params);
  return rows.map(r => Object.assign({}, r, achievementFor(r.user_id, month)));
}

/* ============================= DASHBOARD (19 WIDGET) ============================= */

function dashboard(user, period) {
  period = period || 'day'; // day|week|month
  refreshOverdue();
  const today = TODAY();
  const start = periodStart(period);
  const ids = visibleUserIds(user);
  const idList = ids.join(',');
  const scoped = user.role !== 'Admin' && user.role !== 'Manager' ? 'owner_id IN (' + idList + ')' : '1=1';
  const myScoped = 'owner_id=' + user.id;

  // F-01 Priorities
  const fups = DB.query("SELECT * FROM followups f WHERE f.status IN ('Open','Overdue') AND f.deleted_at IS NULL AND f.due_date <= date('now','+7 day') AND f." + myScoped);
  const deals = DB.query("SELECT * FROM deals d WHERE d.status='Open' AND d.deleted_at IS NULL AND d." + myScoped);
  const priorities = [];
  for (const f of fups) {
    const dd = daysUntil(f.due_date);
    const score = (1 / Math.max(dd === null ? 7 : dd, 1)) * 10 + (f.priority === 'High' ? 5 : f.priority === 'Normal' ? 3 : 1);
    priorities.push({ type: 'followup', id: f.id, title: f.title, due: f.due_date, overdue: f.status === 'Overdue', score });
  }
  for (const d of deals) {
    if (!d.estimated_close) continue;
    const dd = daysUntil(d.estimated_close);
    if (dd === null || dd > 7) continue;
    const score = (1 / Math.max(dd, 1)) * 10 + 3 + Math.min(d.value / 10000000, 10) * 0.5;
    priorities.push({ type: 'deal', id: d.id, title: d.name, due: d.estimated_close, value: d.value, score });
  }
  priorities.sort((a, b) => b.score - a.score);
  const todayFups = DB.query("SELECT f.*, p.name AS prospect_name FROM followups f LEFT JOIN prospects p ON p.id=f.prospect_id WHERE f.due_date=? AND f.status='Open' AND f.deleted_at IS NULL AND f." + myScoped + " ORDER BY f.priority", [today]);
  const todayMeetings = DB.query("SELECT * FROM meetings WHERE start_time LIKE ? AND deleted_at IS NULL ORDER BY start_time", [today + '%']);
  const overdue = DB.query("SELECT f.*, u.name AS owner_name, p.name AS prospect_name FROM followups f LEFT JOIN users u ON u.id=f.owner_id LEFT JOIN prospects p ON p.id=f.prospect_id WHERE f.status='Overdue' AND f.deleted_at IS NULL AND f." + scoped + " ORDER BY f.due_date ASC");
  const newProspects = (DB.query("SELECT count(*) AS c FROM prospects p WHERE p.created_at >= ? AND p.deleted_at IS NULL AND p." + scoped, [start])[0] || {});
  const prevProspects = (DB.query("SELECT count(*) AS c FROM prospects p WHERE p.created_at >= ? AND p.created_at < ? AND p.deleted_at IS NULL AND p." + scoped, [prevPeriodStart(period), start])[0] || {});
  const openOpps = (DB.query("SELECT count(*) AS c, COALESCE(SUM(value),0) AS v FROM deals d WHERE d.status='Open' AND d.deleted_at IS NULL AND d." + scoped)[0] || {});
  const closingSoon = DB.query("SELECT * FROM deals d WHERE d.status='Open' AND d.deleted_at IS NULL AND d.estimated_close >= ? AND d.estimated_close <= ? AND d." + scoped + " ORDER BY d.estimated_close", [today, addDays(today, 7)]);
  const monthRevenue = (DB.query("SELECT COALESCE(SUM(value),0) AS v FROM deals d WHERE d.status='Won' AND d.won_date LIKE ? AND d.deleted_at IS NULL AND d." + scoped, [currentMonth() + '%'])[0] || {});
  const monthTarget = (DB.query("SELECT COALESCE(SUM(target_revenue),0) AS v FROM targets WHERE month=? AND user_id IN (" + (user.role === 'Sales' ? String(user.id) : idList) + ")", [currentMonth()])[0] || {});
  const monthComm = (DB.query("SELECT COALESCE(SUM(nominal),0) AS v FROM commissions WHERE status IN ('Confirmed','Overridden') AND strftime('%Y-%m', created_at)=? AND user_id IN (" + idList + ")", [currentMonth()])[0] || {});
  const actToday = (DB.query("SELECT count(*) AS c FROM activities a WHERE a.created_at LIKE ? AND a.user_id IN (" + idList + ")", [today + '%'])[0] || {});
  const actTypes = DB.query("SELECT type, count(*) AS c FROM activities a WHERE a.created_at LIKE ? AND a.user_id IN (" + idList + ") GROUP BY type", [today + '%']);
  const recentAct = recentActivities(user, 10);
  const deadlines = DB.query("SELECT 'followup' AS kind, f.id, f.title, f.due_date AS date FROM followups f WHERE f.status='Open' AND f.deleted_at IS NULL AND f.due_date BETWEEN ? AND ? AND f." + myScoped +
    " UNION ALL SELECT 'deal', d.id, d.name, d.estimated_close FROM deals d WHERE d.status='Open' AND d.deleted_at IS NULL AND d.estimated_close BETWEEN ? AND ? AND d." + myScoped +
    " ORDER BY date", [today, addDays(today, 7), today, addDays(today, 7)]);
  const forecast = commissionForecast(user);
  const sc = scorecard(user, currentMonth());
  const ach = achievementFor(user.id, currentMonth());

  const targetVal = user.role === 'Sales' ? (monthTarget.v || 0) : (monthTarget.v || 0);
  const targetPct = targetVal > 0 ? Math.round(Number(monthRevenue.v) / targetVal * 1000) / 10 : null;

  return {
    today, period,
    priorities: priorities.slice(0, 5),
    today_followups: todayFups,
    today_meetings: todayMeetings.map(m => Object.assign({}, m, { in_minutes: minutesTo(m.start_time) })),
    overdue,
    new_prospects: Number(newProspects.c) || 0,
    new_prospects_delta: prevDelta(prevProspects.c, newProspects.c),
    open_opportunities: { count: Number(openOpps.c) || 0, value: Number(openOpps.v) || 0 },
    closing_soon: closingSoon,
    month_revenue: Number(monthRevenue.v) || 0,
    month_target: Number(targetVal) || 0,
    target_percent: targetPct,
    commission_earned: Number(monthComm.v) || 0,
    commission_forecast: forecast,
    activity_today: { count: Number(actToday.c) || 0, types: actTypes },
    recent_activity: recentAct,
    deadlines,
    scorecard: sc,
    achievement: ach,
    weekly_performance: weeklyPerformance(user),
    monthly_performance: monthlyPerformance(user)
  };
}

function prevDelta(prev, cur) {
  const p = Number(prev) || 0, c = Number(cur) || 0;
  if (p <= 0) return c > 0 ? 100 : 0;
  return Math.round((c - p) / p * 100);
}

function periodStart(period) {
  const d = new Date();
  if (period === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 19).replace('T', ' ');
  if (period === 'week') {
    const day = (d.getDay() + 6) % 7; // Senin=0
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).toISOString().slice(0, 19).replace('T', ' ');
  }
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 19).replace('T', ' ');
}

function prevPeriodStart(period) {
  const d = new Date();
  if (period === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).toISOString().slice(0, 19).replace('T', ' ');
  if (period === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).toISOString().slice(0, 19).replace('T', ' ');
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 19).replace('T', ' ');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function minutesTo(iso) {
  const d = new Date(String(iso).replace(' ', 'T'));
  return Math.round((d - Date.now()) / 60000);
}

function weeklyPerformance(user) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const ids = visibleUserIds(user).join(',');
    const rev = DB.get("SELECT COALESCE(SUM(value),0) AS v FROM deals WHERE status='Won' AND won_date=? AND deleted_at IS NULL AND owner_id IN (" + ids + ")", [ds]);
    const act = DB.get("SELECT count(*) AS c FROM activities WHERE created_at LIKE ? AND user_id IN (" + ids + ")", [ds + '%']);
    out.push({ date: ds, day: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()], revenue: Number(rev.v) || 0, activities: Number(act.c) || 0 });
  }
  return out;
}

function monthlyPerformance(user) {
  const out = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    const ids = visibleUserIds(user).join(',');
    const rev = DB.get("SELECT COALESCE(SUM(value),0) AS v FROM deals WHERE status='Won' AND won_date LIKE ? AND deleted_at IS NULL AND owner_id IN (" + ids + ")", [ym + '%']);
    const pr = DB.get("SELECT count(*) AS c FROM prospects WHERE created_at LIKE ? AND deleted_at IS NULL AND owner_id IN (" + ids + ")", [ym + '%']);
    const won = DB.get("SELECT count(*) AS c FROM deals WHERE status='Won' AND won_date LIKE ? AND deleted_at IS NULL AND owner_id IN (" + ids + ")", [ym + '%']);
    const lost = DB.get("SELECT count(*) AS c FROM deals WHERE status='Lost' AND won_date LIKE ? AND deleted_at IS NULL AND owner_id IN (" + ids + ")", [ym + '%']);
    const w = Number(won.c) || 0, l = Number(lost.c) || 0;
    out.push({ month: ym, label: ym.slice(5) + '/' + ym.slice(2, 4), revenue: Number(rev.v) || 0, prospects: Number(pr.c) || 0, win_rate: (w + l) > 0 ? Math.round(w / (w + l) * 100) : 0 });
  }
  return out;
}

/* ============================= REPORTS & EXCEL ============================= */

async function exportExcel(user, reportType, opts) {
  opts = opts || {};
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SalesDesk Pro — VeryCoolApps';
  wb.created = new Date();
  const month = opts.month || currentMonth();
  const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15233B' } }, alignment: { vertical: 'middle', horizontal: 'center' } };
  const moneyFmt = '"Rp" #,##0';

  if (reportType === 'prospects') {
    const ws = wb.addWorksheet('Prospek');
    ws.columns = [{ header: 'Nama', key: 'name', width: 28 }, { header: 'Perusahaan', key: 'company', width: 28 }, { header: 'Sumber', key: 'source', width: 14 }, { header: 'Tahapan', key: 'stage', width: 14 }, { header: 'Estimasi Nilai', key: 'estimated_value', width: 18 }, { header: 'Pemilik', key: 'owner_name', width: 18 }, { header: 'Dibuat', key: 'created_at', width: 20 }];
    const rows = DB.query("SELECT p.*, u.name AS owner_name FROM prospects p LEFT JOIN users u ON u.id=p.owner_id WHERE p.deleted_at IS NULL AND " + scopeCondition(user, 'p.').replace(/ AND $/, '') + " ORDER BY p.created_at DESC");
    for (const r of rows) ws.addRow({ name: r.name, company: r.company || '', source: r.source || '', stage: r.stage, estimated_value: r.estimated_value, owner_name: r.owner_name || '', created_at: r.created_at });
    ws.getRow(1).eachCell(c => c.style = headerStyle);
    ws.getColumn('estimated_value').numFmt = moneyFmt;
    ws.getRow(1).height = 22;
    ws.autoFilter = { from: 'A1', to: 'G' + (rows.length + 1) };
    const sum = rows.reduce((a, r) => a + Number(r.estimated_value || 0), 0);
    const sr = ws.addRow({ name: 'TOTAL', estimated_value: sum });
    sr.font = { bold: true };
    sr.getCell('estimated_value').numFmt = moneyFmt;
  } else if (reportType === 'deals') {
    const ws = wb.addWorksheet('Pipeline & Deal');
    ws.columns = [{ header: 'Nama Deal', key: 'name', width: 30 }, { header: 'Tahapan', key: 'stage', width: 14 }, { header: 'Status', key: 'status', width: 10 }, { header: 'Nilai', key: 'value', width: 18 }, { header: 'Pemilik', key: 'owner_name', width: 18 }, { header: 'Estimasi Closing', key: 'estimated_close', width: 16 }, { header: 'Won Date', key: 'won_date', width: 14 }, { header: 'Catatan', key: 'notes', width: 30 }];
    const rows = DB.query("SELECT d.*, u.name AS owner_name FROM deals d LEFT JOIN users u ON u.id=d.owner_id WHERE d.deleted_at IS NULL AND " + scopeCondition(user, 'd.').replace(/ AND $/, '') + " ORDER BY d.created_at DESC");
    for (const r of rows) ws.addRow({ name: r.name, stage: r.stage, status: r.status, value: r.value, owner_name: r.owner_name || '', estimated_close: r.estimated_close || '', won_date: r.won_date || '', notes: r.notes || '' });
    ws.getRow(1).eachCell(c => c.style = headerStyle);
    ws.getColumn('value').numFmt = moneyFmt;
    ws.autoFilter = { from: 'A1', to: 'H' + (rows.length + 1) };
    const totalOpen = rows.filter(r => r.status === 'Open').reduce((a, r) => a + Number(r.value || 0), 0);
    const totalWon = rows.filter(r => r.status === 'Won').reduce((a, r) => a + Number(r.value || 0), 0);
    const sr = ws.addRow({ name: 'TOTAL OPEN', value: totalOpen });
    sr.font = { bold: true }; sr.getCell('value').numFmt = moneyFmt;
    const wr = ws.addRow({ name: 'TOTAL WON', value: totalWon });
    wr.font = { bold: true }; wr.getCell('value').numFmt = moneyFmt;
  } else if (reportType === 'commissions') {
    const ws = wb.addWorksheet('Komisi ' + month);
    ws.columns = [{ header: 'Deal', key: 'deal_name', width: 30 }, { header: 'Sales', key: 'owner_name', width: 20 }, { header: 'Nilai Deal', key: 'deal_value', width: 18 }, { header: '%', key: 'percent', width: 8 }, { header: 'Komisi', key: 'nominal', width: 18 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Tanggal', key: 'created_at', width: 20 }];
    const rows = listCommissions(user, { month });
    for (const r of rows) ws.addRow({ deal_name: r.deal_name || '-', owner_name: r.owner_name || '', deal_value: r.deal_value, percent: r.percent, nominal: r.nominal, status: r.status, created_at: r.created_at });
    ws.getRow(1).eachCell(c => c.style = headerStyle);
    ws.getColumn('deal_value').numFmt = moneyFmt;
    ws.getColumn('nominal').numFmt = moneyFmt;
    ws.autoFilter = { from: 'A1', to: 'G' + (rows.length + 1) };
    const total = rows.reduce((a, r) => a + Number(r.nominal || 0), 0);
    const sr = ws.addRow({ deal_name: 'TOTAL KOMISI', nominal: total });
    sr.font = { bold: true }; sr.getCell('nominal').numFmt = moneyFmt;
  } else if (reportType === 'performance') {
    const ws = wb.addWorksheet('Performa Tim');
    ws.columns = [{ header: 'Sales', key: 'name', width: 24 }, { header: 'Target Bulanan', key: 'target', width: 18 }, { header: 'Revenue', key: 'revenue', width: 18 }, { header: 'Pencapaian %', key: 'percent', width: 14 }, { header: 'Aktivitas', key: 'activities', width: 12 }, { header: 'Follow-up Selesai', key: 'fups', width: 18 }, { header: 'Deal Won', key: 'deals', width: 10 }, { header: 'Scorecard', key: 'score', width: 12 }];
    const users = DB.query("SELECT * FROM users WHERE deleted_at IS NULL AND status='Active' AND id IN (" + visibleUserIds(user).join(',') + ") ORDER BY name");
    for (const u of users) {
      const a = achievementFor(u.id, month);
      const sc = scorecard(u, month);
      ws.addRow({ name: u.name, target: a.target, revenue: a.revenue, percent: a.percent, activities: a.activities, fups: a.followups_done, deals: a.deals_won, score: sc.score });
    }
    ws.getRow(1).eachCell(c => c.style = headerStyle);
    ws.getColumn('target').numFmt = moneyFmt;
    ws.getColumn('revenue').numFmt = moneyFmt;
  } else if (reportType === 'followups') {
    const ws = wb.addWorksheet('Follow-up');
    ws.columns = [{ header: 'Judul', key: 'title', width: 30 }, { header: 'Status', key: 'status', width: 10 }, { header: 'Prioritas', key: 'priority', width: 10 }, { header: 'Due Date', key: 'due_date', width: 14 }, { header: 'Pemilik', key: 'owner_name', width: 18 }, { header: 'Prospek', key: 'prospect_name', width: 24 }];
    const rows = listFollowups(user, {});
    for (const r of rows) ws.addRow({ title: r.title, status: r.status, priority: r.priority, due_date: r.due_date, owner_name: r.owner_name || '', prospect_name: r.prospect_name || '' });
    ws.getRow(1).eachCell(c => c.style = headerStyle);
    ws.autoFilter = { from: 'A1', to: 'F' + (rows.length + 1) };
  } else if (reportType === 'audit') {
    const ws = wb.addWorksheet('Audit Log');
    ws.columns = [{ header: 'Waktu', key: 'timestamp', width: 22 }, { header: 'User', key: 'username', width: 20 }, { header: 'Aksi', key: 'action', width: 24 }, { header: 'Entitas', key: 'entity', width: 20 }, { header: 'Detail', key: 'detail', width: 60 }];
    const rows = DB.query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5000");
    for (const r of rows) ws.addRow({ timestamp: r.timestamp, username: r.username, action: r.action, entity: (r.entity || '') + (r.entity_id ? '#' + r.entity_id : ''), detail: r.detail || '' });
    ws.getRow(1).eachCell(c => c.style = headerStyle);
    ws.autoFilter = { from: 'A1', to: 'E' + (rows.length + 1) };
  } else {
    return { ok: false, error: 'Jenis laporan tidak dikenal.' };
  }

  const dir = opts.dir || path.join(os.homedir(), 'Documents');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fname = 'SalesDeskPro_' + reportType + '_' + month + '_' + Date.now() + '.xlsx';
  const fpath = path.join(dir, fname);
  await wb.xlsx.writeFile(fpath);
  audit('REPORT_EXPORT', 'report', 0, { type: reportType, file: fname }, user);
  return { ok: true, path: fpath };
}

function exportCsv(user, reportType) {
  if (reportType === 'prospects') {
    const rows = listProspects(user, {});
    const header = ['Nama', 'Perusahaan', 'Sumber', 'Tahapan', 'Estimasi Nilai', 'Pemilik', 'Dibuat'];
    const lines = [header.join(',')].concat(rows.map(r => [r.name, r.company || '', r.source || '', r.stage, r.estimated_value, r.owner_name || '', r.created_at].map(csvCell).join(',')));
    return { ok: true, data: lines.join('\n'), filename: 'SalesDeskPro_prospek_' + Date.now() + '.csv' };
  }
  return { ok: false, error: 'Tipe tidak didukung' };
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* ============================= IMPORT ============================= */

function importProspectsCsv(actor, text, mapping) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: 'File kosong atau hanya berisi header.' };
  const header = rows[0].map(h => String(h).trim().toLowerCase());
  const idx = {};
  for (const key of ['name', 'nama', 'company', 'perusahaan', 'source', 'sumber', 'value', 'estimasi', 'nilai', 'stage', 'tahapan', 'phone', 'telepon', 'notes', 'catatan']) {
    const i = header.indexOf(key);
    if (i >= 0) idx[key] = i;
  }
  if (idx.name === undefined) return { ok: false, error: 'Kolom nama/name tidak ditemukan di header CSV.' };
  let inserted = 0, skipped = 0, errors = [];
  DB.run('BEGIN TRANSACTION');
  try {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = String(r[idx.name] || '').trim();
      if (!name) { skipped++; continue; }
      const company = idx.company !== undefined ? String(r[idx.company] || '').trim() : '';
      const source = idx.source !== undefined ? String(r[idx.source] || '').trim() : 'Import';
      const value = idx.value !== undefined ? Number(String(r[idx.value] || '').replace(/[^\d.-]/g, '')) || 0 : 0;
      const stage = idx.stage !== undefined ? String(r[idx.stage] || '').trim() : 'Prospek';
      const dups = findDuplicates(name, company);
      DB.run("INSERT INTO prospects(name,company,source,estimated_value,stage,owner_id,team_id,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [name, company, source, Math.max(0, value), stage, actor.id, actor.team_id, '', NOW(), NOW()]);
      inserted++;
      if (dups.length) errors.push('Baris ' + (i + 1) + ': kemungkinan duplikat "' + name + '"');
    }
    DB.run('COMMIT');
  } catch (e) {
    DB.run('ROLLBACK');
    return { ok: false, error: 'Gagal import: ' + e.message };
  }
  audit('PROSPECT_IMPORT', 'prospect', 0, { inserted, skipped }, actor);
  return { ok: true, inserted, skipped, duplicates: errors.slice(0, 10) };
}

/* ============================= RECYCLE BIN ============================= */

function recycleBin() {
  const p = DB.query("SELECT 'prospect' AS type, id, name, deleted_at FROM prospects WHERE deleted_at IS NOT NULL AND deleted_at >= date('now','-30 day')");
  const d = DB.query("SELECT 'deal' AS type, id, name, deleted_at FROM deals WHERE deleted_at IS NOT NULL AND deleted_at >= date('now','-30 day')");
  const f = DB.query("SELECT 'followup' AS type, id, title AS name, deleted_at FROM followups WHERE deleted_at IS NOT NULL AND deleted_at >= date('now','-30 day')");
  const c = DB.query("SELECT 'contact' AS type, id, name, deleted_at FROM contacts WHERE deleted_at IS NOT NULL AND deleted_at >= date('now','-30 day')");
  return { items: p.concat(d, f, c).sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at))) };
}

function restoreItem(actor, type, id) {
  const table = { prospect: 'prospects', deal: 'deals', followup: 'followups', contact: 'contacts' }[type];
  if (!table) return { ok: false, error: 'Tipe tidak valid.' };
  DB.run("UPDATE " + table + " SET deleted_at=NULL, updated_at=? WHERE id=?", [NOW(), id]);
  audit('RECYCLE_RESTORE', type, id, {}, actor);
  return { ok: true };
}

function purgeItem(actor, type, id, reason) {
  if (!String(reason || '').trim()) return { ok: false, error: 'Alasan penghapusan permanen WAJIB diisi.' };
  const table = { prospect: 'prospects', deal: 'deals', followup: 'followups', contact: 'contacts' }[type];
  if (!table) return { ok: false, error: 'Tipe tidak valid.' };
  DB.run("DELETE FROM " + table + " WHERE id=?", [id]);
  audit('PERMANENT_DELETE', type, id, { reason }, actor);
  return { ok: true };
}

/* ============================= BACKUP ============================= */

function listBackups() {
  return DB.query("SELECT * FROM backups ORDER BY date DESC");
}

function doBackup(actor, targetDir, type) {
  const dir = targetDir || path.join(appDataDir(), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fname = 'SalesDeskPro_backup_' + new Date().toISOString().slice(0, 10) + '_' + Date.now() + '.bak';
  const fpath = path.join(dir, fname);
  try {
    const size = DB.backupTo(fpath, type || 'manual');
    DB.run("INSERT INTO backups(path,size,date,type,status) VALUES(?,?,?,?,?)", [fpath, size, NOW(), type || 'manual', 'success']);
    // Rolling 7 (PRD: 7 backup terakhir)
    const all = DB.query("SELECT id, path FROM backups WHERE type='auto' ORDER BY date DESC");
    for (const b of all.slice(7)) {
      try { if (fs.existsSync(b.path)) fs.unlinkSync(b.path); } catch (e) {}
      DB.run("DELETE FROM backups WHERE id=?", [b.id]);
    }
    audit('BACKUP', 'backup', 0, { path: fpath, type: type || 'manual' }, actor);
    return { ok: true, path: fpath, size };
  } catch (e) {
    DB.run("INSERT INTO backups(path,size,date,type,status) VALUES(?,0,?,?,?)", [fpath, NOW(), type || 'manual', 'failed']);
    return { ok: false, error: 'Backup gagal: ' + e.message };
  }
}

function doRestore(actor, filePath) {
  try {
    const meta = DB.restoreFrom(filePath);
    audit('RESTORE', 'backup', 0, { path: filePath, from: meta.date }, actor);
    return { ok: true, meta };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function appDataDir() {
  return process.env.APPDATA ? path.join(process.env.APPDATA, 'SalesDeskPro') : path.join(os.homedir(), '.salesdeskpro');
}

/* ============================= SETTINGS / DATA MASTER ============================= */

function getSettings() {
  const rows = DB.query("SELECT key,value FROM settings");
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function saveSettings(actor, data) {
  const old = getSettings();
  const allowed = ['company_name', 'currency', 'date_format', 'auto_lock_min', 'min_password_len', 'lockout_attempts', 'backup_hour', 'backup_enabled', 'theme', 'meeting_reminder_min', 'notification_enabled', 'license_holder'];
  for (const k of allowed) {
    if (data[k] !== undefined) DB.setSetting(k, data[k]);
  }
  if (old.min_password_len !== String(data.min_password_len) && data.min_password_len) audit('SECURITY_POLICY', 'settings', 0, { old: old.min_password_len, neu: data.min_password_len }, actor);
  return { ok: true };
}

function listProducts() { return DB.query("SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name"); }
function addProduct(actor, data) {
  if (!String(data.name || '').trim()) return { ok: false, error: 'Nama produk wajib.' };
  DB.run("INSERT INTO products(name,price,active,created_at) VALUES(?,?,?,?)", [String(data.name).trim(), Math.max(0, Number(data.price) || 0), data.active === false ? 0 : 1, NOW()]);
  audit('PRODUCT_CREATE', 'product', DB.lastId(), {}, actor);
  return { ok: true };
}
function updateProduct(actor, id, data) {
  DB.run("UPDATE products SET name=?, price=?, active=?, updated_at=? WHERE id=?", [String(data.name).trim(), Math.max(0, Number(data.price) || 0), data.active === false ? 0 : 1, NOW(), id]);
  return { ok: true };
}

function listSources() { return DB.query("SELECT * FROM sources ORDER BY name"); }
function addSource(actor, name) {
  if (!String(name || '').trim()) return { ok: false, error: 'Nama sumber wajib.' };
  DB.run("INSERT INTO sources(name,created_at) VALUES(?,?)", [String(name).trim(), NOW()]);
  return { ok: true };
}

function saveStages(actor, names) {
  if (!Array.isArray(names) || names.length < 2) return { ok: false, error: 'Minimal 2 tahapan.' };
  DB.run('BEGIN TRANSACTION');
  try {
    DB.run("DELETE FROM stages");
    names.forEach((n, i) => DB.run("INSERT INTO stages(name,position,created_at) VALUES(?,?,?)", [String(n).trim(), i, NOW()]));
    DB.run('COMMIT');
  } catch (e) { DB.run('ROLLBACK'); return { ok: false, error: e.message }; }
  audit('STAGES_UPDATE', 'stage', 0, { stages: names }, actor);
  return { ok: true };
}

function listTemplates() { return DB.query("SELECT * FROM followup_templates ORDER BY name"); }
function addTemplate(actor, data) {
  if (!String(data.name || '').trim() || !String(data.template || '').trim()) return { ok: false, error: 'Nama & isi template wajib.' };
  DB.run("INSERT INTO followup_templates(name,template,created_at) VALUES(?,?,?)", [String(data.name).trim(), String(data.template).trim(), NOW()]);
  return { ok: true };
}

/* ============================= AUDIT LIST ============================= */

function listAudit(actor, filters, limit) {
  filters = filters || {};
  let sql = "SELECT * FROM audit_logs WHERE 1=1";
  const params = [];
  if (filters.action) { sql += " AND action=?"; params.push(filters.action); }
  if (filters.search) { sql += " AND (username LIKE ? OR detail LIKE ?)"; params.push('%' + filters.search + '%', '%' + filters.search + '%'); }
  sql += " ORDER BY timestamp DESC LIMIT " + (limit || 500);
  return DB.query(sql, params);
}

function listAuditActions() {
  return DB.query("SELECT DISTINCT action FROM audit_logs ORDER BY action");
}

/* ============================= ADMIN DASHBOARD ============================= */

function adminOverview() {
  const q = (sql) => { try { return Number(DB.get(sql).v) || 0; } catch (e) { return 0; } };
  const users = DB.query("SELECT role, count(*) AS c FROM users WHERE deleted_at IS NULL GROUP BY role");
  const recent = DB.query("SELECT date, type, status FROM backups ORDER BY date DESC LIMIT 5");
  const dbInfo = DB.integrityCheck();
  return {
    users: DB.query("SELECT count(*) AS c FROM users WHERE deleted_at IS NULL")[0].c,
    active_users: DB.query("SELECT count(*) AS c FROM users WHERE deleted_at IS NULL AND status='Active'")[0].c,
    prospects: q("SELECT count(*) AS v FROM prospects WHERE deleted_at IS NULL"),
    deals_open: q("SELECT count(*) AS v FROM deals WHERE status='Open' AND deleted_at IS NULL"),
    deals_won: q("SELECT count(*) AS v FROM deals WHERE status='Won' AND deleted_at IS NULL"),
    revenue_month: q("SELECT COALESCE(SUM(value),0) AS v FROM deals WHERE status='Won' AND won_date LIKE '" + currentMonth() + "%' AND deleted_at IS NULL"),
    revenue_total: q("SELECT COALESCE(SUM(value),0) AS v FROM deals WHERE status='Won' AND deleted_at IS NULL"),
    commission_month: q("SELECT COALESCE(SUM(nominal),0) AS v FROM commissions WHERE status IN ('Confirmed','Overridden') AND strftime('%Y-%m',created_at)='" + currentMonth() + "'"),
    by_role: users,
    recent_backups: recent,
    db: dbInfo,
    last_backup: recent.length ? recent[0] : null,
    disk_free: (() => { try { return require('fs').statfsSync(appDataDir()); } catch (e) { return null; } })(),
    trend_prospects: monthlyPerformance({ role: 'Admin', id: 0 }).map(p => p.prospects),
    trend_revenue: monthlyPerformance({ role: 'Admin', id: 0 }).map(p => p.revenue)
  };
}

module.exports = {
  fmtRp, login, changePassword, sanitizeUser,
  listUsers, createUser, updateUser, resetPassword, listTeams, createTeam, updateTeam,
  listProspects, getProspect, createProspect, updateProspect, softDeleteProspect,
  listContacts, createContact, updateContact, deleteContact,
  getStages, listDeals, getDeal, createDeal, updateDeal, moveDeal, deleteDeal,
  activeSchemeSnapshot, calcCommission, listSchemes, createScheme, updateScheme,
  calculateCommissionForDeal, overrideCommission, runTrueUp, commissionForecast, listCommissions,
  addActivity, listActivities, recentActivities,
  refreshOverdue, listFollowups, createFollowup, completeFollowup, deleteFollowup,
  listMeetings, createMeeting, deleteMeeting,
  setTarget, achievementFor, scorecard, listTargets,
  dashboard, weeklyPerformance, monthlyPerformance,
  exportExcel, exportCsv, importProspectsCsv, csvCell,
  recycleBin, restoreItem, purgeItem,
  listBackups, doBackup, doRestore,
  getSettings, saveSettings, listProducts, addProduct, updateProduct,
  listSources, addSource, saveStages, listTemplates, addTemplate,
  listAudit, listAuditActions, adminOverview,
  audit, now: NOW, today: TODAY, currentMonth, daysUntil, appDataDir
};
