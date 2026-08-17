/**
 * © 2026 VeryCoolApps — PT. Agra Karya Digital — PROPRIETARY
 * Smoke test core SalesDesk Pro (berjalan tanpa Electron — validasi bisnis logic).
 */
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');
const DB = require('../core/db');
const S = require('../core/services');
const C = require('../core/crypto');
const L = require('../core/license');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdp-test-'));
  const fp = L.getFingerprint();
  console.log('== FINGERPRINT ==', fp.slice(0, 16) + '…');
  await DB.init(tmp, fp);

  // 1. Login admin
  let r = S.login('admin', 'admin123');
  if (!r.ok) throw new Error('Login admin gagal: ' + r.error);
  const admin = r.user;
  console.log('1. Login admin OK, mustChange=', r.mustChangePassword);

  // 2. Login salah 5x → lockout
  for (let i = 0; i < 5; i++) S.login('admin', 'salah');
  const locked = S.login('admin', 'admin123');
  if (locked.ok) throw new Error('Lockout tidak bekerja!');
  console.log('2. Lockout 30dtk OK:', locked.error);

  // 3. Buat user sales
  r = S.createUser(admin, { username: 'andi', name: 'Andi Sales', role: 'Sales', password: 'password123', must_change: false });
  if (!r.ok) throw new Error('createUser gagal: ' + r.error);
  const andi = S.login('andi', 'password123').user;
  console.log('3. User sales dibuat & login OK');

  // 4. Prospek + deteksi duplikat
  r = S.createProspect(andi, { name: 'PT Maju Jaya', company: 'Maju Group', estimated_value: 100000000 });
  if (!r.ok) throw new Error('prospek gagal');
  r = S.createProspect(andi, { name: 'PT Maju Jaya', company: 'Maju Group', estimated_value: 50000000 });
  if (r.ok && !r.duplicates.length) throw new Error('Duplikat tidak terdeteksi!');
  console.log('4. Prospek + deteksi duplikat OK (dup:', r.duplicates.length, ')');

  // 5. Deal Won + komisi tier (UAT-006: 60jt → 3,2jt)
  S.createScheme(admin, { name: 'Tier Test', type: 'tier', params: JSON.stringify({ tiers: [[0, 50000000, 5], [50000000, null, 7]] }), active: true, effective_date: S.today() });
  r = S.createDeal(andi, { name: 'Deal 60jt', value: 60000000, stage: 'Penawaran', estimated_close: S.today() });
  const dealId = r.id;
  r = S.moveDeal(admin, dealId, 'Won', {});
  if (!r.ok) throw new Error('moveDeal Won gagal: ' + r.error);
  const nominal = r.result.nominal;
  if (nominal !== 3200000) throw new Error('Komisi tier salah! Harus 3.200.000, dapat ' + nominal);
  console.log('5. Komisi tier 60jt =', nominal, 'OK (UAT-006)');

  // 6. Skema percent 5%
  S.createScheme(admin, { name: 'Percent 5', type: 'percent', params: '{"percent":5}', active: true, effective_date: S.today() });
  r = S.createDeal(andi, { name: 'Deal 10jt', value: 10000000, stage: 'Penawaran' });
  r = S.moveDeal(admin, r.id, 'Won', {});
  if (r.result.nominal !== 500000) throw new Error('Komisi percent salah: ' + r.result.nominal);
  console.log('6. Komisi percent 5% dari 10jt =', r.result.nominal, 'OK');

  // 7. Target & achievement & scorecard
  S.setTarget(admin, andi.id, S.currentMonth(), { target_revenue: 100000000, activity_target: 20, followup_target: 10, deal_target: 4 });
  const ach = S.achievementFor(andi.id, S.currentMonth());
  if (ach.percent !== 70) throw new Error('Achievement salah: ' + ach.percent);
  const sc = S.scorecard(andi, S.currentMonth());
  console.log('7. Target 100jt, revenue 70jt →', ach.percent + '% · Scorecard', sc.score, sc.label, 'OK');

  // 8. Dashboard 19 widget
  const db = S.dashboard(andi, 'day');
  const count = Object.keys(db).length;
  console.log('8. Dashboard OK —', count, 'field, prioritas:', db.priorities.length, ', komisi:', db.commission_earned);

  // 9. Export Excel
  r = await S.exportExcel(admin, 'commissions', { month: S.currentMonth(), dir: tmp });
  if (!r.ok) throw new Error('export gagal: ' + r.error);
  console.log('9. Export Excel OK:', r.path, '(' + fs.statSync(r.path).size + ' B)');

  // 10. Backup & restore
  r = S.doBackup(admin, tmp + '/backups', 'manual');
  if (!r.ok) throw new Error('backup gagal: ' + r.error);
  const bakPath = r.path;
  S.createProspect(andi, { name: 'Prospek Setelah Backup', estimated_value: 1 });
  const before = DB.query('SELECT count(*) c FROM prospects')[0].c;
  r = S.doRestore(admin, bakPath);
  if (!r.ok) throw new Error('restore gagal: ' + r.error);
  const after = DB.query('SELECT count(*) c FROM prospects')[0].c;
  if (after >= before) throw new Error('Restore tidak mengembalikan data! before=' + before + ' after=' + after);
  console.log('10. Backup & restore OK (prospek sebelum:', before, '→ sesudah:', after + ')');

  // 11. Audit log
  const audit = S.listAudit(admin, {}, 100);
  const overrides = audit.filter(a => a.action === 'COMMISSION_OVERRIDE');
  console.log('11. Audit log OK —', audit.length, 'entri');

  // 12. Override komisi wajib alasan
  const comms = S.listCommissions(admin, {});
  r = S.overrideCommission(admin, comms[0].id, 1000000, '');
  if (r.ok) throw new Error('Override tanpa alasan harus ditolak!');
  r = S.overrideCommission(admin, comms[0].id, 1000000, 'Koreksi manual');
  if (!r.ok) throw new Error('Override gagal: ' + r.error);
  console.log('12. Override komisi: tanpa alasan ditolak, dengan alasan OK');

  // 13. Recycle bin & purge
  r = S.softDeleteProspect(andi, S.listProspects(andi, {})[0].id, 'test');
  const bin = S.recycleBin();
  if (!bin.items.length) throw new Error('Recycle bin kosong!');
  r = S.purgeItem(admin, 'prospect', bin.items[0].id, 'test permanent');
  if (!r.ok) throw new Error('purge gagal');
  console.log('13. Recycle bin & purge OK');

  // 14. Lisensi
  const key = C.generateLicense(fp);
  const ok = C.verifyLicense(fp, key);
  const bad = C.verifyLicense('00000000000000000000000000000000', key);
  if (!ok || bad) throw new Error('Lisensi tidak bekerja!');
  console.log('14. Lisensi OK — key:', key.slice(0, 20) + '…, valid:', ok, ', salah-mesin:', bad);

  // 15. Enkripsi DB (file tidak terbaca plaintext)
  const dbFile = path.join(tmp, 'salesdesk.data');
  const buf = fs.readFileSync(dbFile);
  const asText = buf.toString('utf8');
  const leak = asText.includes('PT Maju Jaya') || asText.includes('password123');
  if (leak) throw new Error('Database tidak terenkripsi!');
  console.log('15. Enkripsi DB OK (tidak ada plaintext data)');

  // 16. Integrity check
  const ic = DB.integrityCheck();
  if (ic.status !== 'ok') throw new Error('Integrity check gagal: ' + ic.status);
  console.log('16. Integrity check OK:', ic.status);

  // 17. Admin overview
  const ov = S.adminOverview();
  console.log('17. Admin overview OK — users:', ov.users, ', revenue:', ov.revenue_month);

  DB.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n✅ SEMUA SMOKE TEST LULUS');
})().catch(e => { console.error('\n❌ SMOKE TEST GAGAL:', e.message); process.exit(1); });
