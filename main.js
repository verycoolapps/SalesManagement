/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * @product    SalesDesk Pro v1.0.0 — Main Process (Electron)
 * @author     HermesClaw / VeryCoolApps
 * @contact    WA: +62 815-1925-0845 | TG: https://t.me/VeryCoolApps
 * @license    PROPRIETARY — Unauthorized use strictly prohibited
 * =============================================================================
 * Proteksi: integrity self-check, machine-bound license, auto-lock,
 * scheduler notifikasi & backup, single instance.
 */
'use strict';
const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, powerMonitor, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const DB = require('./core/db');
const S = require('./core/services');
const L = require('./core/license');
const I = require('./core/integrity');
const C = require('./core/crypto');

const APP_NAME = 'SalesDesk Pro';
const APP_VERSION = '1.0.0';
const BRAND = 'VeryCoolApps (PT. Agra Karya Digital)';

let win = null;
let tray = null;
let currentUser = null;
let fingerprint = null;
let appState = { locked: false, tampered: false, licensed: false };
let notifCache = new Set();
let schedulerTimer = null;
let idleCheckTimer = null;
let lastBackupDay = '';

const singleLock = app.requestSingleInstanceLock();
if (!singleLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(bootstrap);
}

/* ============================= BOOT ============================= */

async function bootstrap() {
  app.setAppUserModelId('id.co.verycoolapps.salesdeskpro');

  // --- Integrity gate (anti-modifikasi) ---
  const coreCheck = I.verifyCore();
  const asarCheck = I.verifyAsar();
  if (coreCheck.tampered || (asarCheck.checked && !asarCheck.ok)) {
    appState.tampered = true;
  }

  // --- Data dir ---
  const dataDir = S.appDataDir();
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}

  fingerprint = L.getFingerprint();
  try {
    await DB.init(dataDir, fingerprint);
  } catch (e) {
    // database gagal dibuka — coba restore otomatis dari backup terakhir (SOP D)
    try {
      const baks = DB.listBackups().filter(b => b.status === 'success');
      if (baks.length) {
        const r = S.doRestore({ id: null, username: 'system' }, baks[0].path);
        if (!r.ok) throw new Error('restore failed');
      } else throw new Error('no backup');
    } catch (e2) {
      console.error('[BOOT] DB init failed', e);
    }
  }

  const lic = L.licenseStatus(DB, fingerprint);
  appState.licensed = lic.state === 'valid';

  createWindow();
  createTray();
  setupIpc();
  startSchedulers();
  setupIdleLock();
  setupAutoBackup();

  if (process.argv.includes('--smoke')) {
    setTimeout(() => {
      console.log('[SMOKE] Electron boot OK — window:', !!win, '| licensed:', appState.licensed, '| tampered:', appState.tampered, '| dataDir:', dataDir);
      appState.quitting = true;
      app.quit();
    }, 8000);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b1120',
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.png'),
    title: APP_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
      spellcheck: false,
      webSecurity: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    if (!appState.quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });
}

