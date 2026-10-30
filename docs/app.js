/* ============================================================
   AAP STORE — logika web store
   Tanpa framework, tanpa build step. Cukup buka index.html
   atau host foldernya di GitHub Pages / Netlify / server apa pun.
   ============================================================ */

(() => {
  'use strict';

  const DEFAULT_CATALOG = 'catalog.json';
  const LS_CATALOG_URL = 'aapstore.catalogUrl';
  const LS_CACHE = 'aapstore.cache';
  const LS_SETTINGS = 'aapstore.settings';

  const $ = (sel) => document.querySelector(sel);
  const el = {
    tagline: $('#tagline'),
    search: $('#search'),
    cats: $('#cats'),
    grid: $('#grid'),
    status: $('#status'),
    footInfo: $('#foot-info'),
    footMax: $('#foot-max'),
    sheet: $('#sheet'),
    sheetIcon: $('#sheet-icon'),
    sheetTitle: $('#sheet-title'),
    sheetPkg: $('#sheet-pkg'),
    sheetBadges: $('#sheet-badges'),
    sheetDesc: $('#sheet-desc'),
    sheetMeta: $('#sheet-meta'),
    sheetDownload: $('#sheet-download'),
    sheetCopy: $('#sheet-copy'),
    help: $('#help'),
    settings: $('#settings'),
    catalogUrl: $('#catalog-url'),
    settingsInfo: $('#settings-info'),
    toast: $('#toast'),
    btnInstallApp: $('#btn-install-app'),
  };

  const state = {
    store: { name: 'AAP STORE', maxApps: 30 },
    apps: [],
    category: 'Semua',
    query: '',
    baseUrl: '',
    current: null,
    loading: false,
  };

  let deferredInstall = null;
  let toastTimer = 0;

  /* -------------------------------------------------- util */
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function formatBytes(n) {
    const b = Number(n);
    if (!Number.isFinite(b) || b <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = b;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase();
  }

  function absolute(url) {
    if (!url) return '';
    try {
      return new URL(url, state.baseUrl || location.href).href;
    } catch {
      return url;
    }
  }

  function isFresh(dateStr, days = 14) {
    if (!dateStr) return false;
    const t = Date.parse(dateStr);
    if (Number.isNaN(t)) return false;
    return Date.now() - t < days * 864e5;
  }

  function toast(msg, ms = 2600) {
    clearTimeout(toastTimer);
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), ms);
  }

  /* -------------------------------------------------- katalog */
  function catalogUrl() {
    const qs = new URLSearchParams(location.search).get('catalog');
    if (qs) return qs;
    return localStorage.getItem(LS_CATALOG_URL) || DEFAULT_CATALOG;
  }

  async function fetchCatalog() {
    const url = catalogUrl();
    state.baseUrl = new URL(url, location.href).href;

    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} saat mengambil ${url}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.apps)) throw new Error('Format catalog.json tidak valid (butuh "apps": [...])');

    try {
      localStorage.setItem(LS_CACHE, JSON.stringify({ at: Date.now(), data, url }));
    } catch { /* storage penuh: abaikan */ }

    return data;
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(LS_CACHE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.data ? parsed : null;
    } catch {
      return null;
    }
  }

  async function load({ silent = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    if (!silent) showStatus('loading');
    try {
      const data = await fetchCatalog();
      apply(data);
      if (silent) toast('Katalog diperbarui');
    } catch (err) {
      const cached = loadCache();
      if (cached) {
        state.baseUrl = new URL(cached.url || catalogUrl(), location.href).href;
        apply(cached.data);
        toast('Offline — memakai katalog tersimpan');
      } else {
        showStatus('error', err);
      }
    } finally {
      state.loading = false;
    }
  }

  function apply(data) {
    state.store = Object.assign({ name: 'AAP STORE', maxApps: 30 }, data.store || {});
    state.apps = data.apps
      .filter((a) => a && a.name)
      .map((a) => ({
        id: a.id || a.packageName || a.name,
        name: a.name,
        version: a.version || '',
        packageName: a.packageName || '',
        category: a.category || 'Lainnya',
        description: a.description || '',
        apk: a.apk || '',
        icon: a.icon || '',
        sizeBytes: a.sizeBytes || 0,
        updated: a.updated || '',
        minSdk: a.minSdk || '',
        arch: a.arch || '',
      }));

    document.title = `${state.store.name} — App Store Android TV / STB`;
    if (state.category !== 'Semua' && !state.apps.some((a) => a.category === state.category)) {
      state.category = 'Semua';
    }
    el.footMax.textContent = state.store.maxApps;
    renderCats();
    render();
  }

  function showStatus(kind, err) {
    el.grid.innerHTML = '';
    el.status.classList.remove('hidden');
    if (kind === 'loading') {
      el.status.innerHTML = '<div class="spinner"></div><p>Memuat katalog…</p>';
      el.tagline.textContent = 'Memuat katalog…';
      return;
    }
    el.status.innerHTML = `
      <div>
        <h2>Katalog gagal dimuat</h2>
        <p>${esc(err && err.message ? err.message : 'Terjadi kesalahan.')}</p>
        <p>Cek koneksi internet, atau atur alamat <code>catalog.json</code> lewat tombol ⚙ di kanan atas.</p>
        <p><button class="ghost-btn" id="btn-retry">Coba lagi</button></p>
      </div>`;
    el.tagline.textContent = 'Gagal memuat katalog';
    const retry = $('#btn-retry');
    if (retry) retry.addEventListener('click', () => load());
  }

  /* -------------------------------------------------- render */
  function renderCats() {
    const cats = ['Semua', ...new Set(state.apps.map((a) => a.category))];
    el.cats.innerHTML = cats
      .map(
        (c) =>
          `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === state.category}">${esc(c)}</button>`
      )
      .join('');
  }

  function visibleApps() {
    const q = state.query.trim().toLowerCase();
    return state.apps.filter((a) => {
      const okCat = state.category === 'Semua' || a.category === state.category;
      if (!okCat) return false;
      if (!q) return true;
      return `${a.name} ${a.packageName} ${a.description} ${a.category}`.toLowerCase().includes(q);
    });
  }

  function render() {
    const apps = visibleApps();
    const total = state.apps.length;
    const max = state.store.maxApps;

    el.tagline.textContent = `${total} / ${max} aplikasi tersedia${state.store.updated ? ` · diperbarui ${state.store.updated}` : ''}`;
    el.footInfo.textContent = `${state.store.name} · ${total} aplikasi`;

    if (!apps.length) {
      el.grid.innerHTML = '';
      el.status.classList.remove('hidden');
      el.status.innerHTML = state.apps.length
        ? `<div><h2>Tidak ada hasil</h2><p>Coba kata kunci atau kategori lain.</p></div>`
        : `<div><h2>Katalog masih kosong</h2>
             <p>Tambahkan APK ke <code>catalog.json</code>, lalu muat ulang.</p>
             <p><button class="ghost-btn" id="btn-help2">Lihat cara instal APK</button></p></div>`;
      const h = $('#btn-help2');
      if (h) h.addEventListener('click', () => openOverlay(el.help));
      return;
    }

    el.status.classList.add('hidden');
    el.grid.innerHTML = apps
      .map((a, i) => {
        const icon = a.icon
          ? `<img class="card-icon" src="${esc(absolute(a.icon))}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;card-icon placeholder&quot;>${esc(initials(a.name))}</div>'" />`
          : `<div class="card-icon placeholder">${esc(initials(a.name))}</div>`;
        const fresh = isFresh(a.updated) ? '<span class="badge new">Baru</span>' : '';
        return `<button class="card" data-idx="${i}" tabindex="0">
          ${icon}
          <span class="card-name">${esc(a.name)}</span>
          <span class="card-meta">
            ${a.version ? `<span>v${esc(a.version)}</span><span class="sep">•</span>` : ''}
            <span>${formatBytes(a.sizeBytes)}</span>
            ${fresh ? `<span class="sep">•</span>${fresh}` : ''}
          </span>
        </button>`;
      })
      .join('');

    el.grid.querySelectorAll('.card').forEach((card, i) => {
      card.addEventListener('click', () => openApp(apps[i]));
      card.addEventListener('focus', () => card.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    });
  }

  /* -------------------------------------------------- detail sheet */
  function openApp(app) {
    state.current = app;
    el.sheetTitle.textContent = app.name;
    el.sheetPkg.textContent = app.packageName || app.id;
    el.sheetDesc.textContent = app.description || 'Belum ada deskripsi.';
    el.sheetBadges.innerHTML = [
      `<span class="badge">${esc(app.category)}</span>`,
      isFresh(app.updated) ? '<span class="badge new">Baru</span>' : '',
      app.arch ? `<span class="badge">${esc(app.arch)}</span>` : '',
    ]
      .filter(Boolean)
      .join('');

    const iconUrl = app.icon ? absolute(app.icon) : '';
    el.sheetIcon.className = 'sheet-icon';
    el.sheetIcon.outerHTML = iconUrl
      ? `<img id="sheet-icon" class="sheet-icon" src="${esc(iconUrl)}" alt="" width="128" height="128" onerror="this.outerHTML='<div id=&quot;sheet-icon&quot; class=&quot;sheet-icon placeholder&quot;>${esc(initials(app.name))}</div>'" />`
      : `<div id="sheet-icon" class="sheet-icon placeholder">${esc(initials(app.name))}</div>`;
    el.sheetIcon = $('#sheet-icon');

    const rows = [
      ['Versi', app.version || '—'],
      ['Ukuran', formatBytes(app.sizeBytes)],
      ['Diperbarui', app.updated || '—'],
      ['Min. Android', app.minSdk ? `API ${esc(app.minSdk)}` : '—'],
      ['Paket', app.packageName || '—'],
    ];
    el.sheetMeta.innerHTML = rows
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join('');

    if (app.apk) {
      el.sheetDownload.href = absolute(app.apk);
      el.sheetDownload.removeAttribute('aria-disabled');
      el.sheetDownload.textContent = '⬇ Unduh & Instal';
      el.sheetDownload.style.opacity = '1';
      el.sheetDownload.style.pointerEvents = 'auto';
    } else {
      el.sheetDownload.href = '#';
      el.sheetDownload.setAttribute('aria-disabled', 'true');
      el.sheetDownload.textContent = 'File APK belum tersedia';
      el.sheetDownload.style.opacity = '.55';
      el.sheetDownload.style.pointerEvents = 'none';
    }

    openOverlay(el.sheet);
    setTimeout(() => el.sheetDownload.focus(), 60);
  }

  function openOverlay(node) {
    document.querySelectorAll('.overlay').forEach((o) => o.classList.add('hidden'));
    node.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlays() {
    document.querySelectorAll('.overlay').forEach((o) => o.classList.add('hidden'));
    document.body.style.overflow = '';
  }

  /* -------------------------------------------------- navigasi D-pad */
  function moveFocus(dir) {
    const cards = [...el.grid.querySelectorAll('.card')];
    if (!cards.length) return false;
    const active = document.activeElement;
    let idx = cards.indexOf(active);

    if (idx === -1) {
      cards[0].focus();
      return true;
    }

    const rect = (n) => n.getBoundingClientRect();
    const cur = rect(cards[idx]);
    let best = null;
    let bestScore = Infinity;

    for (const cand of cards) {
      if (cand === cards[idx]) continue;
      const r = rect(cand);
      const dx = r.left - cur.left;
      const dy = r.top - cur.top;
      let ok = false;
      let score = 0;
      if (dir === 'left' && dx < -4) { ok = true; score = Math.abs(dx) + Math.abs(dy) * 3; }
      if (dir === 'right' && dx > 4) { ok = true; score = Math.abs(dx) + Math.abs(dy) * 3; }
      if (dir === 'up' && dy < -4) { ok = true; score = Math.abs(dy) + Math.abs(dx) * 3; }
      if (dir === 'down' && dy > 4) { ok = true; score = Math.abs(dy) + Math.abs(dx) * 3; }
      if (ok && score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    if (best) {
      best.focus();
      return true;
    }
    return false;
  }

  document.addEventListener('keydown', (e) => {
    const overlayOpen = [...document.querySelectorAll('.overlay')].some((o) => !o.classList.contains('hidden'));
    if (e.key === 'Escape') {
      if (overlayOpen) {
        closeOverlays();
        e.preventDefault();
      }
      return;
    }
    if (overlayOpen) return;
    if (document.activeElement === el.search) return;

    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) {
      if (moveFocus(map[e.key])) e.preventDefault();
    }
  });

  /* -------------------------------------------------- events */
  el.search.addEventListener('input', () => {
    state.query = el.search.value;
    render();
  });

  el.cats.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.category = btn.dataset.cat;
    el.cats.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
    render();
  });

  $('#btn-refresh').addEventListener('click', () => load({ silent: true }));
  $('#btn-help').addEventListener('click', () => openOverlay(el.help));

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlays));
  document.querySelectorAll('.overlay').forEach((o) =>
    o.addEventListener('click', (e) => {
      if (e.target === o) closeOverlays();
    })
  );

  el.sheetDownload.addEventListener('click', () => {
    if (!state.current || !state.current.apk) return;
    closeOverlays();
    toast(`Mengunduh ${state.current.name}… cek notifikasi untuk instal`, 4200);
  });

  el.sheetCopy.addEventListener('click', async () => {
    if (!state.current) return;
    const url = absolute(state.current.apk);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link APK disalin');
    } catch {
      toast(url, 5000);
    }
  });

  /* -------------------------------------------------- pengaturan */
  $('#btn-settings').addEventListener('click', () => {
    el.catalogUrl.value = localStorage.getItem(LS_CATALOG_URL) || '';
    el.settingsInfo.textContent = `Aktif: ${new URL(catalogUrl(), location.href).href}`;
    openOverlay(el.settings);
    setTimeout(() => el.catalogUrl.focus(), 60);
  });

  $('#btn-save-settings').addEventListener('click', () => {
    const v = el.catalogUrl.value.trim();
    if (v) localStorage.setItem(LS_CATALOG_URL, v);
    else localStorage.removeItem(LS_CATALOG_URL);
    closeOverlays();
    load();
  });

  $('#btn-reset-settings').addEventListener('click', () => {
    localStorage.removeItem(LS_CATALOG_URL);
    localStorage.removeItem(LS_CACHE);
    el.catalogUrl.value = '';
    closeOverlays();
    load();
  });

  /* -------------------------------------------------- PWA */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    el.btnInstallApp.classList.remove('hidden');
  });

  el.btnInstallApp.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    deferredInstall = null;
    el.btnInstallApp.classList.add('hidden');
    if (outcome === 'accepted') toast('AAP STORE dipasang di layar utama');
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  /* -------------------------------------------------- start */
  load();
})();
