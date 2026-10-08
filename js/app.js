/* ============================================================
   Tracker Belajar v5 — CRUD · Sort · Filter · Chart · Timer
   + Priority · Notes · Duplicate · Bulk · Shortcuts
   Service Worker DISABLED
   ============================================================ */

(() => {
    'use strict';

    const STATUS = {
        selesai:  { label: '✅ Kelar',          cls: 'success', color: '#34d399' },
        progress: { label: '🔥 Lagi dikerjain', cls: 'warn',    color: '#fbbf24' },
        pending:  { label: '💀 Ntar aja',       cls: 'muted',   color: '#64748b' },
    };

    const PRIORITY = {
        high: { label: 'Tinggi', icon: '🔴', cls: 'high', color: '#f87171' },
        med:  { label: 'Sedang', icon: '🟡', cls: 'med',  color: '#fbbf24' },
        low:  { label: 'Rendah', icon: '🔵', cls: 'low',  color: '#60a5fa' },
    };

    const THEME_KEY = 'tracker:theme';
    const TIMER_KEY = 'tracker:timer';
    const URGENT_DAYS = 3;

    const $  = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const uid = () => Math.random().toString(36).slice(2, 10);

    const fmtDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

    const daysUntil = (iso) => {
        if (!iso) return Infinity;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return Infinity;
        const now = new Date(); now.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
        return Math.round((d - now) / 86400000);
    };

    const fmtDuration = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
    };

    const PAGES = {
        utbk: {
            key: 'tracker:utbk:v5',
            tableSel: '#utbk-table',
            statsSel: '#stats',
            title: 'Materi UTBK',
            searchFields: ['materi', 'tutor', 'modul', 'latihan', 'tags', 'notes'],
            hasDurasi: true,
            columns: [
                { key: 'materi',   label: 'Materi',   cell: 'materi', sortable: true },
                { key: 'priority', label: 'Prioritas', cell: 'priority', sortable: true },
                { key: 'tags',     label: 'Tags',     cell: 'tags',   sortable: false },
                { key: 'tanggal',  label: 'Tanggal',  cell: 'date',   sortable: true },
                { key: 'tutor',    label: 'Tutor',    sortable: true },
                { key: 'modul',    label: 'Modul',    sortable: true },
                { key: 'video',    label: 'Video',    cell: 'link',   sortable: false },
                { key: 'durasi',   label: 'Durasi',   cell: 'durasi', sortable: true },
                { key: 'skor',     label: 'Skor',     sortable: true },
                { key: 'status',   label: 'Status',   cell: 'status', sortable: true },
            ],
            formFields: [
                { key: 'materi',   label: 'Materi',       type: 'text',     required: true, full: true },
                { key: 'priority', label: 'Prioritas',    type: 'select',   options: [
                    { value: 'low',  label: '🔵 Rendah' },
                    { value: 'med',  label: '🟡 Sedang' },
                    { value: 'high', label: '🔴 Tinggi' },
                ], default: 'med' },
                { key: 'tanggal',  label: 'Tanggal',      type: 'date' },
                { key: 'tags',     label: 'Tags',         type: 'text',     full: true,
                  placeholder: 'aljabar, geometri, logika (pisah pakai koma)' },
                { key: 'tutor',    label: 'Tutor',        type: 'text' },
                { key: 'modul',    label: 'Modul',        type: 'text' },
                { key: 'video',    label: 'Link Video',   type: 'url',      full: true, placeholder: 'https://youtu.be/...' },
                { key: 'latihan',  label: 'Latihan',      type: 'text' },
                { key: 'durasi',   label: 'Durasi (jam)', type: 'number',   step: '0.5', min: '0' },
                { key: 'skor',     label: 'Skor',         type: 'number',   min: '0' },
                { key: 'status',   label: 'Status',       type: 'select',   full: true, options: [
                    { value: 'pending',  label: '💀 Ntar aja' },
                    { value: 'progress', label: '🔥 Lagi dikerjain' },
                    { value: 'selesai',  label: '✅ Kelar' },
                ], default: 'pending' },
                { key: 'notes',    label: 'Catatan',      type: 'textarea', full: true,
                  placeholder: 'Rumus penting, PR, kesulitan, dst...' },
            ],
            seed: [
                { materi: 'NgejarSNBT-P01', tags: ['aljabar'], priority: 'high',
                  tanggal: '2026-10-07', tutor: 'Jerome & Billy',
                  video: 'https://youtu.be/MTq084lkLxo?si=QuShExB4CA-Hv3eI',
                  durasi: 2, status: 'selesai',
                  notes: 'Bab aljabar dasar, udah paham.' },
                { materi: 'NgejarSNBT-P02', tags: ['geometri'], priority: 'high',
                  durasi: 3, status: 'progress' },
                ...Array.from({ length: 10 }, (_, i) => ({
                    materi: `NgejarSNBT-P${String(i + 3).padStart(2, '0')}`,
                    tags: [], priority: 'med', durasi: 0, status: 'pending',
                })),
            ],
        },
        tugas: {
            key: 'tracker:tugas:v5',
            tableSel: '#tugas-table',
            statsSel: '#stats',
            title: 'Tugas Kuliah',
            searchFields: ['matkul', 'dosen', 'modul', 'tags', 'notes'],
            hasDurasi: false,
            columns: [
                { key: 'matkul',   label: 'Mata Kuliah', cell: 'materi',   sortable: true },
                { key: 'priority', label: 'Prioritas',   cell: 'priority', sortable: true },
                { key: 'tags',     label: 'Tags',        cell: 'tags',     sortable: false },
                { key: 'dosen',    label: 'Dosen',       sortable: true },
                { key: 'modul',    label: 'Modul Tugas', sortable: true },
                { key: 'deadline', label: 'Deadline',    cell: 'date',     sortable: true },
                { key: 'status',   label: 'Status',      cell: 'status',   sortable: true },
                { key: 'nilai',    label: 'Nilai',       sortable: true },
            ],
            formFields: [
                { key: 'matkul',   label: 'Mata Kuliah', type: 'text',     required: true, full: true },
                { key: 'priority', label: 'Prioritas',   type: 'select',   options: [
                    { value: 'low',  label: '🔵 Rendah' },
                    { value: 'med',  label: '🟡 Sedang' },
                    { value: 'high', label: '🔴 Tinggi' },
                ], default: 'med' },
                { key: 'deadline', label: 'Deadline',    type: 'date' },
                { key: 'tags',     label: 'Tags',        type: 'text',     full: true,
                  placeholder: 'uts, praktikum, kelompok (pisah pakai koma)' },
                { key: 'dosen',    label: 'Dosen',       type: 'text' },
                { key: 'modul',    label: 'Modul Tugas', type: 'text' },
                { key: 'nilai',    label: 'Nilai',       type: 'number',   step: '0.1', min: '0' },
                { key: 'status',   label: 'Status',      type: 'select',   full: true, options: [
                    { value: 'pending',  label: '💀 Ntar aja' },
                    { value: 'progress', label: '🔥 Lagi dikerjain' },
                    { value: 'selesai',  label: '✅ Kelar' },
                ], default: 'pending' },
                { key: 'notes',    label: 'Catatan',     type: 'textarea', full: true,
                  placeholder: 'Detail tugas, kelompok, link referensi...' },
            ],
            seed: Array.from({ length: 8 }, (_, i) => ({
                matkul: 'Nama Mata Kuliah',
                tags: i % 3 === 0 ? ['uts'] : [],
                priority: i < 2 ? 'high' : 'med',
                dosen: 'Nama Dosen',
                modul: `Tugas ${i + 1} - Modul ${i + 1}`,
                deadline: i < 3 ? new Date(2026, 9, 10 + i * 7).toISOString().slice(0, 10) : '',
                status: i === 0 ? 'selesai' : i === 1 ? 'progress' : 'pending',
            })),
        },
    };

    const pageKey = document.body.dataset.page;
    const CFG = PAGES[pageKey];
    if (!CFG) return;

    let state = loadState();
    let sortKey = null;
    let sortDir = 'asc';
    let query = '';
    let filterStatus = 'all';
    let filterTag = 'all';
    let filterPriority = 'all';
    let editingId = null;
    const selected = new Set();
    let runningTimer = loadTimer();

    /* ---------------- Theme ---------------- */
    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        document.documentElement.setAttribute('data-theme', saved || 'dark');
        updateThemeIcon();
    }
    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
        updateThemeIcon();
    }
    function updateThemeIcon() {
        const btn = $('#btn-theme');
        if (!btn) return;
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        btn.textContent = isLight ? '🌙' : '☀️';
        btn.title = isLight ? 'Mode gelap' : 'Mode terang';
    }

    /* ---------------- LocalStorage ---------------- */
    function loadState() {
        try {
            const raw = localStorage.getItem(CFG.key);
            if (raw) {
                const data = JSON.parse(raw);
                if (Array.isArray(data)) return data.map(d => ({ priority: 'med', tags: [], ...d }));
            }
        } catch (_) {}
        return CFG.seed.map((d) => ({ id: uid(), ...d }));
    }
    function saveState() {
        try { localStorage.setItem(CFG.key, JSON.stringify(state)); } catch (_) {}
    }
    function loadTimer() {
        try {
            const raw = localStorage.getItem(TIMER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }
    function saveTimer() {
        try {
            if (runningTimer) localStorage.setItem(TIMER_KEY, JSON.stringify(runningTimer));
            else localStorage.removeItem(TIMER_KEY);
        } catch (_) {}
    }

    /* ---------------- DOM refs ---------------- */
    const tbody   = $(`${CFG.tableSel} tbody`);
    const table   = $(CFG.tableSel);
    const statsEl = $(CFG.statsSel);
    const emptyEl = $('#empty-state');
    const searchEl = $('#search');
    const filterEl = $('#filter-status');
    const tagFilterEl = $('#filter-tag');
    const priorityFilterEl = $('#filter-priority');
    const bulkBar = $('#bulk-bar');
    const bulkCount = $('#bulk-count');

    const modal      = $('#modal');
    const modalTitle = $('#modal-title');
    const form       = $('#form');
    const btnAdd     = $('#btn-add');
    const btnClose   = $('#modal-close');
    const toastBox   = $('#toast-container');

    const timerBar = $('#running-timer');
    const timerLabel = $('#running-label');
    const timerTime = $('#running-time');
    let timerInterval = null;

    /* ---------------- Toast ---------------- */
    function toast(msg, type = '') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        toastBox.appendChild(el);
        setTimeout(() => {
            el.classList.add('out');
            setTimeout(() => el.remove(), 200);
        }, 2400);
    }

    /* ---------------- Stats ---------------- */
    function renderStats() {
        const total    = state.length;
        const selesai  = state.filter(d => d.status === 'selesai').length;
        const progress = state.filter(d => d.status === 'progress').length;
        const pending  = state.filter(d => d.status === 'pending').length;
        const pct      = total ? Math.round((selesai / total) * 100) : 0;
        const durasiTotal = CFG.hasDurasi ? state.reduce((s, d) => s + (Number(d.durasi) || 0), 0) : null;
        const urgent = state.filter(d => {
            if (!d.deadline || d.status === 'selesai') return false;
            const diff = daysUntil(d.deadline);
            return diff >= 0 && diff <= URGENT_DAYS;
        }).length;
        const highPrio = state.filter(d => d.priority === 'high' && d.status !== 'selesai').length;

        statsEl.innerHTML = CFG.hasDurasi ? `
            <div class="stat-card">
                <div class="stat-label">Total Materi</div>
                <div class="stat-value">${total}</div>
                <div class="stat-sub">${selesai} selesai · ${progress} jalan</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Progress</div>
                <div class="stat-value">${pct}%</div>
                <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Durasi</div>
                <div class="stat-value">${durasiTotal} jam</div>
                <div class="stat-sub">dari semua sesi</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Prioritas Tinggi</div>
                <div class="stat-value">${highPrio}</div>
                <div class="stat-sub">belum selesai 🔴</div>
            </div>
        ` : `
            <div class="stat-card">
                <div class="stat-label">Total Tugas</div>
                <div class="stat-value">${total}</div>
                <div class="stat-sub">${progress} jalan · ${pending} belum</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Selesai</div>
                <div class="stat-value">${selesai}/${total}</div>
                <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Deadline Dekat</div>
                <div class="stat-value">${urgent}</div>
                <div class="stat-sub">≤ ${URGENT_DAYS} hari lagi ⚠</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Prioritas Tinggi</div>
                <div class="stat-value">${highPrio}</div>
                <div class="stat-sub">belum selesai 🔴</div>
            </div>
        `;
    }

    /* ---------------- Chart ---------------- */
    function renderChart() {
        const el = $('#chart');
        const legend = $('#chart-legend');
        if (!el || !legend) return;
        const total = state.length;
        if (!total) {
            el.innerHTML = '';
            legend.innerHTML = '<span class="chart-empty">Belum ada data</span>';
            return;
        }
        const buckets = ['selesai', 'progress', 'pending'].map(k => ({
            key: k,
            label: STATUS[k].label.replace(/^[^\s]+\s/, ''),
            color: STATUS[k].color,
            n: state.filter(d => d.status === k).length,
        })).filter(b => b.n > 0);
        const R = 52, C = 2 * Math.PI * R, CX = 60, CY = 60;
        let offset = 0;
        const arcs = buckets.map(b => {
            const dash = (b.n / total) * C;
            const arc = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
                stroke="${b.color}" stroke-width="14"
                stroke-dasharray="${dash} ${C - dash}"
                stroke-dashoffset="${-offset}"
                transform="rotate(-90 ${CX} ${CY})"/>`;
            offset += dash;
            return arc;
        }).join('');
        const pct = Math.round((state.filter(d => d.status === 'selesai').length / total) * 100);
        el.setAttribute('viewBox', '0 0 120 120');
        el.innerHTML = `
            <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--bg-3)" stroke-width="14"/>
            ${arcs}
            <text x="${CX}" y="${CY - 2}" text-anchor="middle" font-size="20" font-weight="800" fill="var(--text)">${pct}%</text>
            <text x="${CX}" y="${CY + 14}" text-anchor="middle" font-size="9" fill="var(--text-mute)" letter-spacing="0.08em">SELESAI</text>
        `;
        legend.innerHTML = buckets.map(b => `
            <div class="chart-legend-row">
                <span class="chart-dot" style="background:${b.color}"></span>
                <span>${b.label}</span>
                <span class="chart-count">${b.n}</span>
            </div>
        `).join('');
    }

    /* ---------------- Cell renderer ---------------- */
    function renderCell(item, col) {
        const val = item[col.key];
        const empty = (val === undefined || val === null || val === '' || val === '-');

        if (col.cell === 'status') {
            const s = STATUS[item.status] || STATUS.pending;
            return `<span class="badge ${s.cls}">${s.label}</span>`;
        }
        if (col.cell === 'priority') {
            const p = PRIORITY[item.priority] || PRIORITY.med;
            return `<span class="priority ${p.cls}">${p.icon} ${p.label}</span>`;
        }
        if (col.cell === 'tags') {
            const arr = Array.isArray(val) ? val : (val ? String(val).split(',').map(s => s.trim()).filter(Boolean) : []);
            if (!arr.length) return '<span class="cell-empty">-</span>';
            return `<span class="tags">${arr.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</span>`;
        }
        if (col.cell === 'date') {
            if (empty) return '<span class="cell-empty">-</span>';
            const urgent = col.key === 'deadline' && item.status !== 'selesai'
                && daysUntil(val) >= 0 && daysUntil(val) <= URGENT_DAYS;
            return `<time class="${urgent ? 'deadline-warn' : ''}" datetime="${escapeHtml(val)}">${fmtDate(val)}</time>`;
        }
        if (col.cell === 'durasi') {
            const n = Number(val) || 0;
            return n ? `${n} jam` : '<span class="cell-empty">0 jam</span>';
        }
        if (col.cell === 'link') {
            if (empty) return '<span class="cell-empty">-</span>';
            const href = /^https?:\/\//i.test(val) ? val : `https://${val}`;
            return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">▶ Tonton</a>`;
        }
        if (col.cell === 'materi') {
            const name = escapeHtml(val);
            const note = item.notes ? `<span class="note-icon" title="${escapeHtml(item.notes)}">ℹ️</span>` : '';
            return `<strong>${name}</strong>${note}`;
        }
        return empty ? '<span class="cell-empty">-</span>' : escapeHtml(val);
    }

    /* ---------------- Filter + Sort ---------------- */
    function isUrgent(item) {
        if (!item.deadline || item.status === 'selesai') return false;
        const d = daysUntil(item.deadline);
        return d >= 0 && d <= URGENT_DAYS;
    }
    function getFiltered() {
        const q = query.trim().toLowerCase();
        let list = state.filter((item) => {
            if (filterStatus !== 'all' && item.status !== filterStatus) return false;
            if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
            if (filterTag !== 'all') {
                const tags = Array.isArray(item.tags) ? item.tags : [];
                if (!tags.some(t => String(t).toLowerCase() === filterTag)) return false;
            }
            if (!q) return true;
            return CFG.searchFields.some(key => {
                const v = item[key];
                if (Array.isArray(v)) return v.some(t => String(t).toLowerCase().includes(q));
                return String(v ?? '').toLowerCase().includes(q);
            });
        });
        if (sortKey) {
            list = [...list].sort((a, b) => {
                let va = a[sortKey], vb = b[sortKey];
                if (va === undefined || va === null) va = '';
                if (vb === undefined || vb === null) vb = '';
                const na = Number(va), nb = Number(vb);
                const bothNum = !Number.isNaN(na) && !Number.isNaN(nb) && va !== '' && vb !== '';
                let cmp;
                if (bothNum) cmp = na - nb;
                else cmp = String(va).toLowerCase().localeCompare(String(vb).toLowerCase());
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return list;
    }

    /* ---------------- Render head ---------------- */
    function renderHead() {
        const thead = table.querySelector('thead');
        const cols = CFG.columns.map(c => {
            if (c.sortable === false) return `<th scope="col">${escapeHtml(c.label)}</th>`;
            const indicator = sortKey === c.key ? ` data-sort="${sortDir}"` : '';
            return `<th scope="col" class="sortable" data-key="${c.key}"${indicator}>${escapeHtml(c.label)}</th>`;
        }).join('');
        const allChecked = state.length > 0 && state.every(d => selected.has(d.id));
        thead.innerHTML = `<tr>
            <th class="col-check"><input type="checkbox" class="row-check" id="check-all" ${allChecked ? 'checked' : ''} aria-label="Pilih semua"></th>
            <th scope="col" class="num">No</th>
            ${cols}
            <th scope="col">Aksi</th>
        </tr>`;
    }

    /* ---------------- Render table ---------------- */
    function renderTable() {
        const list = getFiltered();
        if (!list.length) {
            tbody.innerHTML = '';
            emptyEl.hidden = false;
            table.hidden = true;
            renderBulkBar();
            return;
        }
        table.hidden = false;
        emptyEl.hidden = true;
        tbody.innerHTML = list.map((item, idx) => {
            const cells = CFG.columns.map(col =>
                `<td data-label="${escapeHtml(col.label)}">${renderCell(item, col)}</td>`
            ).join('');
            const cls = [
                isUrgent(item) ? 'urgent' : '',
                selected.has(item.id) ? 'selected' : '',
            ].filter(Boolean).join(' ');
            const isTimerActive = runningTimer && runningTimer.id === item.id;
            const timerBtn = CFG.hasDurasi
                ? `<button class="icon-btn timer${isTimerActive ? ' active' : ''}"
                          data-action="timer" data-id="${item.id}"
                          title="${isTimerActive ? 'Stop timer' : 'Mulai timer'}">${isTimerActive ? '⏹' : '⏱'}</button>`
                : '';
            return `
                <tr data-id="${item.id}"${cls ? ` class="${cls}"` : ''}>
                    <td class="col-check" data-label="Pilih">
                        <input type="checkbox" class="row-check" data-check="${item.id}" ${selected.has(item.id) ? 'checked' : ''} aria-label="Pilih baris">
                    </td>
                    <td class="num" data-label="No">${idx + 1}</td>
                    ${cells}
                    <td data-label="Aksi">
                        <div class="row-actions">
                            ${timerBtn}
                            <button class="icon-btn" data-action="duplicate" data-id="${item.id}" title="Duplikat">📋</button>
                            <button class="icon-btn" data-action="edit" data-id="${item.id}" title="Edit">✎</button>
                            <button class="icon-btn danger" data-action="delete" data-id="${item.id}" title="Hapus">✕</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        renderBulkBar();
    }

    function renderBulkBar() {
        if (!bulkBar) return;
        const n = selected.size;
        if (n === 0) { bulkBar.hidden = true; return; }
        bulkBar.hidden = false;
        bulkCount.textContent = `${n} item dipilih`;
    }

    function renderTagOptions() {
        if (!tagFilterEl) return;
        const set = new Set();
        state.forEach(item => {
            const arr = Array.isArray(item.tags) ? item.tags : [];
            arr.forEach(t => set.add(String(t).toLowerCase()));
        });
        const tags = [...set].sort();
        const cur = filterTag;
        tagFilterEl.innerHTML = `<option value="all">Semua tag</option>` +
            tags.map(t => `<option value="${escapeHtml(t)}"${cur === t ? ' selected' : ''}>#${escapeHtml(t)}</option>`).join('');
        if (!tags.includes(cur)) { filterTag = 'all'; tagFilterEl.value = 'all'; }
    }

    /* ---------------- Modal ---------------- */
    function openModal(item = null) {
        editingId = item ? item.id : null;
        modalTitle.textContent = item ? 'Edit Data' : `Tambah ${CFG.title}`;
        form.innerHTML = CFG.formFields.map((f) => {
            let val = item ? (item[f.key] ?? '') : (f.default ?? (f.type === 'select' ? '' : ''));
            if (Array.isArray(val)) val = val.join(', ');
            const full = f.full ? ' full' : '';
            const req = f.required ? ' required' : '';
            let input;
            if (f.type === 'select') {
                const opts = f.options.map(o =>
                    `<option value="${o.value}"${val === o.value ? ' selected' : ''}>${o.label}</option>`
                ).join('');
                input = `<select name="${f.key}"${req}>${opts}</select>`;
            } else if (f.type === 'textarea') {
                input = `<textarea name="${f.key}"${req} placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(val)}</textarea>`;
            } else {
                const attrs = [
                    `type="${f.type}"`,
                    `name="${f.key}"`,
                    `value="${escapeHtml(val)}"`,
                    f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : '',
                    f.step ? `step="${f.step}"` : '',
                    f.min !== undefined ? `min="${f.min}"` : '',
                    f.max !== undefined ? `max="${f.max}"` : '',
                ].filter(Boolean).join(' ');
                input = `<input ${attrs}${req}>`;
            }
            const hint = f.hint ? `<span class="field-hint">${escapeHtml(f.hint)}</span>` : '';
            return `
                <div class="field${full}">
                    <label for="f-${f.key}">${escapeHtml(f.label)}</label>
                    ${input}
                    ${hint}
                </div>
            `;
        }).join('') + `
            <div class="modal-footer">
                <span class="kbd-hint">Ctrl+Enter simpan · Esc tutup</span>
                <button type="button" class="btn btn-ghost" data-action="cancel">Batal</button>
                <button type="submit" class="btn btn-primary">${item ? 'Simpan' : 'Tambah'}</button>
            </div>
        `;
        modal.hidden = false;
        setTimeout(() => {
            const first = form.querySelector('input, select, textarea');
            if (first) first.focus();
        }, 60);
    }
    function closeModal() {
        modal.hidden = true;
        editingId = null;
        form.innerHTML = '';
    }

    /* ---------------- CRUD ---------------- */
    function handleSubmit(e) {
        e.preventDefault();
        const fd = new FormData(form);
        const data = {};
        CFG.formFields.forEach((f) => {
            let v = fd.get(f.key);
            if (typeof v === 'string') v = v.trim();
            if (f.key === 'tags') {
                data.tags = v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
                return;
            }
            if (f.type === 'number' && v !== '') v = Number(v);
            data[f.key] = v;
        });
        if (editingId) {
            state = state.map(it => it.id === editingId ? { ...it, ...data } : it);
            toast('Data diupdate ✎', 'success');
        } else {
            state.push({ id: uid(), ...data });
            toast('Data ditambahkan ✓', 'success');
        }
        saveState();
        renderTagOptions();
        renderAll();
        closeModal();
    }

    function deleteItem(id) {
        const item = state.find(it => it.id === id);
        if (!item) return;
        const name = item.materi || item.matkul || 'data ini';
        if (!confirm(`Hapus "${name}"?`)) return;
        state = state.filter(it => it.id !== id);
        selected.delete(id);
        if (runningTimer && runningTimer.id === id) stopTimer(false);
        saveState();
        renderTagOptions();
        renderAll();
        toast('Data dihapus 🗑', 'danger');
    }

    function deleteSelected() {
        const n = selected.size;
        if (!n) return;
        if (!confirm(`Hapus ${n} data terpilih?`)) return;
        state = state.filter(it => !selected.has(it.id));
        if (runningTimer && selected.has(runningTimer.id)) stopTimer(false);
        selected.clear();
        saveState();
        renderTagOptions();
        renderAll();
        toast(`${n} data dihapus 🗑`, 'danger');
    }

    function duplicateItem(id) {
        const item = state.find(it => it.id === id);
        if (!item) return;
        const clone = { ...item, id: uid() };
        const baseName = item.materi || item.matkul || 'Item';
        if (clone.materi) clone.materi = `${baseName} (copy)`;
        if (clone.matkul) clone.matkul = `${baseName} (copy)`;
        state.push(clone);
        saveState();
        renderTagOptions();
        renderAll();
        toast('Data diduplikat 📋', 'success');
    }

    /* ---------------- Timer ---------------- */
    function startTimer(id) {
        if (runningTimer) {
            if (runningTimer.id === id) { stopTimer(true); return; }
            if (!confirm('Ada timer lain jalan. Stop dulu yang itu?')) return;
            stopTimer(false);
        }
        runningTimer = { id, startedAt: Date.now() };
        saveTimer();
        renderAll();
        startTimerTick();
        toast('Timer jalan ⏱', 'success');
    }
    function stopTimer(save = true) {
        if (!runningTimer) return;
        const item = state.find(it => it.id === runningTimer.id);
        const elapsed = Math.floor((Date.now() - runningTimer.startedAt) / 1000);
        if (save && item) {
            const hours = elapsed / 3600;
            const oldDur = Number(item.durasi) || 0;
            item.durasi = Math.round((oldDur + hours) * 100) / 100;
            saveState();
            toast(`+${fmtDuration(elapsed)} ditambahin ke durasi ✓`, 'success');
        }
        runningTimer = null;
        saveTimer();
        stopTimerTick();
        renderAll();
    }
    function startTimerTick() {
        stopTimerTick();
        if (!runningTimer) return;
        const item = state.find(it => it.id === runningTimer.id);
        if (!item) { runningTimer = null; saveTimer(); updateTimerBar(); return; }
        timerBar.hidden = false;
        timerLabel.textContent = item.materi || item.matkul || 'Fokus';
        updateTimerBar();
        timerInterval = setInterval(updateTimerBar, 1000);
    }
    function stopTimerTick() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (!runningTimer) timerBar.hidden = true;
    }
    function updateTimerBar() {
        if (!runningTimer) return;
        const elapsed = Math.floor((Date.now() - runningTimer.startedAt) / 1000);
        timerTime.textContent = fmtDuration(elapsed);
    }
    function resumeTimer() {
        if (!runningTimer) return;
        const item = state.find(it => it.id === runningTimer.id);
        if (!item) { runningTimer = null; saveTimer(); return; }
        timerBar.hidden = false;
        timerLabel.textContent = item.materi || item.matkul || 'Fokus';
        updateTimerBar();
        if (timerInterval) return;
        timerInterval = setInterval(updateTimerBar, 1000);
    }

    /* ---------------- Export / Import ---------------- */
    function exportData() {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tracker-${pageKey}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        toast(`${state.length} data diexport ✓`, 'success');
    }
    function importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error('Bukan array');
                if (!confirm(`Import ${data.length} data? Data lama diganti.`)) return;
                state = data.map(d => ({ priority: 'med', tags: [], ...d, id: d.id || uid() }));
                selected.clear();
                saveState();
                renderTagOptions();
                renderAll();
                toast(`${data.length} data diimport ✓`, 'success');
            } catch (err) {
                console.error(err);
                toast('File ga valid ❌', 'danger');
            }
        };
        reader.readAsText(file);
    }

    /* ---------------- Render all ---------------- */
    function renderAll() {
        renderHead();
        renderStats();
        renderChart();
        renderTable();
    }

    /* ---------------- Keyboard shortcuts ---------------- */
    function bindShortcuts() {
        document.addEventListener('keydown', (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !modal.hidden) {
                e.preventDefault();
                form.requestSubmit();
                return;
            }
            if (e.key === 'Escape') {
                if (!modal.hidden) { closeModal(); return; }
                if (selected.size) { selected.clear(); renderAll(); return; }
            }
            if (typing || !modal.hidden) return;
            if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openModal(); }
            if (e.key === '/') { e.preventDefault(); searchEl.focus(); }
        });
    }

    /* ---------------- Events ---------------- */
    function bindEvents() {
        const themeBtn = $('#btn-theme');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

        btnAdd.addEventListener('click', () => openModal());
        btnClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        form.addEventListener('submit', handleSubmit);
        form.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'cancel') closeModal();
        });

        tbody.addEventListener('click', (e) => {
            const check = e.target.closest('[data-check]');
            if (check) {
                const id = check.dataset.check;
                if (check.checked) selected.add(id); else selected.delete(id);
                const tr = check.closest('tr');
                if (tr) tr.classList.toggle('selected', check.checked);
                renderBulkBar();
                const ca = $('#check-all');
                if (ca) ca.checked = state.length > 0 && state.every(d => selected.has(d.id));
                return;
            }
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const { action, id } = btn.dataset;
            if (action === 'edit') {
                const item = state.find(it => it.id === id);
                if (item) openModal(item);
            } else if (action === 'delete') {
                deleteItem(id);
            } else if (action === 'duplicate') {
                duplicateItem(id);
            } else if (action === 'timer') {
                startTimer(id);
            }
        });

        table.querySelector('thead').addEventListener('click', (e) => {
            if (e.target.id === 'check-all') {
                if (e.target.checked) state.forEach(d => selected.add(d.id));
                else selected.clear();
                renderTable();
            }
        });

        table.querySelector('thead').addEventListener('click', (e) => {
            const th = e.target.closest('th[data-key]');
            if (!th) return;
            const key = th.dataset.key;
            if (sortKey === key) {
                if (sortDir === 'asc') sortDir = 'desc';
                else { sortKey = null; sortDir = 'asc'; }
            } else {
                sortKey = key;
                sortDir = 'asc';
            }
            renderAll();
        });

        searchEl.addEventListener('input', (e) => { query = e.target.value; renderTable(); });
        filterEl.addEventListener('change', (e) => { filterStatus = e.target.value; renderTable(); });
        if (tagFilterEl) tagFilterEl.addEventListener('change', (e) => { filterTag = e.target.value; renderTable(); });
        if (priorityFilterEl) priorityFilterEl.addEventListener('change', (e) => { filterPriority = e.target.value; renderTable(); });

        const exportBtn = $('#btn-export');
        const importBtn = $('#btn-import');
        const importFile = $('#import-file');
        if (exportBtn) exportBtn.addEventListener('click', exportData);
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (f) importData(f);
                e.target.value = '';
            });
        }

        const resetBtn = $('#btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!confirm('Reset ke data awal? Semua perubahan bakal ilang.')) return;
                state = CFG.seed.map((d) => ({ id: uid(), ...d }));
                selected.clear();
                saveState();
                renderTagOptions();
                renderAll();
                toast('Data direset ↻', 'success');
            });
        }

        if (bulkBar) {
            bulkBar.addEventListener('click', (e) => {
                if (e.target.id === 'btn-bulk-delete') deleteSelected();
                if (e.target.id === 'btn-bulk-clear') { selected.clear(); renderAll(); }
            });
        }

        if (timerBar) {
            timerBar.addEventListener('click', (e) => {
                if (e.target.id === 'btn-stop-timer') stopTimer(true);
                if (e.target.id === 'btn-cancel-timer') stopTimer(false);
            });
        }

        bindShortcuts();
    }

    /* ---------------- Init ---------------- */
    function init() {
        initTheme();
        try { bindEvents(); } catch (e) { console.error('bindEvents:', e); }
        try { renderTagOptions(); } catch (e) { console.error(e); }
        try { renderAll(); } catch (e) { console.error('renderAll:', e); }
        try { if (runningTimer) resumeTimer(); } catch (e) { console.error(e); }
    }

    init();
})();