function createTray() {
  const icoPath = path.join(__dirname, '..', 'renderer', 'assets', 'tray.png');
  let img = null;
  try { img = nativeImage.createFromPath(icoPath); } catch (e) {}
  if (!img || img.isEmpty()) return;
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip(APP_NAME + ' — ' + BRAND);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Buka ' + APP_NAME, click: () => { if (win) { win.show(); win.focus(); } } },
    { label: 'Kunci Aplikasi', click: () => { if (win) win.webContents.send('ui:lock'); } },
    { type: 'separator' },
    { label: 'Keluar', click: () => { appState.quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { if (win) { win.show(); win.focus(); } });
}

/* ============================= IPC ============================= */

const SVC_WHITELIST = {
  dashboard: 'dashboard', login: 'login', changePassword: 'changePassword',
  listUsers: 'listUsers', createUser: 'createUser', updateUser: 'updateUser', resetPassword: 'resetPassword',
  listTeams: 'listTeams', createTeam: 'createTeam', updateTeam: 'updateTeam',
  listProspects: 'listProspects', getProspect: 'getProspect', createProspect: 'createProspect', updateProspect: 'updateProspect', softDeleteProspect: 'softDeleteProspect',
  listContacts: 'listContacts', createContact: 'createContact', updateContact: 'updateContact', deleteContact: 'deleteContact',
  getStages: 'getStages', listDeals: 'listDeals', getDeal: 'getDeal', createDeal: 'createDeal', updateDeal: 'updateDeal', moveDeal: 'moveDeal', deleteDeal: 'deleteDeal',
  listSchemes: 'listSchemes', createScheme: 'createScheme', updateScheme: 'updateScheme',
  overrideCommission: 'overrideCommission', runTrueUp: 'runTrueUp', commissionForecast: 'commissionForecast', listCommissions: 'listCommissions',
  addActivity: 'addActivity', listActivities: 'listActivities', recentActivities: 'recentActivities',
  refreshOverdue: 'refreshOverdue', listFollowups: 'listFollowups', createFollowup: 'createFollowup', completeFollowup: 'completeFollowup', deleteFollowup: 'deleteFollowup',
  listMeetings: 'listMeetings', createMeeting: 'createMeeting', deleteMeeting: 'deleteMeeting',
  setTarget: 'setTarget', scorecard: 'scorecard', listTargets: 'listTargets',
  weeklyPerformance: 'weeklyPerformance', monthlyPerformance: 'monthlyPerformance',
  exportExcel: 'exportExcel', exportCsv: 'exportCsv', importProspectsCsv: 'importProspectsCsv',
  recycleBin: 'recycleBin', restoreItem: 'restoreItem', purgeItem: 'purgeItem',
  listBackups: 'listBackups', doBackup: 'doBackup', doRestore: 'doRestore',
  getSettings: 'getSettings', saveSettings: 'saveSettings',
  listProducts: 'listProducts', addProduct: 'addProduct', updateProduct: 'updateProduct',
  listSources: 'listSources', addSource: 'addSource', saveStages: 'saveStages',
  listTemplates: 'listTemplates', addTemplate: 'addTemplate',
  listAudit: 'listAudit', listAuditActions: 'listAuditActions', adminOverview: 'adminOverview',
  activeSchemeSnapshot: 'activeSchemeSnapshot'
};

function setupIpc() {
  ipcMain.handle('app:boot', () => {
    return {
      app: APP_NAME, version: APP_VERSION, brand: BRAND,
      tampered: appState.tampered,
      licensed: appState.licensed,
      fingerprint: fingerprint,
      fingerprintLabel: L.fingerprintLabel(fingerprint),
      dataDir: S.appDataDir()
    };
  });

  ipcMain.handle('auth:login', (e, username, password) => {
    const r = S.login(username, password);
    if (r.ok) {
      currentUser = r.user;
      appState.locked = false;
    }
    return r;
  });

  ipcMain.handle('auth:logout', () => { currentUser = null; appState.locked = false; return { ok: true }; });
  ipcMain.handle('auth:lock', () => { appState.locked = true; DB.flush(); return { ok: true }; });
  ipcMain.handle('auth:unlock', (e, password) => {
    if (!currentUser) return { ok: false, error: 'Sesi tidak ada.' };
    const u = DB.get('SELECT * FROM users WHERE id=?', [currentUser.id]);
    if (u && C.verifyPassword(password, u.password_hash)) {
      appState.locked = false;
      return { ok: true };
    }
    return { ok: false, error: 'Password salah.' };
  });

  ipcMain.handle('license:activate', (e, key) => {
    const r = L.activate(DB, fingerprint, key);
    if (r.ok) appState.licensed = true;
    return r;
  });

  ipcMain.handle('license:status', () => L.licenseStatus(DB, fingerprint));

  ipcMain.handle('svc:call', async (e, fn, args) => {
    if (!SVC_WHITELIST[fn]) return { ok: false, error: 'Akses ditolak: ' + fn };
    if (!currentUser && fn !== 'login') return { ok: false, error: 'Belum login.' };
    if (appState.locked) return { ok: false, error: 'Aplikasi terkunci.' };
    try {
      const fnImpl = S[SVC_WHITELIST[fn]];
      const result = await fnImpl.apply(S, [currentUser].concat(args || []));
      DB.saveDebounced();
      return { ok: true, data: result };
    } catch (err) {
      console.error('[SVC]', fn, err);
      return { ok: false, error: String(err && err.message || err) };
    }
  });

  ipcMain.handle('app:flush', () => { DB.flush(); return { ok: true }; });
  ipcMain.handle('app:quit', () => { appState.quitting = true; DB.flush(); app.quit(); return { ok: true }; });
  ipcMain.handle('app:openPath', (e, p) => { try { require('electron').shell.openPath(p); } catch (e2) {} return { ok: true }; });
}

/* ============================= SCHEDULER & NOTIFICATIONS ============================= */

function notify(title, body, tag) {
  if (appState.locked) return;
  if (DB.getSetting('notification_enabled', '1') !== '1') return;
  if (notifCache.has(tag)) return;
  notifCache.add(tag);
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: false });
    n.show();
  }
}

