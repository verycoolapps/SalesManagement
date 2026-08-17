/* =============================================================================
   © 2026 VeryCoolApps — PT. Agra Karya Digital
   ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
   SalesDesk Pro v1.0.0 — App bootstrap, auth flow, router, shortcuts
   ============================================================================= */
'use strict';

const AppState = {
  user: null,
  boot: null,
  currentPage: 'dashboard',
  dashboardPeriod: 'day',
  navigate: null
};

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------------- Boot ---------------- */

async function boot() {
  const boot = await window.sdp.boot();
  AppState.boot = boot;

  $('#tamper-quit').onclick = () => window.sdp.quit();

  if (boot.tampered) {
    showScreen('screen-tamper');
    return;
  }
  if (!boot.licensed) {
    showScreen('screen-activate');
    $('#act-fingerprint').textContent = 'Fingerprint mesin: ' + boot.fingerprintLabel + '\n' + boot.fingerprint;
    $('#act-btn').onclick = doActivate;
    $('#act-key').addEventListener('keydown', (e) => { if (e.key === 'Enter') doActivate(); });
    return;
  }

  showScreen('screen-login');
  setupLogin();
}

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
}

async function doActivate() {
  const key = $('#act-key').value.trim();
  if (!key) { $('#act-error').textContent = 'Masukkan License Key.'; return; }
  const r = await window.sdp.activate(key);
  if (!r.ok) { $('#act-error').textContent = r.error; return; }
  $('#act-error').textContent = '';
  toast('Aktivasi berhasil 🎉', 'Selamat datang di SalesDesk Pro!', 'success');
  showScreen('screen-login');
  setupLogin();
}

function setupLogin() {
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const r = await window.sdp.login($('#login-user').value, $('#login-pass').value);
    if (!r.ok) {
      $('#login-error').textContent = r.error;
      return;
    }
    $('#login-error').textContent = '';
    AppState.user = r.user;
    if (r.mustChangePassword) {
      await mustChangePw();
      return;
    }
    enterApp();
  };
}

async function mustChangePw() {
  const m = openModal(`
    <h3>🔑 Ganti Password Wajib</h3>
    <p class="muted small mb">Ini login pertama / password di-reset Admin. Anda wajib mengganti password.</p>
    <label class="field">Password Lama<input class="input" id="mp-old" type="password"></label>
    <label class="field">Password Baru<input class="input" id="mp-new" type="password" placeholder="Min 8 karakter"></label>
    <label class="field">Ulangi Password Baru<input class="input" id="mp-new2" type="password"></label>
    <div class="m-foot"><button class="btn btn-ghost" onclick="window.sdp.logout()">Keluar</button><button class="btn btn-primary" id="mp-save">Ganti Password</button></div>`);
  m.$('#mp-save').onclick = async () => {
    if (m.$('#mp-new').value !== m.$('#mp-new2').value) { toast('Password tidak sama', '', 'error'); return; }
    const r = await tryCatch(() => svc('changePassword', AppState.user.id, m.$('#mp-old').value, m.$('#mp-new').value));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close();
    toast('Password berhasil diganti', '', 'success');
    enterApp();
  };
}

/* ---------------- App shell ---------------- */

function enterApp() {
  showScreen('screen-app');
  setupShell();
}

function setupShell() {
  const user = AppState.user;
  const isAdmin = user.role === 'Admin';
  const isManager = ['Admin', 'Manager'].includes(user.role);
  const isTeam = ['Admin', 'Manager', 'TeamLeader'].includes(user.role);

  $('#user-name').textContent = user.name;
  $('#user-role').textContent = roleLabel(user.role);
  $('#user-avatar').textContent = user.name.trim().charAt(0).toUpperCase();

  const menus = [
    { id: 'dashboard', label: 'Dashboard', ic: '🏠' },
    { id: 'prospects', label: 'Prospek', ic: '👥' },
    { id: 'contacts', label: 'Kontak', ic: '📇' },
    { id: 'pipeline', label: 'Pipeline', ic: '📊' },
    { id: 'followups', label: 'Follow-up', ic: '📅' },
    { id: 'meetings', label: 'Meeting', ic: '🗓️' },
    { id: 'targets', label: 'Target & KPI', ic: '🎯' },
    { id: 'commissions', label: 'Komisi', ic: '💰' },
    { id: 'reports', label: 'Laporan', ic: '📈' }
  ];
  if (isTeam) menus.push({ id: 'teams', label: 'Tim', ic: '👥' });
  if (isAdmin) menus.push({ id: 'admin', label: 'Admin Center', ic: '🛡️' });
  if (isAdmin) menus.push({ id: 'recycle', label: 'Recycle Bin', ic: '🗑️' });
  if (isManager) menus.push({ id: 'audit', label: 'Audit Log', ic: '🔐' });
  if (isAdmin) menus.push({ id: 'settings', label: 'Pengaturan', ic: '⚙️' });
  menus.push({ id: 'about', label: 'Tentang & Lisensi', ic: 'ℹ️' });

  const nav = $('#nav');
  nav.innerHTML = menus.map(m =>
    `<div class="nav-item" data-page="${m.id}" onclick="AppState.navigate('${m.id}')"><span class="ic">${m.ic}</span>${m.label}</div>`
  ).join('');

  AppState.navigate = (page) => {
    if (!Pages[page]) return;
    AppState.currentPage = page;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    const def = Pages[page];
    $('#page-title').textContent = def.title;
    $('#page-sub').textContent = roleLabel(user.role) + ' · ' + user.name;
    const box = $('#content');
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat…</p></div>';
    def.render(box, { user, boot: AppState.boot }).catch((e) => {
      box.innerHTML = `<div class="empty"><div class="ic">⚠️</div><p>Gagal memuat halaman: ${esc(e.message || e)}</p></div>`;
    });
  };

  // event wiring
  $('#btn-theme').onclick = toggleTheme;
  $('#btn-lock').onclick = () => lockApp();
  $('#btn-quick-prospect').onclick = () => Pages.quickProspect();
  $('#btn-quick-followup').onclick = () => Pages.quickFollowup();
  $('#btn-quick-meeting').onclick = () => Pages.quickMeeting();
  $('#user-chip').onclick = (e) => toggleUserMenu(e);
  $('#global-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') globalSearch($('#global-search').value);
  });
  window.sdp.onLock(() => lockApp());

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (typing) return;
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); Pages.quickProspect(); }
    else if (e.ctrlKey && e.key === 'f') { e.preventDefault(); Pages.quickFollowup(); }
    else if (e.ctrlKey && e.key === 'm') { e.preventDefault(); Pages.quickMeeting(); }
    else if (e.ctrlKey && e.key === 'l') { e.preventDefault(); lockApp(); }
  });

  AppState.navigate('dashboard');
}

