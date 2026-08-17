/* =============================================================================
   © 2026 VeryCoolApps — PT. Agra Karya Digital
   ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
   SalesDesk Pro v1.0.0 — Pages (dashboard, CRM, komisi, laporan, admin)
   ============================================================================= */
'use strict';

const Pages = {};

/* ================= DASHBOARD — 19 widget ================= */

Pages.dashboard = {
  title: 'Dashboard',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Menghitung widget…</p></div>';
    const data = await svc('dashboard', 'day');
    const settings = await svc('getSettings');
    const isTeam = ctx.user.role !== 'Sales';

    const pctColor = (p) => p >= 100 ? 'progress-green' : p >= 50 ? 'progress-amber' : 'progress-red';
    const targetPct = data.target_percent;
    const targetRemain = data.month_target - data.month_revenue;

    const wPriorities = `
      <div class="card widget widget-tall" data-nav="followups">
        <div class="w-head"><div class="w-title">🎯 Today&rsquo;s Priorities</div><button class="btn-more" onclick="Pages.nav('followups')">Lihat Semua</button></div>
        <div class="widget-list">
          ${data.priorities.length ? data.priorities.map(p => `
            <div class="w-item ${p.overdue ? 'overdue' : ''}" onclick="Pages.nav('${p.type === 'deal' ? 'pipeline' : 'followups'}')">
              <div class="w-ic" style="background:${p.type === 'deal' ? 'rgba(14,118,214,.2)' : 'rgba(217,119,6,.2)'}">${p.type === 'deal' ? '💼' : '⏰'}</div>
              <div class="grow"><div class="t1">${esc(p.title)}</div><div class="t2">${p.type === 'deal' ? fmtRp(p.value) : ''} · due ${fmtDate(p.due)}</div></div>
              <span class="badge ${p.overdue ? 'badge-red' : p.due === data.today ? 'badge-amber' : 'badge-blue'}">${p.overdue ? 'Terlambat' : p.due === data.today ? 'Hari ini' : 'Akan datang'}</span>
            </div>`).join('') : '<div class="empty" style="padding:22px"><div class="ic">🎉</div><p>Tidak ada prioritas hari ini</p></div>'}
        </div>
      </div>`;

    const wMeetings = `
      <div class="card widget" data-nav="meetings">
        <div class="w-head"><div class="w-title">🗓️ Today&rsquo;s Meetings</div><button class="btn-more" onclick="Pages.nav('meetings')">Lihat Semua</button></div>
        <div class="widget-list">
          ${data.today_meetings.length ? data.today_meetings.map(m => `
            <div class="w-item">
              <div class="w-ic" style="background:rgba(14,118,214,.2)">🗓️</div>
              <div class="grow"><div class="t1">${esc(m.title)}</div><div class="t2">${fmtDateTime(m.start_time)}${m.location ? ' · ' + esc(m.location) : ''}</div></div>
              ${m.in_minutes != null && m.in_minutes > 0 && m.in_minutes <= 30 ? '<span class="badge badge-amber">' + m.in_minutes + ' mnt lagi</span>' : ''}
            </div>`).join('') : '<div class="empty" style="padding:18px"><p>Tidak ada meeting hari ini</p></div>'}
        </div>
      </div>`;

    const wFollowupsDue = `
      <div class="card widget" data-nav="followups">
        <div class="w-head"><div class="w-title">⏰ Follow-ups Due Today</div><button class="btn-more" onclick="Pages.nav('followups')">Lihat Semua</button></div>
        <div class="widget-list">
          ${data.today_followups.length ? data.today_followups.map(f => `
            <div class="w-item"><div class="w-ic" style="background:rgba(5,150,105,.2)">✅</div>
              <div class="grow"><div class="t1">${esc(f.title)}</div><div class="t2">${f.prospect_name ? esc(f.prospect_name) : ''} · ${f.priority}</div></div>
              <button class="mini-btn" onclick="Pages.completeFollowup(${f.id})">Selesai</button></div>`).join('')
            : '<div class="empty" style="padding:18px"><p>Semua follow-up beres ✅</p></div>'}
        </div>
      </div>`;

    const wOverdue = `
      <div class="card widget" data-nav="followups">
        <div class="w-head"><div class="w-title">🔴 Overdue Follow-ups</div><button class="btn-more" onclick="Pages.nav('followups')">Lihat Semua</button></div>
        <div class="widget-list">
          ${data.overdue.length ? data.overdue.map(f => `
            <div class="w-item overdue"><div class="w-ic" style="background:rgba(220,38,38,.2)">⏰</div>
              <div class="grow"><div class="t1">${esc(f.title)}</div><div class="t2">Terlambat ${Math.max(1, Math.round((new Date(data.today) - new Date(f.due_date)) / 86400000))} hari${isTeam ? ' · ' + esc(f.owner_name || '') : ''}</div></div>
              <button class="mini-btn" onclick="Pages.completeFollowup(${f.id})">Selesai</button></div>`).join('')
            : '<div class="empty" style="padding:18px"><p>Tidak ada follow-up terlambat 🎉</p></div>'}
        </div>
      </div>`;

    const wNewProspects = `
      <div class="card widget" data-nav="prospects">
        <div class="w-head"><div class="w-title">✨ New Prospects</div><button class="btn-more" onclick="Pages.nav('prospects')">Lihat Semua</button></div>
        <div class="w-big">${data.new_prospects}</div>
        <div class="w-sub">${data.new_prospects_delta > 0 ? '<span class="w-delta-up">▲ ' + data.new_prospects_delta + '%</span>' : data.new_prospects_delta < 0 ? '<span class="w-delta-down">▼ ' + Math.abs(data.new_prospects_delta) + '%</span>' : '±0%'} vs periode sebelumnya</div>
      </div>`;

    const wOpps = `
      <div class="card widget" data-nav="pipeline">
        <div class="w-head"><div class="w-title">📊 Open Opportunities</div><button class="btn-more" onclick="Pages.nav('pipeline')">Pipeline</button></div>
        <div class="w-big">${fmtRp(data.open_opportunities.value)}</div>
        <div class="w-sub">${data.open_opportunities.count} deal aktif di pipeline</div>
      </div>`;

    const wClosing = `
      <div class="card widget" data-nav="pipeline">
        <div class="w-head"><div class="w-title">🔥 Deals Closing Soon (≤7 hari)</div><button class="btn-more" onclick="Pages.nav('pipeline')">Pipeline</button></div>
        <div class="widget-list">
          ${data.closing_soon.length ? data.closing_soon.map(d => `
            <div class="w-item"><div class="w-ic" style="background:rgba(217,119,6,.2)">🔥</div>
              <div class="grow"><div class="t1">${esc(d.name)}</div><div class="t2">${fmtRp(d.value)} · closing ${fmtDate(d.estimated_close)}</div></div></div>`).join('')
            : '<div class="empty" style="padding:18px"><p>Tidak ada deal closing minggu ini</p></div>'}
        </div>
      </div>`;

    const wRevenue = `
      <div class="card widget" data-nav="reports">
        <div class="w-head"><div class="w-title">💰 Monthly Revenue</div><button class="btn-more" onclick="Pages.nav('reports')">Laporan</button></div>
        <div class="w-big">${fmtRp(data.month_revenue)}</div>
        <div class="w-sub">Bulan ${currentMonth()}</div>
      </div>`;

    const wTarget = `
      <div class="card widget" data-nav="targets">
        <div class="w-head"><div class="w-title">🎯 Monthly Target</div><button class="btn-more" onclick="Pages.nav('targets')">Target</button></div>
        <div class="w-big">${fmtRp(data.month_target)}</div>
        <div class="w-sub">${data.month_target === 0 ? 'Belum ada target — klik untuk set' : 'Untuk bulan berjalan'}</div>
      </div>`;

    const wAch = `
      <div class="card widget" data-nav="targets">
        <div class="w-head"><div class="w-title">📈 Target Achievement</div><button class="btn-more" onclick="Pages.nav('targets')">Target</button></div>
        <div class="row-flex" style="gap:12px">
          <div class="w-big">${targetPct == null ? '—' : targetPct + '%'}</div>
          <div style="flex:1"><div class="progress ${pctColor(targetPct || 0)}"><div style="width:${Math.min(100, targetPct || 0)}%"></div></div>
          <div class="w-sub">${targetPct == null ? 'Set target untuk mulai menghitung.' : targetRemain > 0 ? 'Sisa ' + fmtRp(targetRemain) + ' untuk mencapai target' : 'Target tercapai! 🎉'}</div></div>
        </div>
      </div>`;

    const wComm = `
      <div class="card widget" data-nav="commissions">
        <div class="w-head"><div class="w-title">💵 Commission Earned</div><button class="btn-more" onclick="Pages.nav('commissions')">Komisi</button></div>
        <div class="w-big">${fmtRp(data.commission_earned)}</div>
        <div class="w-sub">Komisi bulan berjalan (Confirmed + Overridden)</div>
      </div>`;

    const wForecast = `
      <div class="card widget" data-nav="commissions">
        <div class="w-head"><div class="w-title">⚡ Commission Forecast</div><button class="btn-more" onclick="Pages.nav('commissions')">Komisi</button></div>
        <div class="w-big">${fmtRp(data.commission_forecast.total)}</div>
        <div class="w-sub">Proyeksi dari ${data.commission_forecast.count} deal aktif — bukan jaminan</div>
      </div>`;

    const actTypes = (data.activity_today.types || []).map(t => t.type + ': ' + t.c).join(' · ');
    const wAct = `
      <div class="card widget" data-nav="activities">
        <div class="w-head"><div class="w-title">📞 Activity Counter</div></div>
        <div class="w-big">${data.activity_today.count}</div>
        <div class="w-sub">${actTypes || 'Belum ada aktivitas hari ini'}</div>
      </div>`;

    const wWeekly = `
      <div class="card widget widget-wide" data-nav="reports">
        <div class="w-head"><div class="w-title">📊 Weekly Performance (7 hari terakhir)</div></div>
        <div class="chart-box">${barChart(data.weekly_performance.map(d => ({ label: d.day, value: d.revenue })), { height: 130, fmt: (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'jt' : v >= 1000 ? (v / 1000).toFixed(0) + 'rb' : v })}</div>
      </div>`;

    const wMonthly = `
      <div class="card widget widget-wide" data-nav="reports">
        <div class="w-head"><div class="w-title">📈 Monthly Performance (12 bulan)</div></div>
        <div class="chart-box">${lineChart(data.monthly_performance.map(d => ({ label: d.label, value: d.revenue })), { height: 150, fmt: (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'jt' : v })}</div>
      </div>`;

    const wQuick = `
      <div class="card widget" data-nav="">
        <div class="w-head"><div class="w-title">⚡ Quick Actions</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="Pages.quickProspect()">+ Prospek</button>
          <button class="btn btn-green btn-sm" onclick="Pages.quickFollowup()">+ Follow-up</button>
          <button class="btn btn-amber btn-sm" onclick="Pages.quickMeeting()">+ Meeting</button>
          <button class="btn btn-ghost btn-sm" onclick="Pages.quickDeal()">+ Deal</button>
        </div>
        <div class="w-sub mt">Shortcut: Ctrl+N · Ctrl+F · Ctrl+M</div>
      </div>`;

    const wRecent = `
      <div class="card widget widget-tall" data-nav="activities">
        <div class="w-head"><div class="w-title">🕒 Recent Activity</div></div>
        <div class="widget-list">
          ${data.recent_activity.length ? data.recent_activity.map(a => `
            <div class="w-item"><div class="w-ic" style="background:rgba(148,163,184,.15)">${a.type === 'call' ? '📞' : a.type === 'email' ? '✉️' : a.type === 'meeting' ? '🗓️' : '📝'}</div>
              <div class="grow"><div class="t1">${esc(a.note || a.type)}</div><div class="t2">${esc(a.user_name || '')} · ${timeAgo(a.created_at)}</div></div></div>`).join('')
            : '<div class="empty" style="padding:18px"><p>Belum ada aktivitas</p></div>'}
        </div>
      </div>`;

    const wDeadlines = `
      <div class="card widget" data-nav="followups">
        <div class="w-head"><div class="w-title">⏳ Upcoming Deadlines</div><button class="btn-more" onclick="Pages.nav('followups')">Lihat Semua</button></div>
        <div class="widget-list">
          ${data.deadlines.length ? data.deadlines.map(d => {
            const days = Math.round((new Date(d.date) - new Date(data.today)) / 86400000);
            return `<div class="w-item"><div class="w-ic" style="background:${d.kind === 'deal' ? 'rgba(14,118,214,.2)' : 'rgba(217,119,6,.2)'}">${d.kind === 'deal' ? '💼' : '⏰'}</div>
              <div class="grow"><div class="t1">${esc(d.title)}</div><div class="t2">${fmtDate(d.date)}</div></div>
              <span class="badge ${days <= 1 ? 'badge-red' : days <= 3 ? 'badge-amber' : 'badge-blue'}">${days} hari</span></div>`;
          }).join('') : '<div class="empty" style="padding:18px"><p>Tidak ada deadline minggu ini</p></div>'}
        </div>
      </div>`;

    const sc = data.scorecard;
    const wScore = `
      <div class="card widget" data-nav="targets">
        <div class="w-head"><div class="w-title">🏅 Personal Sales Scorecard</div><button class="btn-more" onclick="Pages.nav('targets')">Detail</button></div>
        <div class="gauge-wrap">
          ${gauge(sc.score, 110, sc.label)}
          <div style="flex:1">
            <div class="score-label">${sc.score}<span style="font-size:14px;color:var(--text-faint)">/100</span></div>
            <div class="score-detail">${sc.label}</div>
            <div class="score-detail mt">Aktivitas ${sc.sActivity} · Follow-up ${sc.sFollowup}</div>
            <div class="score-detail">Deal ${sc.sDeal} · Revenue ${sc.sRevenue}</div>
          </div>
        </div>
      </div>`;

    const wActCounter = wAct;
    const grid = `
      <div class="stat-cards">
        <div class="card stat-card"><div class="lbl">💰 Revenue Bulan Ini</div><div class="val">${fmtRp(data.month_revenue)}</div><div class="sub">Deal Won · ${currentMonth()}</div></div>
        <div class="card stat-card"><div class="lbl">🎯 Target Bulan Ini</div><div class="val">${fmtRp(data.month_target)}</div><div class="sub">${targetPct == null ? 'Belum diset' : 'Pencapaian ' + targetPct + '%'}</div></div>
        <div class="card stat-card"><div class="lbl">💵 Komisi Bulan Ini</div><div class="val">${fmtRp(data.commission_earned)}</div><div class="sub">Forecast: ${fmtRp(data.commission_forecast.total)}</div></div>
        <div class="card stat-card"><div class="lbl">✨ Prospek Baru</div><div class="val">${data.new_prospects}</div><div class="sub">${isTeam ? 'Tim' : 'Anda'} · ${data.period}</div></div>
      </div>
      <div class="toolbar">
        <span class="muted small">Filter periode:</span>
        <button class="btn btn-sm ${data.period === 'day' ? 'btn-primary' : 'btn-ghost'}" onclick="Pages.dashboardPeriod('day')">Hari</button>
        <button class="btn btn-sm ${data.period === 'week' ? 'btn-primary' : 'btn-ghost'}" onclick="Pages.dashboardPeriod('week')">Minggu</button>
        <button class="btn btn-sm ${data.period === 'month' ? 'btn-primary' : 'btn-ghost'}" onclick="Pages.dashboardPeriod('month')">Bulan</button>
        <span class="grow"></span>
        <button class="btn btn-sm btn-ghost" onclick="Pages.nav('commissions'); Pages.runTrueUp()">🔁 Jalankan True-up Komisi</button>
      </div>
      <div class="widget-grid">
        ${wPriorities}${wMeetings}${wFollowupsDue}${wOverdue}
        ${wNewProspects}${wOpps}${wClosing}${wRevenue}
        ${wTarget}${wAch}${wComm}${wForecast}
        ${wActCounter}${wWeekly}${wMonthly}${wQuick}
        ${wRecent}${wDeadlines}${wScore}
      </div>`;

    // Insight cerdas (rule-based, bukan AI — sesuai PRD Bab 12)
    const insights = [];
    if (data.overdue.length > 0) insights.push('🔴 ' + data.overdue.length + ' follow-up terlambat — selesaikan hari ini untuk menyelamatkan deal.');
    if (data.closing_soon.length > 0) insights.push('🔥 ' + data.closing_soon.length + ' deal akan closing ≤7 hari dengan nilai total ' + fmtRp(data.closing_soon.reduce((a, d) => a + Number(d.value || 0), 0)) + '.');
    if (targetPct != null && targetPct < 50 && data.month_target > 0) insights.push('⚠️ Pencapaian target baru ' + targetPct + '% — butuh akselerasi penjualan.');
    if (targetPct != null && targetPct >= 100) insights.push('🏆 Target bulan ini tercapai (' + targetPct + '%)!');
    if (data.today_followups.length === 0 && data.overdue.length === 0) insights.push('✅ Semua follow-up beres. Tambah prospek baru untuk jaga pipeline.');
    if (data.open_opportunities.count === 0) insights.push('📊 Pipeline kosong — tambah prospek & deal baru.');

    box.innerHTML =
      (insights.length ? '<div class="brand-banner mb">💡 <b>Smart Insight:</b> ' + insights[0] + (insights.length > 1 ? ' <span class="muted">+' + (insights.length - 1) + ' lainnya</span>' : '') + '</div>' : '') +
      grid;

    // klik widget → navigasi
    $$('.widget[data-nav]', box).forEach(w => {
      w.style.cursor = 'pointer';
      if (w.getAttribute('data-nav')) w.addEventListener('click', (e) => {
        if (e.target.closest('button, .btn-more, .mini-btn')) return;
        Pages.nav(w.getAttribute('data-nav'));
      });
    });
  }
};

