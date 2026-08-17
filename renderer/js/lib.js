/* =============================================================================
   © 2026 VeryCoolApps — PT. Agra Karya Digital
   ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
   SalesDesk Pro v1.0.0 — Lib (helpers, API, charts, UI components)
   ============================================================================= */
'use strict';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const fmtRp = (v) => {
  const n = Math.round(Number(v) || 0);
  return 'Rp ' + n.toLocaleString('id-ID');
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const currentMonth = () => todayISO().slice(0, 7);

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (s) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T')).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' menit lalu';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' jam lalu';
  const days = Math.floor(h / 24);
  if (days < 30) return days + ' hari lalu';
  return fmtDate(s);
};

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* ---------------- API ---------------- */

async function svc(fn, ...args) {
  const r = await window.sdp.call(fn, ...args);
  if (!r.ok) throw new Error(r.error || 'Terjadi kesalahan.');
  return r.data;
}

async function tryCatch(fn, label) {
  try { return { ok: true, data: await fn() }; }
  catch (e) { return { ok: false, error: e.message || (label || 'Gagal') }; }
}

/* ---------------- Toast ---------------- */

function toast(title, body, kind) {
  const host = $('#toast-host');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'info');
  el.innerHTML = '<div class="t-title">' + esc(title) + '</div>' + (body ? '<div class="t-body">' + esc(body) + '</div>' : '');
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 4200);
}

/* ---------------- Modal ---------------- */

function openModal(html, opts) {
  opts = opts || {};
  const host = $('#modal-host');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = '<div class="modal glass ' + (opts.wide ? 'wide' : '') + '">' +
    '<button class="m-x" title="Tutup (Esc)">✕</button>' + html + '</div>';
  const modal = $('.modal', backdrop);
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  $('.m-x', backdrop).addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  host.appendChild(backdrop);
  // autofocus pertama
  const first = $('input, select, textarea', modal);
  if (first) setTimeout(() => first.focus(), 60);
  return { el: modal, close, $: (sel) => $(sel, modal), $$: (sel) => $$(sel, modal) };
}

function confirmDialog(title, body, opts) {
  return new Promise((resolve) => {
    const m = openModal(
      '<h3>' + esc(title) + '</h3>' +
      '<p style="color:var(--text-dim);font-size:13px">' + body + '</p>' +
      '<div class="m-foot">' +
      '<button class="btn btn-ghost" data-act="no">Batal</button>' +
      '<button class="btn ' + (opts && opts.danger ? 'btn-danger' : 'btn-primary') + '" data-act="yes">' + esc((opts && opts.yes) || 'Ya, Lanjutkan') + '</button>' +
      '</div>'
    );
    m.$('[data-act="yes"]').onclick = () => { m.close(); resolve(true); };
    m.$('[data-act="no"]').onclick = () => { m.close(); resolve(false); };
  });
}

/** Dialog dengan alasan wajib (aksi kritis per PRD Bab 6.3). */
function reasonDialog(title, body, opts) {
  return new Promise((resolve) => {
    const m = openModal(
      '<h3>' + esc(title) + '</h3>' +
      (body ? '<p style="color:var(--text-dim);font-size:13px">' + body + '</p>' : '') +
      '<label class="field">Alasan (wajib)<textarea class="input" id="rd-reason" placeholder="Tuliskan alasan…"></textarea></label>' +
      '<div class="m-foot">' +
      '<button class="btn btn-ghost" data-act="no">Batal</button>' +
      '<button class="btn ' + (opts && opts.danger ? 'btn-danger' : 'btn-primary') + '" data-act="yes">' + esc((opts && opts.yes) || 'Konfirmasi') + '</button>' +
      '</div>'
    );
    const doYes = () => {
      const reason = m.$('#rd-reason').value.trim();
      if (!reason) { toast('Alasan wajib diisi', 'Aksi kritis harus disertai alasan (tercatat di audit log).', 'warn'); return; }
      m.close(); resolve(reason);
    };
    m.$('[data-act="yes"]').onclick = doYes;
    m.$('[data-act="no"]').onclick = () => { m.close(); resolve(null); };
    m.$('#rd-reason').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doYes(); });
  });
}

function formValue(obj, key) {
  const el = obj.$('#' + key);
  if (!el) return undefined;
  if (el.type === 'checkbox') return el.checked;
  return el.value;
}

/* ---------------- SVG Charts ---------------- */

function sparkline(values, w, h, color) {
  w = w || 120; h = h || 34; color = color || '#0E76D6';
  if (!values || !values.length) return '<svg width="' + w + '" height="' + h + '"></svg>';
  const max = Math.max.apply(null, values.concat([1]));
  const min = Math.min.apply(null, values.concat([0]));
  const range = (max - min) || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 6) + 3;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return [x, y];
  });
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ' L' + (w - 3) + ' ' + (h - 2) + ' L3 ' + (h - 2) + ' Z';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<defs><linearGradient id="sg' + color.replace('#', '') + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.35"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#sg' + color.replace('#', '') + ')"/>' +
    '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="' + pts[pts.length - 1][0] + '" cy="' + pts[pts.length - 1][1] + '" r="3" fill="' + color + '"/></svg>';
}