function roleLabel(role) {
  return { Sales: 'Sales', TeamLeader: 'Team Leader', Manager: 'Manager', Admin: 'Administrator' }[role] || role;
}

function toggleUserMenu(e) {
  e.stopPropagation();
  const menu = $('#user-menu');
  const chip = $('#user-chip');
  const rect = chip.getBoundingClientRect();
  menu.classList.remove('hidden');
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.right = '18px';
  menu.innerHTML = `
    <div class="dd-item" onclick="closeUserMenu(); AppState.navigate('about')">ℹ️ Tentang & Lisensi</div>
    <div class="dd-item" onclick="closeUserMenu(); lockApp()">🔒 Kunci Aplikasi</div>
    <div class="dd-item danger" onclick="closeUserMenu(); logoutApp()">🚪 Keluar (Logout)</div>`;
}
function closeUserMenu() { $('#user-menu').classList.add('hidden'); }
document.addEventListener('click', () => closeUserMenu());

function lockApp() {
  window.sdp.lock().then(() => {
    showScreen('screen-lock');
    $('#lock-user').textContent = 'Terkunci — ' + AppState.user.name;
    $('#lock-error').textContent = '';
    $('#lock-pass').value = '';
    $('#lock-btn').onclick = doUnlock;
    $('#lock-pass').onkeydown = (e) => { if (e.key === 'Enter') doUnlock(); };
    setTimeout(() => $('#lock-pass').focus(), 100);
  });
}

async function doUnlock() {
  const r = await window.sdp.unlock($('#lock-pass').value);
  if (!r.ok) { $('#lock-error').textContent = r.error; return; }
  showScreen('screen-app');
}

async function logoutApp() {
  const ok = await confirmDialog('Keluar', 'Anda yakin ingin logout? Data aman tersimpan lokal.', { yes: 'Logout' });
  if (!ok) return;
  await window.sdp.logout();
  AppState.user = null;
  $('#login-pass').value = '';
  showScreen('screen-login');
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  svc('saveSettings', { theme: next }).catch(() => {});
}

async function globalSearch(q) {
  if (!q.trim()) return;
  const results = [];
  const pros = await svc('listProspects', { search: q });
  const cons = await svc('listContacts', { search: q });
  const deals = await svc('listDeals', { search: q });
  results.push(...pros.slice(0, 4).map(p => ({ kind: 'prospect', id: p.id, label: '👥 ' + p.name + (p.company ? ' · ' + p.company : '') })));
  results.push(...cons.slice(0, 4).map(c => ({ kind: 'contact', id: c.id, label: '📇 ' + c.name + (c.company ? ' · ' + c.company : '') })));
  results.push(...deals.slice(0, 4).map(d => ({ kind: 'deal', id: d.id, label: '💼 ' + d.name + ' · ' + fmtRp(d.value) })));
  if (!results.length) { toast('Tidak ditemukan', 'Tidak ada hasil untuk "' + q + '"', 'warn'); return; }
  const m = openModal(`
    <h3>🔎 Hasil pencarian "${esc(q)}"</h3>
    <div class="widget-list">${results.map(r => `<div class="w-item" data-k="${r.kind}" data-id="${r.id}"><div class="grow"><div class="t1">${r.label}</div></div></div>`).join('')}</div>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Tutup</button></div>`);
  m.$('[data-close]').onclick = m.close;
  $$('.w-item', m.el).forEach(item => item.onclick = () => {
    const kind = item.dataset.k, id = item.dataset.id;
    m.close();
    if (kind === 'prospect') { AppState.navigate('prospects'); Pages.prospectDetail(id); }
    else if (kind === 'contact') { AppState.navigate('contacts'); }
    else { AppState.navigate('pipeline'); Pages.dealDetail(id); }
  });
}

// boot
boot();