Pages.dashboardPeriod = (p) => {
  const box = $('#content');
  Pages.dashboard.render(box, AppState.ctx).catch(e => toast('Gagal memuat dashboard', e.message, 'error'));
};

/* ================= PROSPECTS ================= */

Pages.prospects = {
  title: 'Prospek',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat prospek…</p></div>';
    const stages = await svc('getStages');
    const sources = await svc('listSources');
    const rows = await svc('listProspects', {});
    const totalVal = rows.reduce((a, r) => a + Number(r.estimated_value || 0), 0);

    box.innerHTML = `
      <div class="stat-cards">
        <div class="card stat-card"><div class="lbl">Total Prospek</div><div class="val">${rows.length}</div></div>
        <div class="card stat-card"><div class="lbl">Estimasi Nilai</div><div class="val">${fmtRp(totalVal)}</div></div>
        <div class="card stat-card"><div class="lbl">Tahap Prospek</div><div class="val">${rows.filter(r => r.stage === 'Prospek').length}</div></div>
        <div class="card stat-card"><div class="lbl">Tahap Deal</div><div class="val">${rows.filter(r => r.stage === 'Deal').length}</div></div>
      </div>
      <div class="toolbar">
        <div class="global-search" style="width:240px"><input class="input" id="pros-search" placeholder="Cari nama / perusahaan…"></div>
        <select class="input" id="pros-stage" style="width:160px"><option value="">Semua tahapan</option>${stages.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}</select>
        <span class="grow"></span>
        <button class="btn btn-ghost" onclick="Pages.importProspect()">📥 Import CSV</button>
        <button class="btn btn-primary" onclick="Pages.prospectForm()">+ Prospek Baru</button>
      </div>
      <div class="card table-wrap">
        ${rows.length ? `<table class="tbl">
          <thead><tr><th>Nama</th><th>Perusahaan</th><th>Sumber</th><th>Tahapan</th><th>Estimasi Nilai</th><th>Pemilik</th><th>Dibuat</th><th></th></tr></thead>
          <tbody>${rows.map(r => `<tr>
            <td><b>${esc(r.name)}</b></td>
            <td>${esc(r.company || '—')}</td>
            <td>${esc(r.source || '—')}</td>
            <td><span class="badge badge-blue">${esc(r.stage)}</span></td>
            <td>${fmtRp(r.estimated_value)}</td>
            <td>${esc(r.owner_name || '—')}</td>
            <td class="muted">${fmtDate(r.created_at)}</td>
            <td><div class="row-actions">
              <button class="mini-btn" onclick="Pages.prospectDetail(${r.id})">Detail</button>
              <button class="mini-btn" onclick="Pages.prospectForm(${r.id})">Edit</button>
              <button class="mini-btn danger" onclick="Pages.deleteProspect(${r.id})">🗑</button>
            </div></td></tr>`).join('')}</tbody></table>`
        : `<div class="empty"><div class="ic">👥</div><p>Belum ada prospek. Klik <b>+ Prospek Baru</b> untuk mulai.</p></div>`}
      </div>`;

    const search = $('#pros-search'), stageSel = $('#pros-stage');
    const apply = async () => {
      const r = await svc('listProspects', { search: search.value, stage: stageSel.value });
      Pages.renderTableInto(box, 'prospects', r);
    };
    search.addEventListener('input', debounce(apply, 350));
    stageSel.addEventListener('change', apply);
  }
};

Pages.renderTableInto = (box, type, rows) => {
  // Re-render hanya bagian tabel
  Pages[type].render(box, AppState.ctx).catch(() => {});
};