function barChart(data, opts) {
  opts = opts || {};
  const w = opts.width || 420, h = opts.height || 160;
  const labels = data.map(d => d.label || '');
  const values = data.map(d => Number(d.value) || 0);
  const max = Math.max.apply(null, values.concat([1]));
  const bw = (w - 40) / data.length;
  let bars = '';
  values.forEach((v, i) => {
    const bh = Math.max(2, (v / max) * (h - 34));
    const x = 24 + i * bw + bw * 0.18;
    const y = h - 26 - bh;
    const color = opts.colors ? opts.colors[i] : (opts.color || '#0E76D6');
    bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="5" fill="' + color + '">' +
      '<title>' + (labels[i] || '') + ': ' + opts.fmt ? (opts.fmt(v)) : v + '</title></rect>';
    if (opts.showValues) bars += '<text x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" font-size="9" fill="var(--text-dim)">' + (opts.fmt ? opts.fmt(v) : v) + '</text>';
    bars += '<text x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (h - 10) + '" text-anchor="middle" font-size="9" fill="var(--text-faint)">' + esc(labels[i]) + '</text>';
  });
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + bars + '</svg>';
}

function lineChart(data, opts) {
  opts = opts || {};
  const w = opts.width || 440, h = opts.height || 180;
  const series = data.map(d => Number(d.value) || 0);
  const max = Math.max.apply(null, series.concat([1]));
  const pts = series.map((v, i) => {
    const x = 24 + (i / Math.max(series.length - 1, 1)) * (w - 44);
    const y = h - 26 - (v / max) * (h - 44);
    return [x, y];
  });
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ' L' + (w - 20) + ' ' + (h - 26) + ' L24 ' + (h - 26) + ' Z';
  let dots = '';
  pts.forEach((p, i) => { dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="' + (opts.color || '#0E76D6') + '"><title>' + esc(data[i].label || '') + ': ' + (opts.fmt ? opts.fmt(data[i].value) : data[i].value) + '</title></circle>'; });
  let labels = '';
  const step = Math.max(1, Math.ceil(data.length / 6));
  data.forEach((d, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;
    labels += '<text x="' + pts[i][0].toFixed(1) + '" y="' + (h - 10) + '" text-anchor="middle" font-size="9" fill="var(--text-faint)">' + esc(d.label) + '</text>';
  });
  const gid = 'lg' + Math.random().toString(36).slice(2, 7);
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + (opts.color || '#0E76D6') + '" stop-opacity="0.3"/><stop offset="100%" stop-color="' + (opts.color || '#0E76D6') + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
    '<path d="' + path + '" fill="none" stroke="' + (opts.color || '#0E76D6') + '" stroke-width="2.5" stroke-linecap="round"/>' + dots + labels + '</svg>';
}

function gauge(percent, size, label) {
  size = size || 120;
  const r = (size / 2) - 10;
  const cx = size / 2, cy = size / 2;
  const pct = Math.max(0, Math.min(100, percent || 0));
  const circ = 2 * Math.PI * r;
  const dash = circ * pct / 100;
  const color = pct >= 85 ? '#059669' : pct >= 70 ? '#0E76D6' : pct >= 50 ? '#D97706' : '#DC2626';
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--bg2)" stroke-width="11"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
    '<text x="' + cx + '" y="' + (cy + 1) + '" text-anchor="middle" font-size="' + (size * 0.17) + '" font-weight="800" fill="var(--text)">' + Math.round(pct) + '%</text>' +
    (label ? '<text x="' + cx + '" y="' + (cy + size * 0.16) + '" text-anchor="middle" font-size="9" fill="var(--text-faint)">' + esc(label) + '</text>' : '') +
    '</svg>';
}

/* ---------------- Anti copy-paste (HermesClaw Shield) ---------------- */

(function () {
  const BRAND = '© 2026 VeryCoolApps (PT. Agra Karya Digital) | WA: 081519250845 | t.me/VeryCoolApps';
  const WARNING = '\n\n⚠️ STOP! Konten dilindungi hak cipta.\n' + BRAND + '\nPenggunaan tanpa izin melanggar UU No. 28/2014.\n';
  document.addEventListener('copy', function (e) {
    const sel = window.getSelection().toString();
    if (sel && sel.length > 0) {
      e.clipboardData.setData('text/plain', sel + WARNING);
      e.preventDefault();
    }
  });
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest && e.target.closest('input, textarea')) return; // izinkan form
    e.preventDefault();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && e.key === 'U')) {
      e.preventDefault();
    }
  });
})();