function startSchedulers() {
  schedulerTimer = setInterval(() => {
    try {
      S.refreshOverdue();
      // Pengingat meeting (F-26): X menit sebelum
      const remMin = Number(DB.getSetting('meeting_reminder_min', '15'));
      const nowTs = Date.now();
      const meetings = DB.query("SELECT * FROM meetings WHERE deleted_at IS NULL AND start_time >= datetime('now','localtime')");
      for (const m of meetings) {
        const mts = new Date(String(m.start_time).replace(' ', 'T')).getTime();
        const diffMin = Math.round((mts - nowTs) / 60000);
        if (diffMin > 0 && diffMin <= remMin) {
          notify('Meeting sebentar lagi', m.title + ' dalam ' + diffMin + ' menit', 'meet-' + m.id + '-' + diffMin);
        }
      }
      // Follow-up overdue (notifikasi harian)
      const overdueCount = DB.query("SELECT count(*) AS c FROM followups WHERE status='Overdue' AND deleted_at IS NULL")[0].c;
      const hour = new Date().getHours();
      if (overdueCount > 0 && hour === 8) {
        notify('Follow-up terlambat', 'Ada ' + overdueCount + ' follow-up yang terlambat. Periksa dashboard.', 'overdue-daily');
      }
      // Notifikasi pencapaian target ≤80% di akhir bulan (TG-006)
      const d = new Date();
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if (d.getDate() === lastDay && hour === 17 && currentUser) {
        const a = S.achievementFor(currentUser.id, S.currentMonth());
        if (a.target > 0 && a.percent < 80) {
          notify('Target belum tercapai', 'Pencapaian target bulan ini: ' + a.percent + '%.', 'target-eom');
        }
      }
    } catch (e) { console.error('[SCHED]', e); }
  }, 60000);
}

function setupIdleLock() {
  idleCheckTimer = setInterval(() => {
    try {
      if (!currentUser || appState.locked) return;
      const min = Number(DB.getSetting('auto_lock_min', '10'));
      if (min <= 0) return;
      const idle = powerMonitor.getSystemIdleTime();
      if (idle >= min * 60) {
        appState.locked = true;
        DB.flush();
        if (win) win.webContents.send('ui:lock');
      }
    } catch (e) {}
  }, 30000);
}

function setupAutoBackup() {
  backupTimer = setInterval(() => {
    try {
      if (DB.getSetting('backup_enabled', '1') !== '1') return;
      const hour = String(DB.getSetting('backup_hour', '22'));
      const d = new Date();
      const today = d.toISOString().slice(0, 10);
      if (String(d.getHours()).padStart(2, '0') === hour && lastBackupDay !== today) {
        lastBackupDay = today;
        const r = S.doBackup({ id: null, username: 'system' }, null, 'auto');
        if (!r.ok) notify('Backup gagal', r.error, 'backup-fail');
      }
    } catch (e) {}
  }, 60000);
}

app.on('before-quit', () => { appState.quitting = true; DB.flush(); });
app.on('window-all-closed', () => { /* tetap di tray */ });
app.on('activate', () => { if (win) win.show(); });