Pages.prospectForm = async (id) => {
  const stages = await svc('getStages');
  const sources = await svc('listSources');
  const contacts = await svc('listContacts', {});
  let p = { name: '', company: '', source: '', estimated_value: 0, stage: 'Prospek', notes: '', contact_id: '' };
  if (id) p = await svc('getProspect', id);
  const m = openModal(`
    <h3>${id ? 'Edit Prospek' : '+ Prospek Baru'}</h3>
    <div class="grid-2">
      <label class="field">Nama / Perusahaan *<input class="input" id="p-name" value="${esc(p.name)}" placeholder="cth: PT Maju Jaya"></label>
      <label class="field">Perusahaan / Brand<input class="input" id="p-company" value="${esc(p.company || '')}"></label>
      <label class="field">Sumber Prospek<select class="input" id="p-source">${sources.map(s => `<option ${p.source === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">Estimasi Nilai (Rp)<input class="input" id="p-value" type="number" value="${p.estimated_value || 0}"></label>
      <label class="field">Tahapan<select class="input" id="p-stage">${stages.map(s => `<option ${p.stage === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">Kontak Terkait<select class="input" id="p-contact"><option value="">— Tanpa kontak —</option>${contacts.map(c => `<option value="${c.id}" ${String(p.contact_id) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    </div>
    <label class="field">Catatan<textarea class="input" id="p-notes">${esc(p.notes || '')}</textarea></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="p-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#p-save').onclick = async () => {
    const payload = {
      name: m.$('#p-name').value, company: m.$('#p-company').value, source: m.$('#p-source').value,
      estimated_value: m.$('#p-value').value, stage: m.$('#p-stage').value,
      notes: m.$('#p-notes').value, contact_id: m.$('#p-contact').value || null
    };
    const r = await tryCatch(() => id ? svc('updateProspect', id, payload) : svc('createProspect', payload));
    if (!r.ok) { toast('Gagal menyimpan', r.error, 'error'); return; }
    if (r.data.duplicates && r.data.duplicates.length) {
      const names = r.data.duplicates.map(d => d.name).join(', ');
      const cont = await confirmDialog('Kemungkinan duplikat', 'Nama mirip dengan prospek yang sudah ada: <b>' + esc(names) + '</b>. Tetap simpan?');
      if (!cont) { m.close(); Pages.nav('prospects'); return; }
    }
    m.close();
    toast('Prospek tersimpan', p.name || payload.name, 'success');
    Pages.nav('prospects');
  };
};

Pages.prospectDetail = async (id) => {
  const p = await svc('getProspect', id);
  const acts = await svc('listActivities', 'prospect', id, 50);
  const fups = await svc('listFollowups', {});
  const relFups = fups.filter(f => Number(f.prospect_id) === Number(id));
  const m = openModal(`
    <h3>${esc(p.name)} <span class="badge badge-blue">${esc(p.stage)}</span></h3>
    <div class="grid-2 mb">
      <div><div class="muted small">Perusahaan</div><b>${esc(p.company || '—')}</b></div>
      <div><div class="muted small">Estimasi Nilai</div><b>${fmtRp(p.estimated_value)}</b></div>
      <div><div class="muted small">Sumber</div>${esc(p.source || '—')}</div>
      <div><div class="muted small">Pemilik</div>${esc(p.owner_name || '—')}</div>
    </div>
    <div class="tabs"><div class="tab active" data-t="info">Info & Riwayat</div><div class="tab" data-t="fup">Follow-up (${relFups.length})</div></div>
    <div id="pd-info">
      <p class="muted small">${esc(p.notes || 'Tidak ada catatan.')}</p>
      <div class="timeline mt">
        ${acts.length ? acts.map(a => `<div class="tl-item"><div class="tl-title">${a.type === 'call' ? '📞' : a.type === 'email' ? '✉️' : a.type === 'meeting' ? '🗓️' : '📝'} ${esc(a.note || a.type)}</div><div class="tl-sub">${esc(a.user_name || '')} · ${fmtDateTime(a.created_at)}</div></div>`).join('') : '<div class="muted small">Belum ada aktivitas.</div>'}
      </div>
    </div>
    <div id="pd-fup" class="hidden">
      ${relFups.length ? relFups.map(f => `<div class="w-item ${f.status === 'Overdue' ? 'overdue' : ''}"><div class="grow"><div class="t1">${esc(f.title)}</div><div class="t2">due ${fmtDate(f.due_date)}</div></div><span class="badge ${f.status === 'Done' ? 'badge-green' : f.status === 'Overdue' ? 'badge-red' : 'badge-amber'}">${f.status}</span></div>`).join('') : '<div class="muted small">Belum ada follow-up.</div>'}
    </div>
    <div class="m-foot">
      <button class="btn btn-ghost" data-close>Tutup</button>
      <button class="btn btn-amber" onclick="Pages.quickFollowup(${p.id})">+ Follow-up</button>
      <button class="btn btn-ghost" onclick="Pages.addActivity('prospect', ${p.id})">+ Aktivitas</button>
      <button class="btn btn-primary" onclick="Pages.prospectForm(${p.id}); ${'m.close()'}">Edit</button>
    </div>`, { wide: true });
  m.$('[data-close]').onclick = m.close;
  $$('.tab', m.el).forEach(t => t.onclick = () => {
    $$('.tab', m.el).forEach(x => x.classList.toggle('active', x === t));
    m.$('#pd-info').classList.toggle('hidden', t.dataset.t !== 'info');
    m.$('#pd-fup').classList.toggle('hidden', t.dataset.t !== 'fup');
  });
};

Pages.deleteProspect = async (id) => {
  const reason = await reasonDialog('Hapus Prospek', 'Data akan dipindah ke Recycle Bin (pulihkan 30 hari).', { danger: true, yes: 'Hapus' });
  if (!reason) return;
  const r = await tryCatch(() => svc('softDeleteProspect', id, reason));
  toast(r.ok ? 'Prospek dihapus (soft delete)' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
  Pages.nav('prospects');
};

Pages.importProspect = async () => {
  const m = openModal(`
    <h3>Import Prospek dari CSV</h3>
    <p class="muted small mb">Format: baris pertama = header. Kolom minimal: <b>name</b> (atau nama). Opsional: company/perusahaan, source/sumber, value/estimasi, stage/tahapan, phone/telepon.</p>
    <textarea class="input" id="csv-text" style="min-height:200px" placeholder="name,company,value&#10;PT Maju Jaya,Distributor Maju,50000000&#10;Toko Berkah,Berkah Group,15000000"></textarea>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="csv-go">Import</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#csv-go').onclick = async () => {
    const r = await tryCatch(() => svc('importProspectsCsv', m.$('#csv-text').value, {}));
    if (!r.ok) { toast('Import gagal', r.error, 'error'); return; }
    m.close();
    toast('Import selesai', r.data.inserted + ' prospek ditambahkan' + (r.data.skipped ? ', ' + r.data.skipped + ' dilewati' : ''), 'success');
    if (r.data.duplicates.length) toast('Kemungkinan duplikat', r.data.duplicates.join('; '), 'warn');
    Pages.nav('prospects');
  };
};

/* ================= CONTACTS ================= */

Pages.contacts = {
  title: 'Kontak',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat kontak…</p></div>';
    const rows = await svc('listContacts', {});
    box.innerHTML = `
      <div class="toolbar">
        <div class="global-search" style="width:240px"><input class="input" id="con-search" placeholder="Cari kontak…"></div>
        <span class="grow"></span>
        <button class="btn btn-primary" onclick="Pages.contactForm()">+ Kontak Baru</button>
      </div>
      <div class="card table-wrap">
        ${rows.length ? `<table class="tbl"><thead><tr><th>Nama</th><th>Jabatan</th><th>Perusahaan</th><th>Email</th><th>Telepon</th><th>Pemilik</th><th></th></tr></thead><tbody>
          ${rows.map(c => `<tr>
            <td><span class="avatar-mini">${initials(c.name)}</span><b>${esc(c.name)}</b></td>
            <td>${esc(c.position || '—')}</td><td>${esc(c.company || '—')}</td>
            <td>${esc(c.email || '—')}</td><td>${esc(c.phone || '—')}</td>
            <td class="muted">${esc(c.owner_name || '—')}</td>
            <td><div class="row-actions"><button class="mini-btn" onclick="Pages.contactForm(${c.id})">Edit</button>
            <button class="mini-btn danger" onclick="Pages.deleteContact(${c.id})">🗑</button></div></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="ic">📇</div><p>Belum ada kontak. Klik <b>+ Kontak Baru</b>.</p></div>`}
      </div>`;
    const search = $('#con-search');
    search.addEventListener('input', debounce(async () => {
      const r = await svc('listContacts', { search: search.value });
      Pages.contacts.render(box, ctx).catch(() => {});
    }, 350));
  }
};

Pages.contactForm = async (id) => {
  let c = { name: '', position: '', email: '', phone: '', company: '', notes: '' };
  if (id) {
    const all = await svc('listContacts', {});
    c = all.find(x => Number(x.id) === Number(id)) || c;
  }
  const m = openModal(`
    <h3>${id ? 'Edit Kontak' : '+ Kontak Baru'}</h3>
    <div class="grid-2">
      <label class="field">Nama Lengkap *<input class="input" id="c-name" value="${esc(c.name)}"></label>
      <label class="field">Jabatan<input class="input" id="c-position" value="${esc(c.position || '')}"></label>
      <label class="field">Email<input class="input" id="c-email" value="${esc(c.email || '')}"></label>
      <label class="field">Telepon / WA<input class="input" id="c-phone" value="${esc(c.phone || '')}"></label>
      <label class="field">Perusahaan<input class="input" id="c-company" value="${esc(c.company || '')}"></label>
    </div>
    <label class="field">Catatan<textarea class="input" id="c-notes">${esc(c.notes || '')}</textarea></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="c-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#c-save').onclick = async () => {
    const payload = {
      name: m.$('#c-name').value, position: m.$('#c-position').value, email: m.$('#c-email').value,
      phone: m.$('#c-phone').value, company: m.$('#c-company').value, notes: m.$('#c-notes').value
    };
    const r = await tryCatch(() => id ? svc('updateContact', id, payload) : svc('createContact', payload));
    if (!r.ok) { toast('Gagal menyimpan', r.error, 'error'); return; }
    m.close(); toast('Kontak tersimpan', '', 'success'); Pages.nav('contacts');
  };
};

Pages.deleteContact = async (id) => {
  const reason = await reasonDialog('Hapus Kontak', '', { danger: true, yes: 'Hapus' });
  if (!reason) return;
  const r = await tryCatch(() => svc('deleteContact', id, reason));
  toast(r.ok ? 'Kontak dihapus' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
  Pages.nav('contacts');
};

/* ================= PIPELINE (KANBAN) ================= */

Pages.pipeline = {
  title: 'Pipeline',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat pipeline…</p></div>';
    const stages = await svc('getStages');
    const deals = await svc('listDeals', {});
    const users = ctx.user.role === 'Admin' || ctx.user.role === 'Manager' ? await svc('listUsers') : [];

    box.innerHTML = `
      <div class="toolbar">
        <select class="input" id="pipe-owner" style="width:200px"><option value="">Semua pemilik</option>${users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>
        <select class="input" id="pipe-status" style="width:160px"><option value="">Semua status</option><option>Open</option><option>Won</option><option>Lost</option></select>
        <span class="grow"></span>
        <button class="btn btn-primary" onclick="Pages.quickDeal()">+ Deal</button>
      </div>
      <div class="kanban" id="kanban"></div>`;

    const ownerSel = $('#pipe-owner'), statusSel = $('#pipe-status');
    const renderKanban = async () => {
      const rows = await svc('listDeals', {
        owner: ownerSel.value ? Number(ownerSel.value) : undefined,
        status: statusSel.value || undefined
      });
      const kb = $('#kanban');
      kb.innerHTML = stages.map((s, si) => {
        const col = rows.filter(d => d.stage === s.name && d.status === 'Open');
        const won = rows.filter(d => d.status === 'Won' && d.stage === s.name);
        const lost = rows.filter(d => d.status === 'Lost' && d.stage === s.name);
        const items = col;
        const total = items.reduce((a, d) => a + Number(d.value || 0), 0);
        return `<div class="kanban-col" data-stage="${esc(s.name)}">
          <div class="kanban-head"><span>${esc(s.name)}</span><span class="kanban-count">${items.length} · ${fmtRp(total)}</span></div>
          ${items.map(d => kanbanCard(d)).join('')}
          ${won.length ? `<div class="muted small" style="margin-top:6px">✅ Won: ${won.length} (${fmtRp(won.reduce((a,x)=>a+Number(x.value||0),0))})</div>` : ''}
          ${lost.length ? `<div class="muted small">❌ Lost: ${lost.length}</div>` : ''}
          ${!items.length ? '<div class="empty" style="padding:16px"><p>Belum ada deal di tahap ini</p></div>' : ''}
        </div>`;
      }).join('');
      setupKanbanDrag();
    };
    await renderKanban();
    ownerSel.addEventListener('change', renderKanban);
    statusSel.addEventListener('change', renderKanban);
  }
};

function kanbanCard(d) {
  const overdue = d.estimated_close && d.estimated_close < todayISO();
  const days = d.estimated_close ? Math.round((new Date(d.estimated_close) - new Date()) / 86400000) : null;
  return `<div class="kanban-card" draggable="true" data-id="${d.id}" onclick="Pages.dealDetail(${d.id})">
    <div class="k-name">${esc(d.name)}</div>
    <div class="k-val">${fmtRp(d.value)}</div>
    <div class="k-meta"><span>${esc(d.owner_name || '')}</span>
      <span class="${overdue ? 'badge badge-red' : days != null && days <= 3 ? 'badge badge-amber' : ''}">${d.estimated_close ? fmtDate(d.estimated_close) : 'no close date'}</span></div>
  </div>`;
}

function setupKanbanDrag() {
  let dragId = null;
  $$('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  $$('.kanban-col').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (!id) return;
      const stage = col.dataset.stage;
      Pages.moveDeal(Number(id), stage);
    });
  });
}

Pages.moveDeal = async (id, stage) => {
  try {
    const deal = (await svc('listDeals', {})).find(d => Number(d.id) === Number(id));
    if (!deal) return;
    if (stage === 'Won') {
      if (AppState.user.role === 'Sales') { toast('Akses ditolak', 'Konfirmasi deal menang memerlukan Team Leader / Manager.', 'error'); return; }
      const ok = await confirmDialog('Konfirmasi Deal Menang', 'Deal <b>' + esc(deal.name) + '</b> (' + fmtRp(deal.value) + ') akan dikunci dan komisi dihitung otomatis. Lanjutkan?', { yes: 'Ya, Deal Menang 🏆' });
      if (!ok) return;
      const r = await tryCatch(() => svc('moveDeal', id, 'Won', {}));
      if (r.ok) { toast('Deal Menang! 🏆', 'Komisi dihitung: ' + fmtRp(r.data.result.nominal), 'success'); Pages.nav('pipeline'); }
      else toast('Gagal', r.error, 'error');
    } else if (stage === 'Lost') {
      if (AppState.user.role === 'Sales') { toast('Akses ditolak', 'Konfirmasi deal gagal memerlukan Team Leader / Manager.', 'error'); return; }
      const reason = await reasonDialog('Konfirmasi Deal Gagal', 'Deal <b>' + esc(deal.name) + '</b> ditandai Lost.', { yes: 'Ya, Deal Gagal' });
      if (!reason) return;
      const r = await tryCatch(() => svc('moveDeal', id, 'Lost', { lostReason: reason }));
      if (r.ok) { toast('Deal ditandai Lost', '', 'warn'); Pages.nav('pipeline'); }
      else toast('Gagal', r.error, 'error');
    } else {
      const r = await tryCatch(() => svc('moveDeal', id, stage, {}));
      if (r.ok) { toast('Deal dipindah ke ' + stage, '', 'success'); Pages.nav('pipeline'); }
      else toast('Gagal', r.error, 'error');
    }
  } catch (e) { toast('Gagal', e.message, 'error'); }
};

Pages.dealDetail = async (id) => {
  const d = await svc('getDeal', id);
  const acts = await svc('listActivities', 'deal', id, 50);
  const commissions = await svc('listCommissions', {});
  const comm = commissions.find(c => Number(c.deal_id) === Number(id));
  const m = openModal(`
    <h3>${esc(d.name)} <span class="badge ${d.status === 'Won' ? 'badge-green' : d.status === 'Lost' ? 'badge-red' : 'badge-blue'}">${d.status}</span></h3>
    <div class="grid-3 mb">
      <div><div class="muted small">Nilai</div><b>${fmtRp(d.value)}</b></div>
      <div><div class="muted small">Tahapan</div>${esc(d.stage)}</div>
      <div><div class="muted small">Pemilik</div>${esc(d.owner_name || '—')}</div>
      <div><div class="muted small">Produk</div>${esc(d.product_name || '—')}${d.qty ? ' × ' + d.qty : ''}</div>
      <div><div class="muted small">Estimasi Closing</div>${fmtDate(d.estimated_close)}</div>
      <div><div class="muted small">Won Date</div>${fmtDate(d.won_date)}</div>
    </div>
    ${comm ? `<div class="brand-banner mb">💵 <b>Komisi:</b> ${fmtRp(comm.nominal)} (${comm.percent}%) — status <b>${comm.status}</b>${comm.reason_override ? ' · ' + esc(comm.reason_override) : ''}</div>` : ''}
    ${d.lost_reason ? `<div class="brand-banner mb" style="border-color:rgba(220,38,38,.4)">❌ Alasan Lost: ${esc(d.lost_reason)}</div>` : ''}
    <div class="timeline">
      ${acts.length ? acts.map(a => `<div class="tl-item"><div class="tl-title">${a.type === 'call' ? '📞' : a.type === 'email' ? '✉️' : a.type === 'meeting' ? '🗓️' : '📝'} ${esc(a.note || a.type)}</div><div class="tl-sub">${esc(a.user_name || '')} · ${fmtDateTime(a.created_at)}</div></div>`).join('') : '<div class="muted small">Belum ada aktivitas.</div>'}
    </div>
    <div class="m-foot">
      <button class="btn btn-ghost" data-close>Tutup</button>
      <button class="btn btn-ghost" onclick="Pages.addActivity('deal', ${d.id})">+ Aktivitas</button>
      ${d.status === 'Open' && AppState.user.role !== 'Sales' ? '<button class="btn btn-danger" onclick="Pages.moveDeal(' + d.id + ', \'Lost\')">Lost</button><button class="btn btn-green" onclick="Pages.moveDeal(' + d.id + ', \'Won\')">Won 🏆</button>' : ''}
      ${d.status === 'Open' || AppState.user.role === 'Admin' ? '<button class="btn btn-primary" onclick="Pages.dealForm(' + d.id + ')">Edit</button>' : ''}
    </div>`, { wide: true });
  m.$('[data-close]').onclick = m.close;
};

Pages.dealForm = async (id) => {
  const stages = await svc('getStages');
  const products = await svc('listProducts');
  const prospects = await svc('listProspects', {});
  let d = { name: '', value: 0, stage: 'Prospek', product_name: '', qty: 1, estimated_close: '', prospect_id: '', notes: '' };
  if (id) d = await svc('getDeal', id);
  const m = openModal(`
    <h3>${id ? 'Edit Deal' : '+ Deal Baru'}</h3>
    <div class="grid-2">
      <label class="field">Nama Deal *<input class="input" id="d-name" value="${esc(d.name)}"></label>
      <label class="field">Nilai Deal (Rp)<input class="input" id="d-value" type="number" value="${d.value || 0}"></label>
      <label class="field">Tahapan<select class="input" id="d-stage">${stages.map(s => `<option ${d.stage === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">Produk<select class="input" id="d-product"><option value="">— Pilih produk —</option>${products.map(p => `<option value="${p.id}" data-price="${p.price}" ${String(d.product_id) === String(p.id) ? 'selected' : ''}>${esc(p.name)} (${fmtRp(p.price)})</option>`).join('')}</select></label>
      <label class="field">Jumlah (Qty)<input class="input" id="d-qty" type="number" value="${d.qty || 1}"></label>
      <label class="field">Estimasi Closing<input class="input" id="d-close" type="date" value="${d.estimated_close || ''}"></label>
      <label class="field">Prospek Terkait<select class="input" id="d-prospect"><option value="">— Tanpa prospek —</option>${prospects.map(p => `<option value="${p.id}" ${String(d.prospect_id) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    </div>
    <label class="field">Catatan<textarea class="input" id="d-notes">${esc(d.notes || '')}</textarea></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="d-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#d-product').addEventListener('change', () => {
    const opt = m.$('#d-product').selectedOptions[0];
    if (opt && opt.dataset.price) m.$('#d-value').value = Number(opt.dataset.price) * (Number(m.$('#d-qty').value) || 1);
  });
  m.$('#d-qty').addEventListener('input', () => {
    const opt = m.$('#d-product').selectedOptions[0];
    if (opt && opt.dataset.price) m.$('#d-value').value = Number(opt.dataset.price) * (Number(m.$('#d-qty').value) || 1);
  });
  m.$('#d-save').onclick = async () => {
    const payload = {
      name: m.$('#d-name').value, value: m.$('#d-value').value, stage: m.$('#d-stage').value,
      product_id: m.$('#d-product').value || null, product_name: (m.$('#d-product').selectedOptions[0] || {}).textContent ? m.$('#d-product').selectedOptions[0].textContent.split(' (')[0] : '',
      qty: m.$('#d-qty').value, estimated_close: m.$('#d-close').value || null,
      prospect_id: m.$('#d-prospect').value || null, notes: m.$('#d-notes').value
    };
    const r = await tryCatch(() => id ? svc('updateDeal', id, payload) : svc('createDeal', payload));
    if (!r.ok) { toast('Gagal menyimpan', r.error, 'error'); return; }
    m.close(); toast('Deal tersimpan', '', 'success'); Pages.nav('pipeline');
  };
};

Pages.addActivity = async (entityType, entityId) => {
  const m = openModal(`
    <h3>+ Aktivitas Baru</h3>
    <label class="field">Jenis<select class="input" id="a-type"><option value="call">📞 Panggilan</option><option value="email">✉️ Email</option><option value="meeting">🗓️ Meeting</option><option value="note">📝 Catatan</option></select></label>
    <label class="field">Catatan / Deskripsi<textarea class="input" id="a-note" placeholder="Apa yang terjadi?"></textarea></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="a-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#a-save').onclick = async () => {
    const r = await tryCatch(() => svc('addActivity', {
      type: m.$('#a-type').value, note: m.$('#a-note').value,
      prospect_id: entityType === 'prospect' ? entityId : null,
      deal_id: entityType === 'deal' ? entityId : null
    }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Aktivitas tercatat', '', 'success');
    if (entityType === 'prospect') Pages.prospectDetail(entityId);
    else Pages.dealDetail(entityId);
  };
};

/* ================= FOLLOW-UPS ================= */

Pages.followups = {
  title: 'Follow-up & Meeting',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat follow-up…</p></div>';
    const rows = await svc('listFollowups', {});
    const overdue = rows.filter(r => r.status === 'Overdue');
    const open = rows.filter(r => r.status === 'Open');
    const done = rows.filter(r => r.status === 'Done');
    const meetings = await svc('listMeetings', {});

    const fupTable = (list, emptyMsg) => list.length ? `<table class="tbl"><thead><tr><th>Judul</th><th>Prospek</th><th>Due</th><th>Prioritas</th><th>Status</th><th>Pemilik</th><th></th></tr></thead><tbody>
      ${list.map(f => `<tr>
        <td><b>${esc(f.title)}</b></td><td>${esc(f.prospect_name || '—')}</td>
        <td>${fmtDate(f.due_date)}</td>
        <td>${f.priority === 'High' ? '<span class="badge badge-red">Tinggi</span>' : f.priority === 'Normal' ? '<span class="badge badge-amber">Normal</span>' : '<span class="badge badge-gray">Rendah</span>'}</td>
        <td><span class="badge ${f.status === 'Done' ? 'badge-green' : f.status === 'Overdue' ? 'badge-red' : 'badge-blue'}">${f.status}</span></td>
        <td class="muted">${esc(f.owner_name || '')}</td>
        <td><div class="row-actions">${f.status !== 'Done' ? `<button class="mini-btn" onclick="Pages.completeFollowup(${f.id})">✓ Selesai</button>` : ''}<button class="mini-btn danger" onclick="Pages.deleteFollowup(${f.id})">🗑</button></div></td></tr>`).join('')}
      </tbody></table>` : `<div class="empty"><p>${emptyMsg}</p></div>`;

    box.innerHTML = `
      <div class="stat-cards">
        <div class="card stat-card"><div class="lbl">🔴 Overdue</div><div class="val" style="color:#f87171">${overdue.length}</div><div class="sub">Perlu aksi segera</div></div>
        <div class="card stat-card"><div class="lbl">🟡 Open</div><div class="val">${open.length}</div><div class="sub">Belum selesai</div></div>
        <div class="card stat-card"><div class="lbl">🟢 Selesai</div><div class="val" style="color:#34d399">${done.length}</div><div class="sub">Total follow-up selesai</div></div>
        <div class="card stat-card"><div class="lbl">🗓️ Meeting</div><div class="val">${meetings.length}</div><div class="sub">Jadwal tersimpan</div></div>
      </div>
      <div class="toolbar">
        <div class="tabs">
          <div class="tab active" data-t="all">Semua (${rows.length})</div>
          <div class="tab" data-t="open">Open (${open.length})</div>
          <div class="tab" data-t="overdue">Overdue (${overdue.length})</div>
          <div class="tab" data-t="done">Selesai (${done.length})</div>
        </div>
        <span class="grow"></span>
        <button class="btn btn-ghost" onclick="Pages.nav('meetings')">🗓️ Meeting</button>
        <button class="btn btn-primary" onclick="Pages.followupForm()">+ Follow-up</button>
      </div>
      <div class="card" id="fup-table">${fupTable(rows, 'Belum ada follow-up. Klik + Follow-up.')}</div>`;

    $$('.tab', box).forEach(t => t.onclick = () => {
      $$('.tab', box).forEach(x => x.classList.toggle('active', x === t));
      const map = { all: rows, open, overdue, done };
      $('#fup-table').innerHTML = fupTable(map[t.dataset.t], 'Tidak ada data di tab ini.');
    });
  }
};

Pages.followupForm = async (prospectId) => {
  const prospects = await svc('listProspects', {});
  const templates = await svc('listTemplates');
  const m = openModal(`
    <h3>+ Follow-up Baru</h3>
    <div class="grid-2">
      <label class="field">Judul *<input class="input" id="f-title" placeholder="cth: Follow-up penawaran paket"></label>
      <label class="field">Due Date *<input class="input" id="f-due" type="date" value="${todayISO()}"></label>
      <label class="field">Prioritas<select class="input" id="f-priority"><option>Normal</option><option>High</option><option>Low</option></select></label>
      <label class="field">Prospek Terkait<select class="input" id="f-prospect"><option value="">— Tanpa prospek —</option>${prospects.map(p => `<option value="${p.id}" ${String(prospectId) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    </div>
    <label class="field">Template<select class="input" id="f-template"><option value="">— Pakai template —</option>${templates.map(t => `<option value="${esc(t.template)}">${esc(t.name)}</option>`).join('')}</select></label>
    <label class="field">Catatan<textarea class="input" id="f-notes"></textarea></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="f-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#f-template').addEventListener('change', () => {
    if (m.$('#f-template').value) m.$('#f-notes').value = m.$('#f-template').value;
  });
  m.$('#f-save').onclick = async () => {
    const r = await tryCatch(() => svc('createFollowup', {
      title: m.$('#f-title').value, due_date: m.$('#f-due').value,
      priority: m.$('#f-priority').value, prospect_id: m.$('#f-prospect').value || null,
      notes: m.$('#f-notes').value
    }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Follow-up dibuat', 'Jatuh tempo ' + fmtDate(m.$('#f-due').value), 'success'); Pages.nav('followups');
  };
};

Pages.completeFollowup = async (id) => {
  const r = await tryCatch(() => svc('completeFollowup', id));
  toast(r.ok ? 'Follow-up selesai ✅' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
  const cur = AppState.currentPage;
  if (cur === 'dashboard') Pages.nav('dashboard');
  else Pages.nav('followups');
};

Pages.deleteFollowup = async (id) => {
  const reason = await reasonDialog('Hapus Follow-up', '', { danger: true, yes: 'Hapus' });
  if (!reason) return;
  await svc('deleteFollowup', id, reason);
  toast('Follow-up dihapus', '', 'success'); Pages.nav('followups');
};

/* ================= MEETINGS ================= */

Pages.meetings = {
  title: 'Meeting',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat jadwal…</p></div>';
    const rows = await svc('listMeetings', {});
    const upcoming = rows.filter(m => m.start_time >= new Date().toISOString().slice(0, 16).replace('T', ' '));
    const past = rows.filter(m => m.start_time < new Date().toISOString().slice(0, 16).replace('T', ' '));
    box.innerHTML = `
      <div class="toolbar">
        <span class="muted small">Meeting datang: <b>${upcoming.length}</b> · Selesai/lewat: <b>${past.length}</b></span>
        <span class="grow"></span>
        <button class="btn btn-primary" onclick="Pages.meetingForm()">+ Meeting Baru</button>
      </div>
      <div class="card table-wrap">
        ${rows.length ? `<table class="tbl"><thead><tr><th>Judul</th><th>Waktu</th><th>Peserta</th><th>Lokasi</th><th>Agenda</th><th></th></tr></thead><tbody>
          ${rows.map(mt => `<tr>
            <td><b>${esc(mt.title)}</b></td>
            <td>${fmtDateTime(mt.start_time)}</td>
            <td>${esc(mt.participants || '—')}</td>
            <td>${esc(mt.location || '—')}</td>
            <td class="muted">${esc((mt.agenda || '').slice(0, 50))}</td>
            <td><div class="row-actions"><button class="mini-btn danger" onclick="Pages.deleteMeeting(${mt.id})">🗑</button></div></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="ic">🗓️</div><p>Belum ada meeting. Klik <b>+ Meeting Baru</b>.</p></div>`}
      </div>`;
  }
};

Pages.meetingForm = async () => {
  const prospects = await svc('listProspects', {});
  const m = openModal(`
    <h3>+ Meeting Baru</h3>
    <div class="grid-2">
      <label class="field">Judul *<input class="input" id="mt-title"></label>
      <label class="field">Waktu Mulai *<input class="input" id="mt-time" type="datetime-local" value="${todayISO() + 'T09:00'}"></label>
      <label class="field">Lokasi<input class="input" id="mt-loc" placeholder="Online / Kantor / …"></label>
      <label class="field">Pengingat (menit sebelum)<input class="input" id="mt-remind" type="number" value="15"></label>
      <label class="field">Peserta<input class="input" id="mt-participants" placeholder="Nama peserta, pisahkan dengan koma"></label>
      <label class="field">Prospek Terkait<select class="input" id="mt-prospect"><option value="">— Tanpa prospek —</option>${prospects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
    </div>
    <label class="field">Agenda<textarea class="input" id="mt-agenda"></textarea></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="mt-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#mt-save').onclick = async () => {
    const r = await tryCatch(() => svc('createMeeting', {
      title: m.$('#mt-title').value, start_time: m.$('#mt-time').value.replace('T', ' '),
      location: m.$('#mt-loc').value, participants: m.$('#mt-participants').value,
      agenda: m.$('#mt-agenda').value, prospect_id: m.$('#mt-prospect').value || null,
      reminder_min: m.$('#mt-remind').value
    }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Meeting dijadwalkan', '', 'success'); Pages.nav('meetings');
  };
};

Pages.deleteMeeting = async (id) => {
  const reason = await reasonDialog('Hapus Meeting', '', { danger: true, yes: 'Hapus' });
  if (!reason) return;
  await svc('deleteMeeting', id, reason);
  toast('Meeting dihapus', '', 'success'); Pages.nav('meetings');
};

/* ================= TARGET & KPI ================= */

Pages.targets = {
  title: 'Target & KPI',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat target…</p></div>';
    const month = currentMonth();
    const rows = await svc('listTargets', month);
    const canManage = ['Manager', 'Admin'].includes(ctx.user.role);
    const users = canManage ? (await svc('listUsers')).filter(u => u.status === 'Active') : [];

    const scoreRow = async (u) => {
      const sc = await svc('scorecard', u.id, month);
      return sc;
    };

    let tableRows = '';
    for (const r of rows) {
      const pct = r.percent;
      const color = pct == null ? 'progress-red' : pct >= 100 ? 'progress-green' : pct >= 50 ? 'progress-amber' : 'progress-red';
      tableRows += `<tr>
        <td><span class="avatar-mini">${initials(r.user_name)}</span><b>${esc(r.user_name)}</b></td>
        <td>${fmtRp(r.target)}</td>
        <td>${fmtRp(r.revenue)}</td>
        <td>${pct == null ? '—' : pct + '%'}</td>
        <td style="min-width:130px"><div class="progress ${color}"><div style="width:${Math.min(100, pct || 0)}%"></div></div></td>
        <td>${r.activities}<span class="muted small">/${r.activity_target}</span></td>
        <td>${r.followups_done}<span class="muted small">/${r.followup_target}</span></td>
        <td>${r.deals_won}<span class="muted small">/${r.deal_target}</span></td>
        ${canManage ? `<td><button class="mini-btn" onclick="Pages.targetForm(${r.user_id}, '${month}')">Set Target</button></td>` : ''}
      </tr>`;
    }

    box.innerHTML = `
      <div class="toolbar">
        <span class="muted small">Periode: <b>${month}</b></span>
        <span class="grow"></span>
        ${canManage ? '<button class="btn btn-primary" onclick="Pages.targetForm(null, \'' + month + '\')">Set Target Sales</button>' : ''}
      </div>
      <div class="card table-wrap">
        ${rows.length ? `<table class="tbl"><thead><tr><th>Sales</th><th>Target Bulanan</th><th>Revenue</th><th>Pencapaian</th><th>Progress</th><th>Aktivitas</th><th>Follow-up</th><th>Deal Won</th>${canManage ? '<th></th>' : ''}</tr></thead><tbody>${tableRows}</tbody></table>`
        : `<div class="empty"><div class="ic">🎯</div><p>Belum ada target untuk bulan ini${canManage ? '. Klik <b>Set Target Sales</b>.' : '. Hubungi Manager/Admin.'}</p></div>`}
      </div>`;
  }
};

Pages.targetForm = async (userId, month) => {
  const users = (await svc('listUsers')).filter(u => u.status === 'Active');
  const rows = await svc('listTargets', month);
  const existing = rows.find(r => Number(r.user_id) === Number(userId));
  const selUser = userId || (users[0] ? users[0].id : null);
  const m = openModal(`
    <h3>Set Target Bulanan — ${month}</h3>
    <label class="field">Sales<select class="input" id="t-user">${users.map(u => `<option value="${u.id}" ${String(u.id) === String(selUser) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
    <div class="grid-2">
      <label class="field">Target Revenue (Rp)<input class="input" id="t-rev" type="number" value="${existing ? existing.target : 100000000}"></label>
      <label class="field">Target Aktivitas (kali)<input class="input" id="t-act" type="number" value="${existing ? existing.activity_target : 20}"></label>
      <label class="field">Target Follow-up Selesai<input class="input" id="t-fup" type="number" value="${existing ? existing.followup_target : 10}"></label>
      <label class="field">Target Deal Won<input class="input" id="t-deal" type="number" value="${existing ? existing.deal_target : 3}"></label>
    </div>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="t-save">Simpan Target</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#t-save').onclick = async () => {
    const r = await tryCatch(() => svc('setTarget', Number(m.$('#t-user').value), month, {
      target_revenue: m.$('#t-rev').value, activity_target: m.$('#t-act').value,
      followup_target: m.$('#t-fup').value, deal_target: m.$('#t-deal').value
    }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Target tersimpan', '', 'success'); Pages.nav('targets');
  };
};

/* ================= COMMISSIONS ================= */

Pages.commissions = {
  title: 'Komisi',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Menghitung komisi…</p></div>';
    const month = currentMonth();
    const rows = await svc('listCommissions', { month });
    const schemes = await svc('listSchemes');
    const canAdmin = ['Admin', 'Manager'].includes(ctx.user.role);
    const earned = rows.filter(r => ['Confirmed', 'Overridden'].includes(r.status)).reduce((a, r) => a + Number(r.nominal || 0), 0);
    const draft = rows.filter(r => r.status === 'Draft').reduce((a, r) => a + Number(r.nominal || 0), 0);
    const forecast = await svc('commissionForecast');

    box.innerHTML = `
      <div class="stat-cards">
        <div class="card stat-card"><div class="lbl">Komisi Terkumpul (${month})</div><div class="val" style="color:#34d399">${fmtRp(earned)}</div></div>
        <div class="card stat-card"><div class="lbl">Draft</div><div class="val">${fmtRp(draft)}</div></div>
        <div class="card stat-card"><div class="lbl">⚡ Forecast Pipeline</div><div class="val">${fmtRp(forecast.total)}</div><div class="sub">${forecast.count} deal aktif</div></div>
        <div class="card stat-card"><div class="lbl">Total Transaksi</div><div class="val">${rows.length}</div></div>
      </div>
      <div class="tabs">
        <div class="tab active" data-t="detail">Rincian Komisi</div>
        <div class="tab" data-t="scheme">Skema Komisi (${schemes.length})</div>
      </div>
      <div id="comm-detail">
        <div class="toolbar">
          <span class="grow"></span>
          <button class="btn btn-ghost" onclick="Pages.exportReport('commissions')">📥 Export Excel</button>
          ${canAdmin ? '<button class="btn btn-amber" onclick="Pages.runTrueUp()">🔁 Jalankan True-up</button>' : ''}
        </div>
        <div class="card table-wrap">
          ${rows.length ? `<table class="tbl"><thead><tr><th>Deal</th><th>Sales</th><th>Nilai Deal</th><th>%</th><th>Komisi</th><th>Status</th><th>Tanggal</th>${canAdmin ? '<th></th>' : ''}</tr></thead><tbody>
            ${rows.map(c => `<tr>
              <td><b>${esc(c.deal_name || '—')}</b></td><td>${esc(c.owner_name || '—')}</td>
              <td>${fmtRp(c.deal_value)}</td><td>${c.percent}%</td>
              <td><b>${fmtRp(c.nominal)}</b></td>
              <td><span class="badge ${c.status === 'Confirmed' ? 'badge-green' : c.status === 'Overridden' ? 'badge-amber' : 'badge-gray'}">${c.status}${c.reason_override ? ' · ' + esc(c.reason_override.slice(0, 20)) : ''}</span></td>
              <td class="muted">${fmtDate(c.created_at)}</td>
              ${canAdmin ? `<td><button class="mini-btn" onclick="Pages.overrideCommission(${c.id})">Override</button></td>` : ''}</tr>`).join('')}
          </tbody></table>` : `<div class="empty"><div class="ic">💵</div><p>Belum ada komisi bulan ini. Komisi muncul otomatis saat deal Won dikonfirmasi.</p></div>`}
        </div>
      </div>
      <div id="comm-scheme" class="hidden">
        ${canAdmin ? '<div class="toolbar"><span class="grow"></span><button class="btn btn-primary" onclick="Pages.schemeForm()">+ Skema Baru</button></div>' : ''}
        <div class="grid-3">
          ${schemes.map(s => {
            const params = JSON.parse(s.params || '{}');
            let desc = '';
            if (s.type === 'percent') desc = params.percent + '% dari nilai deal';
            else if (s.type === 'tier') desc = params.tiers ? params.tiers.map(t => (t[1] == null ? '>' + fmtRp(t[0]) : fmtRp(t[0]) + '–' + fmtRp(t[1])) + ': ' + t[2] + '%').join('; ') : '';
            else if (s.type === 'target') desc = 'Base ' + params.basePercent + '% → bonus ' + params.bonusPercent + '% jika target ≥100%';
            return `<div class="card"><div class="card-title">${s.active ? '✅' : '💤'} ${esc(s.name)} <span class="grow"></span><span class="badge ${s.active ? 'badge-green' : 'badge-gray'}">${s.active ? 'Aktif' : 'Nonaktif'}</span></div>
              <div class="muted small">Tipe: ${s.type} · Berlaku: ${fmtDate(s.effective_date)}</div>
              <div class="small mt">${esc(desc)}</div>
              ${canAdmin ? `<div class="mt"><button class="mini-btn" onclick="Pages.schemeForm(${s.id})">Edit</button></div>` : ''}
            </div>`;
          }).join('') || '<div class="empty"><p>Belum ada skema komisi.</p></div>'}
        </div>
      </div>`;

    $$('.tab', box).forEach(t => t.onclick = () => {
      $$('.tab', box).forEach(x => x.classList.toggle('active', x === t));
      $('#comm-detail').classList.toggle('hidden', t.dataset.t !== 'detail');
      $('#comm-scheme').classList.toggle('hidden', t.dataset.t !== 'scheme');
    });
  }
};

Pages.schemeForm = async (id) => {
  const schemes = await svc('listSchemes');
  let s = { name: '', type: 'percent', params: '{"percent":5}', active: false, effective_date: todayISO() };
  if (id) s = schemes.find(x => Number(x.id) === Number(id)) || s;
  const m = openModal(`
    <h3>${id ? 'Edit Skema Komisi' : '+ Skema Komisi'}</h3>
    <div class="grid-2">
      <label class="field">Nama Skema *<input class="input" id="s-name" value="${esc(s.name)}"></label>
      <label class="field">Tipe<select class="input" id="s-type">
        <option value="percent" ${s.type === 'percent' ? 'selected' : ''}>Persentase tetap</option>
        <option value="tier" ${s.type === 'tier' ? 'selected' : ''}>Tier (marginal)</option>
        <option value="target" ${s.type === 'target' ? 'selected' : ''}>Berbasis target</option>
      </select></label>
      <label class="field">Tanggal Efektif<input class="input" id="s-date" type="date" value="${s.effective_date}"></label>
      <label class="field">Aktif<select class="input" id="s-active"><option value="1" ${s.active ? 'selected' : ''}>Ya (jadi skema global)</option><option value="0" ${!s.active ? 'selected' : ''}>Tidak</option></select></label>
    </div>
    <label class="field">Parameter (JSON)<textarea class="input mono" id="s-params" style="min-height:110px">${esc(s.params)}</textarea></label>
    <div class="brand-banner">Format per tipe:<br><b>percent</b>: {"percent":5}<br><b>tier</b>: {"tiers":[[0,50000000,5],[50000000,null,7]]}<br><b>target</b>: {"basePercent":5,"bonusPercent":8}</div>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="s-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#s-save').onclick = async () => {
    let params;
    try { params = JSON.parse(m.$('#s-params').value); } catch (e) { toast('Parameter JSON tidak valid', e.message, 'error'); return; }
    const r = await tryCatch(() => id ? svc('updateScheme', id, {
      name: m.$('#s-name').value, type: m.$('#s-type').value, params: JSON.stringify(params),
      active: m.$('#s-active').value === '1', effective_date: m.$('#s-date').value
    }) : svc('createScheme', {
      name: m.$('#s-name').value, type: m.$('#s-type').value, params: JSON.stringify(params),
      active: m.$('#s-active').value === '1', effective_date: m.$('#s-date').value
    }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Skema tersimpan', '', 'success'); Pages.nav('commissions');
  };
};

Pages.overrideCommission = async (id) => {
  const rows = await svc('listCommissions', {});
  const c = rows.find(x => Number(x.id) === Number(id));
  if (!c) return;
  const m = openModal(`
    <h3>Override Komisi #${c.id}</h3>
    <p class="muted small mb">Deal: <b>${esc(c.deal_name)}</b> · Komisi saat ini: <b>${fmtRp(c.nominal)}</b></p>
    <label class="field">Nominal Baru (Rp)<input class="input" id="ov-val" type="number" value="${c.nominal}"></label>
    <label class="field">Alasan (WAJIB — tercatat di audit log)<textarea class="input" id="ov-reason" placeholder="cth: koreksi kesalahan input nilai deal"></textarea></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-danger" id="ov-save">Simpan Override</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#ov-save').onclick = async () => {
    const reason = m.$('#ov-reason').value.trim();
    if (!reason) { toast('Alasan wajib', 'Override komisi tanpa alasan diblokir.', 'warn'); return; }
    const r = await tryCatch(() => svc('overrideCommission', id, Number(m.$('#ov-val').value), reason));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Komisi di-override', 'Tercatat di audit log.', 'success'); Pages.nav('commissions');
  };
};

Pages.runTrueUp = async () => {
  const r = await tryCatch(() => svc('runTrueUp', currentMonth()));
  if (!r.ok) { toast('True-up gagal', r.error, 'error'); return; }
  toast('True-up selesai', r.data.added + ' komisi bonus ditambahkan untuk target tercapai.', 'success');
};

/* ================= TEAMS ================= */

Pages.teams = {
  title: 'Tim',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat tim…</p></div>';
    const users = await svc('listUsers');
    const teams = await svc('listTeams');
    const canAdmin = ctx.user.role === 'Admin';
    box.innerHTML = `
      ${canAdmin ? `<div class="toolbar"><span class="grow"></span><button class="btn btn-primary" onclick="Pages.teamForm()">+ Team Baru</button></div>` : ''}
      <div class="grid-3 mb">
        ${teams.map(t => `<div class="card">
          <div class="card-title">👥 ${esc(t.name)} <span class="grow"></span><span class="badge badge-blue">${t.member_count} anggota</span></div>
          <div class="muted small">Manager: ${esc(t.manager_name || '—')}</div>
          ${canAdmin ? `<div class="mt"><button class="mini-btn" onclick="Pages.teamForm(${t.id})">Edit</button></div>` : ''}
        </div>`).join('') || '<div class="card"><div class="empty"><p>Belum ada team.</p></div></div>'}
      </div>
      <div class="card table-wrap">
        <table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Team</th><th>Status</th><th>Login Terakhir</th></tr></thead><tbody>
          ${users.map(u => `<tr>
            <td><span class="avatar-mini">${initials(u.name)}</span><b>${esc(u.name)}</b></td>
            <td>${esc(u.username)}</td>
            <td><span class="badge ${u.role === 'Admin' ? 'badge-red' : u.role === 'Manager' ? 'badge-amber' : u.role === 'TeamLeader' ? 'badge-blue' : 'badge-gray'}">${u.role}</span></td>
            <td>${esc(u.team_name || '—')}</td>
            <td><span class="badge ${u.status === 'Active' ? 'badge-green' : 'badge-gray'}">${u.status}</span></td>
            <td class="muted">${fmtDateTime(u.last_login)}</td></tr>`).join('')}
        </tbody></table>
      </div>`;
  }
};

Pages.teamForm = async (id) => {
  const teams = await svc('listTeams');
  const users = (await svc('listUsers')).filter(u => u.status === 'Active');
  let t = { name: '', manager_id: '' };
  if (id) t = teams.find(x => Number(x.id) === Number(id)) || t;
  const m = openModal(`
    <h3>${id ? 'Edit Team' : '+ Team Baru'}</h3>
    <label class="field">Nama Team *<input class="input" id="tm-name" value="${esc(t.name)}"></label>
    <label class="field">Manager<select class="input" id="tm-manager"><option value="">— Tanpa manager —</option>${users.map(u => `<option value="${u.id}" ${String(t.manager_id) === String(u.id) ? 'selected' : ''}>${esc(u.name)} (${u.role})</option>`).join('')}</select></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="tm-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#tm-save').onclick = async () => {
    const r = await tryCatch(() => id ? svc('updateTeam', id, { name: m.$('#tm-name').value, manager_id: m.$('#tm-manager').value || null }) : svc('createTeam', { name: m.$('#tm-name').value, manager_id: m.$('#tm-manager').value || null }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Team tersimpan', '', 'success'); Pages.nav('teams');
  };
};

/* ================= REPORTS ================= */

Pages.reports = {
  title: 'Laporan',
  render: async (box, ctx) => {
    box.innerHTML = `
      <div class="stat-cards">
        <div class="card stat-card"><div class="lbl">Jenis Laporan</div><div class="val" style="font-size:16px">6 jenis export</div><div class="sub">Excel profesional + CSV</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-title">📇 Prospek & Kontak</div><div class="muted small mb">Semua prospek dengan estimasi nilai & pemilik.</div>
          <button class="btn btn-sm btn-primary" onclick="Pages.exportReport('prospects')">Export Excel</button>
          <button class="btn btn-sm btn-ghost" onclick="Pages.exportCsv('prospects')">Export CSV</button></div>
        <div class="card"><div class="card-title">💼 Pipeline & Deal</div><div class="muted small mb">Deal per tahapan, nilai, status, won/lost.</div>
          <button class="btn btn-sm btn-primary" onclick="Pages.exportReport('deals')">Export Excel</button></div>
        <div class="card"><div class="card-title">💵 Laporan Komisi</div><div class="muted small mb">Komisi per sales per deal (bulan berjalan).</div>
          <button class="btn btn-sm btn-primary" onclick="Pages.exportReport('commissions')">Export Excel</button></div>
        <div class="card"><div class="card-title">📈 Performa Tim</div><div class="muted small mb">Target, revenue, pencapaian, aktivitas, scorecard.</div>
          <button class="btn btn-sm btn-primary" onclick="Pages.exportReport('performance')">Export Excel</button></div>
        <div class="card"><div class="card-title">⏰ Follow-up</div><div class="muted small mb">Semua follow-up dengan status & pemilik.</div>
          <button class="btn btn-sm btn-primary" onclick="Pages.exportReport('followups')">Export Excel</button></div>
        <div class="card"><div class="card-title">🔐 Audit Log</div><div class="muted small mb">Riwayat aksi kritis (maks 5000 baris terakhir).</div>
          <button class="btn btn-sm btn-primary" onclick="Pages.exportReport('audit')">Export Excel</button></div>
      </div>
      <div class="brand-banner mt">📁 File tersimpan otomatis di folder <b>Documents</b> dengan format <b>SalesDeskPro_&lt;jenis&gt;_&lt;bulan&gt;.xlsx</b> — format profesional (header navy, formula jumlah, filter).</div>`;
  }
};

Pages.exportReport = async (type) => {
  const r = await tryCatch(() => svc('exportExcel', type, { month: currentMonth() }));
  if (!r.ok) { toast('Export gagal', r.error, 'error'); return; }
  toast('Export berhasil 📁', r.data.path, 'success');
  const open = await confirmDialog('Export selesai', 'File tersimpan di:<br><span class="mono small">' + esc(r.data.path) + '</span><br><br>Buka folder?', { yes: 'Buka Folder' });
  if (open) window.sdp.openPath(r.data.path);
};

Pages.exportCsv = async (type) => {
  const r = await tryCatch(() => svc('exportCsv', type));
  if (!r.ok) { toast('Export gagal', r.error, 'error'); return; }
  const blob = new Blob([r.data.data], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = r.data.filename;
  a.click();
  toast('CSV diunduh', r.data.filename, 'success');
};

/* ================= SETTINGS / ADMIN ================= */

Pages.settings = {
  title: 'Pengaturan',
  render: async (box, ctx) => {
    if (!['Admin', 'Manager'].includes(ctx.user.role)) {
      box.innerHTML = `<div class="empty"><div class="ic">⛔</div><p>Halaman ini hanya untuk Admin & Manager.</p></div>`;
      return;
    }
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat pengaturan…</p></div>';
    const settings = await svc('getSettings');
    const users = await svc('listUsers');
    const teams = await svc('listTeams');
    const products = await svc('listProducts');
    const schemes = await svc('listSchemes');
    const sources = await svc('listSources');
    const templates = await svc('listTemplates');
    const stages = await svc('getStages');
    const backups = await svc('listBackups');
    const canAdmin = ctx.user.role === 'Admin';

    const tabs = [
      ['company', '🏢 Perusahaan'],
      ['users', '👥 User & Tim'],
      ['master', '📦 Data Master'],
      ['backup', '💾 Backup & Restore'],
      ['security', '🔐 Keamanan']
    ];

    const tabContent = (t) => {
      if (t === 'company') return `
        <div class="card" style="max-width:520px">
          <h3 style="margin-bottom:14px">Profil Perusahaan</h3>
          <label class="field">Nama Perusahaan<input class="input" id="set-company" value="${esc(settings.company_name || '')}"></label>
          <label class="field">Pemegang Lisensi<input class="input" id="set-holder" value="${esc(settings.license_holder || '')}"></label>
          <label class="field">Format Uang<select class="input" id="set-currency"><option ${settings.currency === 'Rp' ? 'selected' : ''}>Rp</option><option ${settings.currency === '$' ? 'selected' : ''}>$</option><option ${settings.currency === 'RM' ? 'selected' : ''}>RM</option></select></label>
          <label class="field">Format Tanggal<select class="input" id="set-datefmt"><option ${settings.date_format === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option><option ${settings.date_format === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option></select></label>
          <button class="btn btn-primary" onclick="Pages.saveSettings()">Simpan</button>
        </div>`;
      if (t === 'users') return `
        ${canAdmin ? `<div class="toolbar"><span class="grow"></span><button class="btn btn-primary" onclick="Pages.userForm()">+ User Baru</button><button class="btn btn-ghost" onclick="Pages.teamForm()">+ Team</button></div>` : ''}
        <div class="card table-wrap">
          <table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Team</th><th>Status</th><th></th></tr></thead><tbody>
          ${users.map(u => `<tr>
            <td><span class="avatar-mini">${initials(u.name)}</span><b>${esc(u.name)}</b></td>
            <td>${esc(u.username)}</td>
            <td><span class="badge ${u.role === 'Admin' ? 'badge-red' : u.role === 'Manager' ? 'badge-amber' : u.role === 'TeamLeader' ? 'badge-blue' : 'badge-gray'}">${u.role}</span></td>
            <td>${esc(u.team_name || '—')}</td>
            <td><span class="badge ${u.status === 'Active' ? 'badge-green' : 'badge-gray'}">${u.status}</span></td>
            <td><div class="row-actions">
              <button class="mini-btn" onclick="Pages.userForm(${u.id})">Edit</button>
              <button class="mini-btn" onclick="Pages.resetPw(${u.id})">Reset PW</button>
            </div></td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="card mt"><div class="card-title">👥 Teams</div>
          ${teams.map(t => `<div class="w-item"><div class="grow"><div class="t1">${esc(t.name)}</div><div class="t2">Manager: ${esc(t.manager_name || '—')} · ${t.member_count} anggota</div></div><button class="mini-btn" onclick="Pages.teamForm(${t.id})">Edit</button></div>`).join('') || '<div class="muted small">Belum ada team.</div>'}
        </div>`;
      if (t === 'master') return `
        <div class="grid-2">
          <div class="card"><div class="card-title">📦 Produk</div>
            ${products.map(p => `<div class="w-item"><div class="grow"><div class="t1">${esc(p.name)}</div><div class="t2">${fmtRp(p.price)}${p.active ? '' : ' · nonaktif'}</div></div><button class="mini-btn" onclick="Pages.productForm(${p.id})">Edit</button></div>`).join('') || '<div class="muted small mb">Belum ada produk.</div>'}
            <button class="btn btn-sm btn-primary mt" onclick="Pages.productForm()">+ Produk</button></div>
          <div class="card"><div class="card-title">🗂️ Sumber Prospek</div>
            <div class="row-flex" style="flex-wrap:wrap">${sources.map(s => `<span class="badge badge-gray" style="font-size:11px">${esc(s.name)}</span>`).join(' ')}</div>
            <div class="row-flex mt"><input class="input" id="new-source" placeholder="Sumber baru…"><button class="btn btn-sm btn-primary" onclick="Pages.addSource()">+</button></div></div>
          <div class="card"><div class="card-title">🔄 Tahapan Pipeline</div>
            <div class="row-flex" style="flex-wrap:wrap">${stages.map(s => `<span class="badge badge-blue" style="font-size:11px">${esc(s.name)}</span>`).join(' ')}</div>
            <button class="btn btn-sm btn-ghost mt" onclick="Pages.stagesForm()">Edit Tahapan</button></div>
          <div class="card"><div class="card-title">💬 Template Follow-up</div>
            ${templates.map(tp => `<div class="w-item"><div class="grow"><div class="t1">${esc(tp.name)}</div></div></div>`).join('')}
            <button class="btn btn-sm btn-primary mt" onclick="Pages.templateForm()">+ Template</button></div>
        </div>`;
      if (t === 'backup') return `
        <div class="grid-2">
          <div class="card">
            <div class="card-title">💾 Backup</div>
            <p class="muted small mb">Database terenkripsi AES-256-GCM. Backup otomatis harian pukul <b>${esc(settings.backup_hour || '22')}:00</b> (rolling 7).</p>
            <div class="row-flex">
              <button class="btn btn-primary" onclick="Pages.doBackup()">Backup Sekarang</button>
              <label class="row-flex small"><input type="checkbox" id="bak-auto" ${settings.backup_enabled === '1' ? 'checked' : ''}> Backup otomatis</label>
            </div>
            <div class="mt muted small">Lokasi: <span class="mono">${esc(AppState.boot.dataDir + '\\backups')}</span></div>
          </div>
          <div class="card">
            <div class="card-title">🔄 Restore</div>
            <p class="muted small mb">Pilih file backup .bak untuk dikembalikan. Data saat ini akan DITIMPA.</p>
            <div class="m-foot" style="margin-top:0">
              <button class="btn btn-amber" onclick="Pages.restoreForm()">Pilih Backup & Restore</button>
              <button class="btn btn-ghost" onclick="Pages.integrityCheck()">🔍 Cek Integritas DB</button>
            </div>
          </div>
        </div>
        <div class="card mt"><div class="card-title">Riwayat Backup</div>
          <table class="tbl"><thead><tr><th>Tanggal</th><th>Tipe</th><th>Status</th><th>Ukuran</th><th>Path</th></tr></thead><tbody>
          ${backups.map(b => `<tr><td>${fmtDateTime(b.date)}</td><td><span class="badge ${b.type === 'auto' ? 'badge-blue' : 'badge-green'}">${b.type}</span></td><td><span class="badge ${b.status === 'success' ? 'badge-green' : 'badge-red'}">${b.status}</span></td><td>${b.size ? Math.round(b.size / 1024) + ' KB' : '—'}</td><td class="muted small">${esc(b.path || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Belum ada backup.</td></tr>'}
          </tbody></table></div>`;
      if (t === 'security') return `
        <div class="grid-2">
          <div class="card">
            <div class="card-title">🔐 Kebijakan Keamanan</div>
            <label class="field">Min. Panjang Password<input class="input" id="sec-minpw" type="number" value="${esc(settings.min_password_len || '8')}"></label>
            <label class="field">Auto-lock (menit idle)<input class="input" id="sec-lock" type="number" value="${esc(settings.auto_lock_min || '10')}"></label>
            <label class="field">Percobaan Login Gagal (lockout)<input class="input" id="sec-attempts" type="number" value="${esc(settings.lockout_attempts || '5')}"></label>
            <label class="field">Notifikasi Desktop<select class="input" id="sec-notif"><option value="1" ${settings.notification_enabled === '1' ? 'selected' : ''}>Aktif</option><option value="0" ${settings.notification_enabled !== '1' ? 'selected' : ''}>Nonaktif</option></select></label>
            <button class="btn btn-primary" onclick="Pages.saveSecurity()">Simpan Kebijakan</button>
          </div>
          <div class="card">
            <div class="card-title">🛡️ Proteksi Aplikasi</div>
            <div class="small" style="line-height:2">
              ✅ Enkripsi database <b>AES-256-GCM</b><br>
              ✅ Password <b>PBKDF2-SHA256</b> 100.000 iterasi<br>
              ✅ Lisensi terikat <b>fingerprint mesin</b><br>
              ✅ Integrity check <b>anti-modifikasi</b><br>
              ✅ Audit log <b>append-only</b><br>
              ✅ Role & permission <b>4 level</b><br>
            </div>
            <div class="brand-banner mt">© 2026 VeryCoolApps (PT. Agra Karya Digital). WA: 081519250845 · t.me/VeryCoolApps</div>
          </div>
        </div>`;
      return '';
    };

    box.innerHTML = `
      <div class="tabs">${tabs.map((t, i) => `<div class="tab ${i === 0 ? 'active' : ''}" data-t="${t[0]}">${t[1]}</div>`).join('')}</div>
      <div id="settings-body">${tabContent('company')}</div>`;
    $$('.tab', box).forEach(t => t.onclick = () => {
      $$('.tab', box).forEach(x => x.classList.toggle('active', x === t));
      $('#settings-body').innerHTML = tabContent(t.dataset.t);
    });
  }
};

Pages.userForm = async (id) => {
  const users = await svc('listUsers');
  const teams = await svc('listTeams');
  let u = { username: '', name: '', role: 'Sales', team_id: '', status: 'Active', password: '' };
  if (id) u = users.find(x => Number(x.id) === Number(id)) || u;
  const m = openModal(`
    <h3>${id ? 'Edit User' : '+ User Baru'}</h3>
    <div class="grid-2">
      <label class="field">Nama Lengkap *<input class="input" id="u-name" value="${esc(u.name)}"></label>
      <label class="field">Username *<input class="input" id="u-username" value="${esc(u.username)}"></label>
      <label class="field">Role *<select class="input" id="u-role">
        <option value="Sales" ${u.role === 'Sales' ? 'selected' : ''}>Sales</option>
        <option value="TeamLeader" ${u.role === 'TeamLeader' ? 'selected' : ''}>Team Leader</option>
        <option value="Manager" ${u.role === 'Manager' ? 'selected' : ''}>Manager</option>
        <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
      </select></label>
      <label class="field">Team<select class="input" id="u-team"><option value="">— Tanpa team —</option>${teams.map(t => `<option value="${t.id}" ${String(u.team_id) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <label class="field">Status<select class="input" id="u-status"><option value="Active" ${u.status === 'Active' ? 'selected' : ''}>Active</option><option value="Inactive" ${u.status === 'Inactive' ? 'selected' : ''}>Inactive</option></select></label>
      ${!id ? `<label class="field">Password Awal *<input class="input" id="u-pw" type="password" placeholder="Min 8 karakter"></label>` : ''}
    </div>
    ${id ? '<p class="muted small">Reset password via tombol khusus.</p>' : ''}
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="u-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#u-save').onclick = async () => {
    const payload = {
      name: m.$('#u-name').value, username: m.$('#u-username').value, role: m.$('#u-role').value,
      team_id: m.$('#u-team').value || null, status: m.$('#u-status').value
    };
    let r;
    if (id) r = await tryCatch(() => svc('updateUser', id, payload));
    else r = await tryCatch(() => svc('createUser', Object.assign(payload, { password: m.$('#u-pw').value, must_change: true })));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('User tersimpan', '', 'success'); Pages.nav('settings');
  };
};

Pages.resetPw = async (id) => {
  const m = openModal(`
    <h3>Reset Password</h3>
    <label class="field">Password Sementara Baru<input class="input" id="rp-pw" type="text" value="${Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 4)}"></label>
    <p class="muted small">User wajib mengganti password saat login pertama berikutnya.</p>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="rp-save">Reset</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#rp-save').onclick = async () => {
    const r = await tryCatch(() => svc('resetPassword', id, m.$('#rp-pw').value));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Password di-reset', 'User wajib ganti saat login.', 'success');
  };
};

Pages.productForm = async (id) => {
  const products = await svc('listProducts');
  let p = { name: '', price: 0, active: true };
  if (id) p = products.find(x => Number(x.id) === Number(id)) || p;
  const m = openModal(`
    <h3>${id ? 'Edit Produk' : '+ Produk'}</h3>
    <label class="field">Nama Produk *<input class="input" id="pr-name" value="${esc(p.name)}"></label>
    <label class="field">Harga (Rp)<input class="input" id="pr-price" type="number" value="${p.price || 0}"></label>
    <label class="field">Aktif<select class="input" id="pr-active"><option value="1" ${p.active ? 'selected' : ''}>Ya</option><option value="0" ${!p.active ? 'selected' : ''}>Tidak</option></select></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="pr-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#pr-save').onclick = async () => {
    const r = await tryCatch(() => id ? svc('updateProduct', id, { name: m.$('#pr-name').value, price: m.$('#pr-price').value, active: m.$('#pr-active').value === '1' }) : svc('addProduct', { name: m.$('#pr-name').value, price: m.$('#pr-price').value, active: m.$('#pr-active').value === '1' }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Produk tersimpan', '', 'success'); Pages.nav('settings');
  };
};

Pages.addSource = async () => {
  const name = $('#new-source').value.trim();
  if (!name) return;
  const r = await tryCatch(() => svc('addSource', name));
  toast(r.ok ? 'Sumber ditambahkan' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
  Pages.nav('settings');
};

Pages.stagesForm = async () => {
  const stages = await svc('getStages');
  const m = openModal(`
    <h3>Edit Tahapan Pipeline</h3>
    <p class="muted small mb">Satu nama per baris, urutan sesuai posisi.</p>
    <textarea class="input" id="st-list" style="min-height:120px">${stages.map(s => esc(s.name)).join('\n')}</textarea>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="st-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#st-save').onclick = async () => {
    const names = m.$('#st-list').value.split('\n').map(s => s.trim()).filter(Boolean);
    const r = await tryCatch(() => svc('saveStages', names));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Tahapan diperbarui', '', 'success'); Pages.nav('settings');
  };
};

Pages.templateForm = async () => {
  const m = openModal(`
    <h3>+ Template Follow-up</h3>
    <label class="field">Nama<select class="input" id="tp-name"><option>Follow-up Prospek</option><option>Follow-up Penawaran</option><option>Follow-up Deal</option><option>Custom</option></select></label>
    <label class="field">Isi Template<input class="input" id="tp-body" placeholder="Halo {nama}, …"></label>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="tp-save">Simpan</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#tp-save').onclick = async () => {
    const r = await tryCatch(() => svc('addTemplate', { name: m.$('#tp-name').value, template: m.$('#tp-body').value }));
    if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
    m.close(); toast('Template tersimpan', '', 'success'); Pages.nav('settings');
  };
};

Pages.doBackup = async () => {
  const r = await tryCatch(() => svc('doBackup', null, 'manual'));
  if (!r.ok) { toast('Backup gagal', r.error, 'error'); return; }
  toast('Backup berhasil 💾', r.data.path, 'success');
  Pages.nav('settings');
};

Pages.restoreForm = async () => {
  const backups = await svc('listBackups');
  const ok = backups.filter(b => b.status === 'success');
  if (!ok.length) { toast('Tidak ada backup', 'Belum ada backup yang berhasil.', 'warn'); return; }
  const m = openModal(`
    <h3>Restore dari Backup</h3>
    <p class="muted small mb">⚠️ Data saat ini akan DITIMPA oleh data backup.</p>
    <select class="input" id="rs-file">${ok.map(b => `<option value="${esc(b.path)}">${fmtDateTime(b.date)} · ${b.type} · ${b.size ? Math.round(b.size / 1024) + ' KB' : ''}</option>`).join('')}</select>
    <div class="m-foot"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-amber" id="rs-go">Restore Sekarang</button></div>`);
  m.$('[data-close]').onclick = m.close;
  m.$('#rs-go').onclick = async () => {
    const path2 = m.$('#rs-file').value;
    m.close();
    const ok2 = await confirmDialog('Konfirmasi Ganda', 'Anda yakin ingin <b>me-restore</b> database dari backup ini? Semua perubahan setelah backup akan hilang.', { danger: true, yes: 'Ya, Restore' });
    if (!ok2) return;
    const r = await tryCatch(() => svc('doRestore', path2));
    if (!r.ok) { toast('Restore gagal', r.error, 'error'); return; }
    toast('Restore berhasil', 'Data dikembalikan. Integrity check: OK', 'success');
    location.reload();
  };
};

Pages.integrityCheck = async () => {
  const r = await tryCatch(() => svc('adminOverview'));
  if (!r.ok) { toast('Gagal', r.error, 'error'); return; }
  const db = r.data.db;
  const counts = db.counts || {};
  const m = openModal(`
    <h3>🔍 Integrity Check</h3>
    <p>Status: <b style="color:${db.status === 'ok' ? 'var(--green)' : 'var(--red)'}">${esc(db.status)}</b></p>
    <table class="tbl mt"><tbody>
      ${Object.keys(counts).map(k => `<tr><td>${esc(k)}</td><td><b>${counts[k]}</b> record</td></tr>`).join('')}
      <tr><td>Ukuran file DB</td><td>${db.size ? Math.round(db.size / 1024) + ' KB' : '—'}</td></tr>
    </tbody></table>
    <div class="m-foot"><button class="btn btn-primary" data-close>Tutup</button></div>`);
  m.$('[data-close]').onclick = m.close;
};

Pages.saveSettings = async () => {
  const r = await tryCatch(() => svc('saveSettings', {
    company_name: $('#set-company').value, license_holder: $('#set-holder').value,
    currency: $('#set-currency').value, date_format: $('#set-datefmt').value
  }));
  toast(r.ok ? 'Pengaturan tersimpan' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
};

Pages.saveSecurity = async () => {
  const r = await tryCatch(() => svc('saveSettings', {
    min_password_len: $('#sec-minpw').value, auto_lock_min: $('#sec-lock').value,
    lockout_attempts: $('#sec-attempts').value, notification_enabled: $('#sec-notif').value,
    backup_enabled: $('#bak-auto') ? ($('#bak-auto').checked ? '1' : '0') : undefined
  }));
  toast(r.ok ? 'Kebijakan keamanan tersimpan' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
};

/* ================= AUDIT LOG ================= */

Pages.audit = {
  title: 'Audit Log',
  render: async (box, ctx) => {
    if (!['Admin', 'Manager'].includes(ctx.user.role)) {
      box.innerHTML = `<div class="empty"><div class="ic">⛔</div><p>Hanya Admin & Manager.</p></div>`;
      return;
    }
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat audit log…</p></div>';
    const actions = await svc('listAuditActions');
    const rows = await svc('listAudit', {});
    box.innerHTML = `
      <div class="toolbar">
        <select class="input" id="aud-action" style="width:200px"><option value="">Semua aksi</option>${actions.map(a => `<option>${esc(a.action)}</option>`).join('')}</select>
        <div class="global-search" style="width:220px"><input class="input" id="aud-search" placeholder="Cari user / detail…"></div>
        <span class="grow"></span>
        <button class="btn btn-ghost" onclick="Pages.exportReport('audit')">📥 Export Excel</button>
      </div>
      <div class="card table-wrap">
        <table class="tbl"><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td class="muted">${fmtDateTime(r.timestamp)}</td><td><b>${esc(r.username)}</b></td>
            <td><span class="badge badge-blue">${esc(r.action)}</span></td>
            <td class="muted">${esc(r.entity || '')}${r.entity_id ? '#' + r.entity_id : ''}</td>
            <td class="small muted">${esc((r.detail || '').slice(0, 90))}</td></tr>`).join('')}
        </tbody></table>
      </div>`;
    $('#aud-action').addEventListener('change', async () => {
      const r = await svc('listAudit', { action: $('#aud-action').value });
      Pages.audit.render(box, ctx).catch(() => {});
      setTimeout(() => { const sel = $('#aud-action'); if (sel) sel.value = document.querySelector('#aud-action').value; }, 10);
    });
    $('#aud-search').addEventListener('input', debounce(async () => {
      const r = await svc('listAudit', { search: $('#aud-search').value });
      Pages.audit.render(box, ctx).catch(() => {});
    }, 400));
  }
};

/* ================= RECYCLE BIN ================= */

Pages.recycle = {
  title: 'Recycle Bin',
  render: async (box, ctx) => {
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat recycle bin…</p></div>';
    const data = await svc('recycleBin');
    const canAdmin = ctx.user.role === 'Admin';
    box.innerHTML = `
      <div class="card table-wrap">
        ${data.items.length ? `<table class="tbl"><thead><tr><th>Jenis</th><th>Nama</th><th>Dihapus</th>${canAdmin ? '<th></th>' : ''}</tr></thead><tbody>
          ${data.items.map(it => `<tr>
            <td><span class="badge ${it.type === 'deal' ? 'badge-red' : it.type === 'prospect' ? 'badge-blue' : 'badge-gray'}">${it.type}</span></td>
            <td><b>${esc(it.name)}</b></td><td class="muted">${fmtDateTime(it.deleted_at)}</td>
            <td><div class="row-actions">
              <button class="mini-btn" onclick="Pages.restoreItem('${it.type}', ${it.id})">↩️ Pulihkan</button>
              ${canAdmin ? `<button class="mini-btn danger" onclick="Pages.purgeItem('${it.type}', ${it.id})">🗑 Hapus Permanen</button>` : ''}
            </div></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="ic">🗑️</div><p>Recycle Bin kosong. Data yang dihapus (soft delete) muncul di sini selama 30 hari.</p></div>`}
      </div>`;
  }
};

Pages.restoreItem = async (type, id) => {
  const r = await tryCatch(() => svc('restoreItem', type, id));
  toast(r.ok ? 'Data dipulihkan' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
  Pages.nav('recycle');
};

Pages.purgeItem = async (type, id) => {
  const reason = await reasonDialog('Hapus Permanen', 'Data akan dihapus SELAMANYA dan tidak bisa dipulihkan.', { danger: true, yes: 'Hapus Permanen' });
  if (!reason) return;
  const r = await tryCatch(() => svc('purgeItem', type, id, reason));
  toast(r.ok ? 'Dihapus permanen' : 'Gagal', r.ok ? '' : r.error, r.ok ? 'success' : 'error');
  Pages.nav('recycle');
};

/* ================= ADMIN OVERVIEW ================= */

Pages.admin = {
  title: 'Admin Center',
  render: async (box, ctx) => {
    if (ctx.user.role !== 'Admin') {
      box.innerHTML = `<div class="empty"><div class="ic">⛔</div><p>Hanya Admin.</p></div>`;
      return;
    }
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Memuat admin center…</p></div>';
    const d = await svc('adminOverview');
    box.innerHTML = `
      <div class="stat-cards">
        <div class="card stat-card"><div class="lbl">User Aktif</div><div class="val">${d.active_users}<span class="muted" style="font-size:12px"> / ${d.users}</span></div></div>
        <div class="card stat-card"><div class="lbl">Prospek</div><div class="val">${d.prospects}</div></div>
        <div class="card stat-card"><div class="lbl">Deal Open</div><div class="val">${d.deals_open}</div></div>
        <div class="card stat-card"><div class="lbl">Revenue Bulan Ini</div><div class="val" style="font-size:17px">${fmtRp(d.revenue_month)}</div></div>
      </div>
      <div class="grid-2 mb">
        <div class="card"><div class="card-title">📈 Tren Revenue (12 bulan)</div><div class="chart-box">${lineChart(d.trend_revenue.map((v, i) => ({ label: String(11 - i), value: v })), { height: 150, fmt: (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'jt' : v })}</div></div>
        <div class="card"><div class="card-title">🗂️ Distribusi Role</div>
          ${d.by_role.map(r => `<div class="w-item"><div class="grow"><div class="t1">${esc(r.role)}</div></div><span class="badge badge-blue">${r.c} user</span></div>`).join('') || '<div class="muted small">Belum ada user.</div>'}
          <div class="mt"><div class="muted small">Backup terakhir: ${d.last_backup ? fmtDateTime(d.last_backup.date) + ' · ' + d.last_backup.status : 'belum ada'} · Status DB: <b>${esc(d.db.status)}</b></div></div>
        </div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" onclick="Pages.userForm()">+ User</button>
        <button class="btn btn-ghost" onclick="Pages.doBackup()">💾 Backup Sekarang</button>
        <button class="btn btn-ghost" onclick="Pages.exportReport('performance')">📥 Export Laporan</button>
      </div>`;
  }
};

/* ================= ABOUT / AKTIVASI ================= */

Pages.about = {
  title: 'Tentang',
  render: async (box, ctx) => {
    const boot = AppState.boot;
    const lic = await window.sdp.licenseStatus();
    box.innerHTML = `
      <div class="grid-2">
        <div class="card" style="text-align:center;padding:34px">
          <div style="font-size:52px">📈</div>
          <h2 style="font-size:24px;margin:8px 0">SalesDesk <span class="grad-text">Pro</span></h2>
          <div class="muted">Personal Sales Desk untuk Tim</div>
          <div class="muted small">Versi ${boot.version} · ${boot.app}</div>
          <div class="brand-banner mt">© 2026 <b>VeryCoolApps (PT. Agra Karya Digital)</b><br>
            WA: +62 815-1925-0845 · Telegram: t.me/VeryCoolApps<br>
            <span class="small">PROPRIETARY — All Rights Reserved · UU No. 28/2014</span></div>
          <div class="mt small muted">Lisensi: ${lic && lic.state === 'valid' ? '✅ Valid (terikat mesin ini)' : lic && lic.state === 'pending' ? '⚠️ Belum diaktivasi' : '❌ Tidak valid untuk mesin ini'}</div>
          <div class="mono small muted mt">Fingerprint: ${boot.fingerprintLabel}</div>
        </div>
        <div class="card">
          <div class="card-title">⚡ Fitur Utama</div>
          <div class="w-item"><div class="grow"><div class="t1">19 Widget Dashboard</div><div class="t2">Prioritas, meeting, follow-up, revenue, target, komisi, scorecard</div></div></div>
          <div class="w-item"><div class="grow"><div class="t1">CRM Pipeline End-to-End</div><div class="t2">Prospek → Kualifikasi → Penawaran → Deal → Komisi</div></div></div>
          <div class="w-item"><div class="grow"><div class="t1">Mesin Komisi Otomatis</div><div class="t2">Persentase, tier, target-based + true-up + override ber-audit</div></div></div>
          <div class="w-item"><div class="grow"><div class="t1">100% Offline & Gratis</div><div class="t2">Data lokal terenkripsi AES-256-GCM · tanpa biaya bulanan</div></div></div>
          <div class="w-item"><div class="grow"><div class="t1">Laporan Excel 1 Klik</div><div class="t2">Prospek, deal, komisi, performa tim — format profesional</div></div></div>
          <div class="w-item"><div class="grow"><div class="t1">Keamanan Enterprise</div><div class="t2">PBKDF2 · audit log append-only · role-based access · backup otomatis</div></div></div>
        </div>
      </div>`;
  }
};

/* ================= QUICK ACTIONS & NAV ================= */

Pages.quickProspect = () => Pages.prospectForm();
Pages.quickFollowup = (prospectId) => Pages.followupForm(prospectId);
Pages.quickMeeting = () => Pages.meetingForm();
Pages.quickDeal = () => Pages.dealForm();
Pages.nav = (page) => { if (AppState && AppState.navigate) AppState.navigate(page); };
