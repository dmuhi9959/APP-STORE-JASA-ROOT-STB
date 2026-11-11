/* =========================================================
   Agung AI — logika aplikasi
   ========================================================= */
(function () {
  'use strict';

  var MD = window.Markdown;

  /* ---------------- konstanta ---------------- */

  var K = {
    settings: 'agung.settings.v1',
    convos: 'agung.convos.v1',
    theme: 'agung.theme.v1',
    active: 'agung.active.v1'
  };

  var DEFAULT_SETTINGS = {
    preset: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    systemPrompt:
      'Anda adalah Agung AI, asisten yang ramah, jelas, dan akurat. ' +
      'Jawab dalam bahasa yang sama dengan pengguna. Gunakan Markdown bila membantu ' +
      '(daftar, tabel, blok kode). Jujur bila tidak tahu, dan jangan mengarang fakta.',
    temperature: 0.7,
    maxTokens: 1024,
    stream: true
  };

  var PRESETS = [
    {
      id: 'openai', name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
      keyHint: 'sk-...'
    },
    {
      id: 'openrouter', name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat'],
      keyHint: 'sk-or-v1-...'
    },
    {
      id: 'groq', name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b'],
      keyHint: 'gsk_...'
    },
    {
      id: 'deepseek', name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      keyHint: 'sk-...'
    },
    {
      id: 'gemini', name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
      keyHint: 'AIza...'
    },
    {
      id: 'mistral', name: 'Mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      models: ['mistral-small-latest', 'mistral-large-latest'],
      keyHint: '...'
    },
    {
      id: 'ollama', name: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      models: ['llama3.2', 'qwen2.5', 'gemma3'],
      keyHint: 'tidak perlu key'
    },
    {
      id: 'lmstudio', name: 'LM Studio',
      baseUrl: 'http://localhost:1234/v1',
      models: ['local-model'],
      keyHint: 'tidak perlu key'
    },
    { id: 'custom', name: 'Kustom', baseUrl: '', models: [], keyHint: 'sesuai penyedia' }
  ];

  var ICON = {
    spark: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" fill="currentColor"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z"/></svg>',
    pencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></svg>'
  };

  /* ---------------- util ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return Date.now(); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (e) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage penuh */ }
  }

  function normalizeSettings(s) {
    s = s && typeof s === 'object' ? s : {};
    return {
      preset: s.preset || DEFAULT_SETTINGS.preset,
      baseUrl: typeof s.baseUrl === 'string' && s.baseUrl ? s.baseUrl : DEFAULT_SETTINGS.baseUrl,
      apiKey: typeof s.apiKey === 'string' ? s.apiKey : '',
      model: typeof s.model === 'string' && s.model ? s.model : DEFAULT_SETTINGS.model,
      systemPrompt: typeof s.systemPrompt === 'string' ? s.systemPrompt : DEFAULT_SETTINGS.systemPrompt,
      temperature: isFinite(s.temperature) ? clamp(Number(s.temperature), 0, 2) : DEFAULT_SETTINGS.temperature,
      maxTokens: isFinite(s.maxTokens) ? clamp(parseInt(s.maxTokens, 10), 64, 32000) : DEFAULT_SETTINGS.maxTokens,
      stream: s.stream !== false
    };
  }

  function loadConvos() {
    var raw = readJSON(K.convos, []);
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (c) {
      if (!c || !c.id || !Array.isArray(c.messages)) return;
      var msgs = [];
      c.messages.forEach(function (m) {
        if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
        if (typeof m.content !== 'string') return;
        if (!m.content && !m.pending) return;
        if (m.pending) {
          m.pending = false;
          if (!m.content) m.content = '_(Percakapan terputus karena halaman ditutup.)_';
        }
        msgs.push(m);
      });
      if (!msgs.length) return;
      c.messages = msgs;
      c.updatedAt = c.updatedAt || c.createdAt || now();
      c.createdAt = c.createdAt || c.updatedAt;
      c.title = c.title || 'Tanpa judul';
      out.push(c);
    });
    out.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return out;
  }

  /* ---------------- state ---------------- */

  var state = {
    settings: normalizeSettings(readJSON(K.settings, {})),
    convos: loadConvos(),
    activeId: null,
    theme: localStorage.getItem(K.theme) === 'light' ? 'light' : 'dark',
    query: '',
    streaming: false,
    abort: null,
    stick: true
  };

  (function pickActive() {
    var saved = localStorage.getItem(K.active);
    if (saved && state.convos.some(function (c) { return c.id === saved; })) state.activeId = saved;
  })();

  /* ---------------- elemen ---------------- */

  var el = {
    app: $('#app'),
    sidebar: $('#sidebar'),
    scrim: $('#scrim'),
    convList: $('#convList'),
    searchInput: $('#searchInput'),
    newChat: $('#newChat'),
    closeSidebar: $('#closeSidebar'),
    openSidebar: $('#openSidebar'),
    chatScroll: $('#chatScroll'),
    messages: $('#messages'),
    empty: $('#empty'),
    emptyNote: $('#emptyNote'),
    chatTitle: $('#chatTitle'),
    input: $('#input'),
    composer: $('#composer'),
    sendBtn: $('#sendBtn'),
    scrollBottom: $('#scrollBottom'),
    modal: $('#settingsModal'),
    presetChips: $('#presetChips'),
    baseUrl: $('#baseUrl'),
    apiKey: $('#apiKey'),
    toggleKey: $('#toggleKey'),
    modelInput: $('#modelInput'),
    modelList: $('#modelList'),
    systemPrompt: $('#systemPrompt'),
    temperature: $('#temperature'),
    tempVal: $('#tempVal'),
    maxTokens: $('#maxTokens'),
    streamToggle: $('#streamToggle'),
    testBtn: $('#testBtn'),
    testResult: $('#testResult'),
    toast: $('#toast')
  };

  /* ---------------- tema ---------------- */

  function applyTheme(t) {
    state.theme = t === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    try { localStorage.setItem(K.theme, state.theme); } catch (e) {}
    var icon = $('#themeIcon');
    if (icon) {
      icon.innerHTML = state.theme === 'dark'
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
        : '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>';
    }
    var label = $('#themeLabel');
    if (label) label.textContent = state.theme === 'dark' ? 'Mode terang' : 'Mode gelap';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#0b0b10' : '#ffffff');
  }

  /* ---------------- penyimpanan ---------------- */

  function saveConvos() {
    state.convos = state.convos.filter(function (c) {
      return c.messages && c.messages.length && !c.messages.every(function (m) { return !m.content; });
    });
    state.convos.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (state.convos.length > 200) state.convos.length = 200;
    writeJSON(K.convos, state.convos);
    try {
      if (state.activeId) localStorage.setItem(K.active, state.activeId);
      else localStorage.removeItem(K.active);
    } catch (e) {}
  }

  function activeConvo() {
    if (!state.activeId) return null;
    for (var i = 0; i < state.convos.length; i++) {
      if (state.convos[i].id === state.activeId) return state.convos[i];
    }
    return null;
  }

  function ensureConvo() {
    var c = activeConvo();
    if (c) return c;
    c = { id: uid(), title: '', messages: [], createdAt: now(), updatedAt: now() };
    state.convos.unshift(c);
    state.activeId = c.id;
    return c;
  }

  /* ---------------- UI: mode / model ---------------- */

  function isLocalUrl(url) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(String(url || ''));
  }

  function isDemo() {
    var s = state.settings;
    if (s.apiKey && s.apiKey.trim()) return false;
    return !isLocalUrl(s.baseUrl);
  }

  function hostOf(url) {
    try { return new URL(url).hostname; } catch (e) { return String(url || ''); }
  }

  function updateModeUI() {
    var demo = isDemo();
    var modeText = $('#modeText');
    var modeBadge = $('#modeBadge');
    var modeDot = $('#modeDot');
    var pillDot = $('#pillDot');
    var pillName = $('#pillName');

    if (modeText) modeText.textContent = demo ? 'Mode demo' : (isLocalUrl(state.settings.baseUrl) ? 'Model lokal' : 'Terhubung');
    if (modeBadge) modeBadge.classList.toggle('live', !demo);
    if (modeDot) modeDot.classList.toggle('live', !demo);
    if (pillDot) pillDot.classList.toggle('live', !demo);
    if (pillName) pillName.textContent = state.settings.model || 'model';

    if (el.emptyNote) {
      el.emptyNote.innerHTML = demo
        ? 'Mode demo aktif — sambungkan API key di <b>Pengaturan</b> untuk jawaban AI sungguhan.'
        : 'Terhubung ke <b>' + MD.escape(hostOf(state.settings.baseUrl)) + '</b> · model <b>' + MD.escape(state.settings.model) + '</b>';
    }
  }

  /* ---------------- daftar percakapan ---------------- */

  function groupOf(ts) {
    var d = new Date();
    var start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (ts >= start) return 'Hari ini';
    if (ts >= start - 86400000) return 'Kemarin';
    if (ts >= start - 7 * 86400000) return '7 hari terakhir';
    return 'Lebih lama';
  }

  function renderConvList() {
    var list = el.convList;
    if (!list) return;
    list.innerHTML = '';

    var convos = state.convos.filter(function (c) { return c.messages && c.messages.length; });

    if (state.query) {
      var q = state.query.toLowerCase();
      convos = convos.filter(function (c) {
        if (String(c.title || '').toLowerCase().indexOf(q) !== -1) return true;
        return c.messages.some(function (m) {
          return String(m.content || '').toLowerCase().indexOf(q) !== -1;
        });
      });
    }

    if (!convos.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.innerHTML = state.query
        ? 'Tidak ada hasil untuk <b>“' + MD.escape(state.query) + '”</b>'
        : 'Belum ada riwayat.<br>Mulai chat baru di atas.';
      list.appendChild(empty);
      return;
    }

    var lastGroup = '';
    convos.forEach(function (c) {
      var g = groupOf(c.updatedAt || c.createdAt || now());
      if (g !== lastGroup) {
        var label = document.createElement('div');
        label.className = 'conv-group-label';
        label.textContent = g;
        list.appendChild(label);
        lastGroup = g;
      }

      var item = document.createElement('div');
      item.className = 'conv-item' + (c.id === state.activeId ? ' active' : '');
      item.dataset.id = c.id;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.innerHTML = ICON.chat +
        '<span class="conv-title"></span>' +
        '<span class="conv-acts">' +
          '<button class="mini-btn" data-act="rename" title="Ganti nama" aria-label="Ganti nama">' + ICON.pencil + '</button>' +
          '<button class="mini-btn danger" data-act="delete" title="Hapus" aria-label="Hapus">' + ICON.trash + '</button>' +
        '</span>';
      item.querySelector('.conv-title').textContent = c.title || 'Tanpa judul';
      list.appendChild(item);
    });
  }

  /* ---------------- render chat ---------------- */

  function lastAssistantIndex() {
    var conv = activeConvo();
    if (!conv) return -1;
    for (var i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'assistant' && !conv.messages[i].pending) return i;
    }
    return -1;
  }

  function messageEl(msg, idx) {
    var isUser = msg.role === 'user';
    var wrap = document.createElement('article');
    wrap.className = 'msg ' + (isUser ? 'msg-user' : 'msg-assistant');
    wrap.dataset.idx = String(idx);
    if (msg.pending) wrap.dataset.stream = '1';
    if (msg.error) wrap.classList.add('is-error');

    if (!isUser) {
      var av = document.createElement('div');
      av.className = 'avatar';
      av.setAttribute('aria-hidden', 'true');
      av.innerHTML = ICON.spark;
      wrap.appendChild(av);
    }

    var bubble = document.createElement('div');
    bubble.className = 'bubble';

    var content = document.createElement('div');
    content.className = 'content';
    content.dir = 'auto';

    if (isUser) {
      content.textContent = msg.content;
    } else if (msg.pending && !msg.content) {
      content.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    } else {
      content.innerHTML = MD.render(msg.content);
    }

    bubble.appendChild(content);

    if (!msg.pending) {
      var tools = document.createElement('div');
      tools.className = 'msg-tools';
      var html = '<button class="tool" data-act="copy">' + ICON.copy + '<span>Salin</span></button>';
      if (!isUser && idx === lastAssistantIndex()) {
        html += '<button class="tool" data-act="regen">' + ICON.refresh + '<span>Ulangi</span></button>';
      }
      tools.innerHTML = html;
      bubble.appendChild(tools);
    }

    wrap.appendChild(bubble);
    return wrap;
  }

  function renderChat() {
    var conv = activeConvo();
    var has = !!(conv && conv.messages.length);

    if (el.empty) el.empty.hidden = has;
    if (el.messages) {
      el.messages.innerHTML = '';
      if (has) {
        conv.messages.forEach(function (m, i) {
          el.messages.appendChild(messageEl(m, i));
        });
      }
    }
    if (el.chatTitle) el.chatTitle.textContent = conv && conv.title ? conv.title : 'Chat baru';
  }

  /* ---------------- scroll ---------------- */

  function nearBottom() {
    var sc = el.chatScroll;
    if (!sc) return true;
    return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90;
  }

  function scrollToBottom(force) {
    if (!el.chatScroll) return;
    if (!force && !state.stick) return;
    el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
    state.stick = true;
    updateScrollBtn();
  }

  function updateScrollBtn() {
    if (!el.scrollBottom) return;
    el.scrollBottom.hidden = nearBottom();
  }

  /* ---------------- streaming paint ---------------- */

  var paintQueued = false;

  function schedulePaint(asst) {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(function () {
      paintQueued = false;
      paintStream(asst);
    });
  }

  function paintStream(asst) {
    var node = el.messages.querySelector('.msg[data-stream] .content');
    if (!node) return;
    node.innerHTML = MD.render(asst.content) + '<span class="cursor"></span>';
    if (state.stick) el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
  }

  /* ---------------- API ---------------- */

  function ApiError(message, status) {
    this.name = 'ApiError';
    this.message = message || 'Kesalahan API';
    this.status = status || 0;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function abortError() {
    var e = new Error('Dibatalkan');
    e.name = 'AbortError';
    return e;
  }

  function endpoint(base) {
    var b = String(base || state.settings.baseUrl || '').trim().replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(b)) return b;
    return b + '/chat/completions';
  }

  function buildMessages(conv) {
    var s = state.settings;
    var out = [];
    if (s.systemPrompt && s.systemPrompt.trim()) {
      out.push({ role: 'system', content: s.systemPrompt.trim() });
    }
    var hist = conv.messages.filter(function (m) {
      return !m.pending && !m.error && m.content && m.content.trim();
    });
    if (hist.length > 30) hist = hist.slice(-30);
    hist.forEach(function (m) { out.push({ role: m.role, content: m.content }); });
    return out;
  }

  function extractDelta(json) {
    if (!json || !json.choices || !json.choices.length) return '';
    var ch = json.choices[0];
    if (ch.delta) {
      if (typeof ch.delta.content === 'string') return ch.delta.content;
      if (Array.isArray(ch.delta.content)) {
        return ch.delta.content.map(function (p) { return p && p.text ? p.text : ''; }).join('');
      }
    }
    if (typeof ch.text === 'string') return ch.text;
    if (ch.message && typeof ch.message.content === 'string') return ch.message.content;
    return '';
  }

  function extractContent(data) {
    if (!data) return '';
    if (data.error) throw new ApiError(data.error.message || 'Kesalahan API', 500);
    if (data.choices && data.choices.length) {
      var ch = data.choices[0];
      var m = ch.message || {};
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        return m.content.map(function (p) { return p && p.text ? p.text : ''; }).join('');
      }
      if (typeof ch.text === 'string') return ch.text;
    }
    return '';
  }

  function readError(res) {
    return res.text().then(function (text) {
      var msg = '';
      try {
        var j = JSON.parse(text);
        if (j && j.error) msg = j.error.message || j.error.type || '';
        else if (j && j.message) msg = j.message;
      } catch (e) { /* bukan JSON */ }
      if (!msg) msg = String(text || '').slice(0, 300);
      return msg || ('HTTP ' + res.status);
    }).catch(function () { return 'HTTP ' + res.status; });
  }

  async function apiStream(conv, asst, signal) {
    var s = state.settings;
    var headers = { 'Content-Type': 'application/json' };
    if (s.apiKey && s.apiKey.trim()) headers.Authorization = 'Bearer ' + s.apiKey.trim();
    if (/openrouter\.ai/i.test(s.baseUrl)) {
      headers['HTTP-Referer'] = location.origin;
      headers['X-Title'] = 'Agung AI';
    }

    var body = {
      model: s.model,
      messages: buildMessages(conv),
      temperature: Number(s.temperature),
      max_tokens: Number(s.maxTokens) || 1024,
      stream: !!s.stream
    };

    var res;
    try {
      res = await fetch(endpoint(), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('NETWORK');
    }

    if (!res.ok) {
      var msg = await readError(res);
      throw new ApiError(msg, res.status);
    }

    var ct = String(res.headers.get('content-type') || '').toLowerCase();
    var canStream = s.stream && res.body && ct.indexOf('application/json') === -1;

    if (!canStream) {
      var data = await res.json();
      asst.content = extractContent(data);
      schedulePaint(asst);
      return;
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder('utf-8');
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      var lines = buffer.split('\n');
      buffer = lines.pop();

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.charAt(0) === ':') continue;
        if (line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') return;

        var json;
        try { json = JSON.parse(payload); } catch (e) { continue; }
        if (json && json.error) throw new ApiError(json.error.message || 'Kesalahan API', 500);

        var delta = extractDelta(json);
        if (delta) {
          asst.content += delta;
          schedulePaint(asst);
        }
      }
    }
  }

  /* ---------------- mode demo ---------------- */

  function lastUserText() {
    var conv = activeConvo();
    if (!conv) return '';
    for (var i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'user') return conv.messages[i].content;
    }
    return '';
  }

  function demoReply(text) {
    var t = String(text || '').toLowerCase();
    var quote = String(text || '').trim().slice(0, 220);
    if (String(text || '').trim().length > 220) quote += '…';

    var head = 'Halo! 👋 Saya **Agung AI**, masih berjalan dalam **mode demo** karena belum ada API key yang tersambung.\n\n';

    if (/^(halo|hai|hi|hello|pagi|siang|sore|malam|assalam|selamat)/.test(t)) {
      return head +
        'Saya sudah siap dipakai. Untuk mengaktifkan AI sungguhan:\n\n' +
        '1. Buka **Pengaturan** (ikon gerigi di kanan atas).\n' +
        '2. Pilih penyedia — misalnya **OpenRouter** (banyak model gratis) atau **Groq** (cepat).\n' +
        '3. Tempel **API key**, klik **Tes koneksi**, lalu **Simpan**.\n\n' +
        'Setelah itu semua jawaban akan datang dari model AI pilihan Anda. Mau mulai dari mana?';
    }

    if (/(kode|code|javascript|python|fungsi|function|program|error|bug|script)/.test(t)) {
      return head +
        'Sambil menunggu, ini contoh format jawaban kode yang nanti Anda terima:\n\n' +
        '```js\n' +
        'function sapa(nama) {\n' +
        '  return `Halo, ${nama}! Selamat datang di Agung AI.`;\n' +
        '}\n\n' +
        'console.log(sapa("Agung"));\n' +
        '```\n\n' +
        'Aktifkan API key di **Pengaturan** untuk jawaban yang benar-benar dibuat oleh model AI.';
    }

    return head +
      'Pesan Anda saya terima:\n\n> ' + quote.replace(/\n/g, '\n> ') + '\n\n' +
      'Karena belum ada API key, saya belum bisa menjawab dengan AI sungguhan. Langkah mengaktifkannya:\n\n' +
      '1. Buka **Pengaturan** → pilih penyedia.\n' +
      '2. Isi **API key** → **Tes koneksi** → **Simpan**.\n' +
      '3. Kirim ulang pertanyaan Anda.\n\n' +
      '> 🔒 API key hanya disimpan di browser ini dan hanya dikirim ke alamat API yang Anda isi.\n\n' +
      'Pilihan gratis yang mudah: **OpenRouter** (model `:free`) atau **Groq**. Bisa juga **Ollama** di komputer sendiri tanpa key.';
  }

  async function demoStream(asst, signal) {
    var reply = demoReply(lastUserText());
    var tokens = reply.split(/(\s+)/);
    var buf = '';

    for (var i = 0; i < tokens.length; i++) {
      if (signal.aborted) throw abortError();
      buf += tokens[i];
      if (i % 3 === 0 || i === tokens.length - 1) {
        asst.content = buf;
        schedulePaint(asst);
        await sleep(14 + Math.random() * 20);
      }
    }
    asst.content = reply;
  }

  /* ---------------- alur jawaban ---------------- */

  function errorMessage(err) {
    if (err && err.name === 'ApiError') {
      var extra = '';
      if (err.status === 401 || err.status === 403) extra = '\n\nPeriksa **API key** di Pengaturan.';
      else if (err.status === 404) extra = '\n\nModel atau Base URL mungkin salah. Pastikan URL berakhir dengan `/v1` dan nama model benar.';
      else if (err.status === 429) extra = '\n\nKuota atau rate limit tercapai. Tunggu sebentar, lalu coba lagi.';
      else if (err.status >= 500) extra = '\n\nServer penyedia sedang bermasalah. Coba lagi nanti.';
      return '**Gagal memanggil API (' + err.status + ').**\n\n' + (err.message || '') + extra;
    }
    if (err && err.message === 'NETWORK') {
      return '**Tidak bisa terhubung ke API.**\n\nPeriksa koneksi internet, Base URL, dan apakah penyedia mengizinkan permintaan langsung dari browser (CORS).';
    }
    return '**Terjadi kesalahan.**\n\n' + (err && err.message ? err.message : 'Tidak diketahui.');
  }

  async function runAssistant(conv) {
    var asst = {
      role: 'assistant',
      content: '',
      at: now(),
      pending: true,
      model: state.settings.model
    };
    conv.messages.push(asst);
    conv.updatedAt = now();
    state.stick = true;

    renderChat();
    scrollToBottom(true);

    var controller = new AbortController();
    state.abort = controller;
    state.streaming = true;
    updateSendState();

    try {
      if (isDemo()) {
        await demoStream(asst, controller.signal);
      } else {
        await apiStream(conv, asst, controller.signal);
      }
      if (!asst.content.trim()) {
        asst.content = '_(Tidak ada jawaban dari model. Coba lagi atau ganti model di Pengaturan.)_';
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        if (!asst.content) asst.content = '_(Dihentikan.)_';
      } else {
        asst.error = true;
        asst.content = errorMessage(err);
      }
    } finally {
      asst.pending = false;
      state.streaming = false;
      state.abort = null;
      conv.updatedAt = now();
      saveConvos();
      renderChat();
      renderConvList();
      updateSendState();
      updateModeUI();
      autoScrollAfter();
    }
  }

  function autoScrollAfter() {
    if (state.stick) {
      el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
    }
    updateScrollBtn();
  }

  function makeTitle(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length > 48) t = t.slice(0, 48).trim() + '…';
    return t || 'Chat baru';
  }

  function sendMessage(text) {
    var conv = ensureConvo();
    conv.messages.push({ role: 'user', content: text, at: now() });
    if (!conv.title) conv.title = makeTitle(text);
    conv.updatedAt = now();

    saveConvos();
    renderConvList();
    renderChat();
    scrollToBottom(true);
    closeSidebar();

    runAssistant(conv);
  }

  function handleSend() {
    if (state.streaming) { stopStreaming(); return; }
    var text = el.input.value.trim();
    if (!text) return;
    el.input.value = '';
    autoResize();
    updateSendState();
    sendMessage(text);
  }

  function stopStreaming() {
    if (state.abort) {
      try { state.abort.abort(); } catch (e) {}
    }
  }

  function regenerate() {
    if (state.streaming) return;
    var conv = activeConvo();
    if (!conv) return;
    var idx = -1;
    for (var i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'assistant') { idx = i; break; }
    }
    if (idx < 0) return;
    conv.messages.splice(idx);
    saveConvos();
    renderChat();
    runAssistant(conv);
  }

  /* ---------------- composer ---------------- */

  function autoResize() {
    if (!el.input) return;
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 200) + 'px';
  }

  function updateSendState() {
    var btn = el.sendBtn;
    if (!btn) return;
    if (state.streaming) {
      btn.disabled = false;
      btn.classList.add('is-stop');
      btn.title = 'Hentikan jawaban';
      btn.setAttribute('aria-label', 'Hentikan jawaban');
    } else {
      btn.classList.remove('is-stop');
      btn.disabled = !el.input.value.trim();
      btn.title = 'Kirim pesan';
      btn.setAttribute('aria-label', 'Kirim pesan');
    }
  }

  /* ---------------- toast & salin ---------------- */

  var toastTimer = null;

  function toast(msg, isErr) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.className = 'toast show' + (isErr ? ' err' : '');
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('show');
      setTimeout(function () { el.toast.hidden = true; }, 240);
    }, 2600);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }

  function flash(btn, label) {
    var old = btn.innerHTML;
    btn.textContent = label;
    setTimeout(function () { btn.innerHTML = old; }, 1200);
  }

  /* ---------------- dialog internal ---------------- */

  var askResolve = null;

  function showAsk(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var modal = $('#askModal');
      var input = $('#askInput');
      var ok = $('#askOk');
      var msg = $('#askMessage');
      var hasInput = opts.input !== false;

      $('#askTitle').textContent = opts.title || 'Konfirmasi';
      msg.textContent = opts.message || '';
      msg.hidden = !opts.message;

      input.hidden = !hasInput;
      input.value = opts.value || '';
      input.placeholder = opts.placeholder || '';

      ok.textContent = opts.confirmText || (hasInput ? 'Simpan' : 'Lanjutkan');
      ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');

      askResolve = resolve;
      modal.hidden = false;

      setTimeout(function () {
        try {
          if (hasInput) { input.focus(); input.select(); }
          else ok.focus();
        } catch (e) {}
      }, 60);
    });
  }

  function closeAsk(result) {
    var modal = $('#askModal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    var resolve = askResolve;
    askResolve = null;
    if (resolve) resolve(result);
  }

  function askValue() {
    var input = $('#askInput');
    if (input.hidden) { closeAsk(true); return; }
    var v = input.value.trim();
    if (!v) { input.focus(); return; }
    closeAsk(v);
  }

  /* ---------------- unduh ---------------- */

  function download(filename, content, type) {
    var blob = new Blob([content], { type: (type || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportChat() {
    var conv = activeConvo();
    if (!conv || !conv.messages.length) { toast('Belum ada chat untuk diekspor.'); return; }
    var out = '# ' + (conv.title || 'Percakapan') + '\n\n';
    out += '_' + new Date(conv.createdAt || now()).toLocaleString('id-ID') + ' · ' + state.settings.model + '_\n\n';
    conv.messages.forEach(function (m) {
      if (m.pending || !m.content) return;
      out += '## ' + (m.role === 'user' ? 'Kamu' : 'Agung AI') + '\n\n' + m.content + '\n\n';
    });
    download((conv.title || 'agung-ai').replace(/[\\/:*?"<>|]+/g, '-') + '.md', out, 'text/markdown');
    toast('Chat diekspor sebagai Markdown.');
  }

  function exportAll() {
    if (!state.convos.length) { toast('Belum ada data untuk diekspor.'); return; }
    var safe = normalizeSettings(state.settings);
    safe.apiKey = '';
    download(
      'agung-ai-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify({ exportedAt: new Date().toISOString(), settings: safe, conversations: state.convos }, null, 2),
      'application/json'
    );
    toast('Backup JSON dibuat (tanpa API key).');
  }

  /* ---------------- pengaturan ---------------- */

  var lastFocus = null;

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }

  function normalizeBase(v) {
    var s = String(v || '').trim().replace(/\s+/g, '');
    if (!s) return '';
    s = s.replace(/\/+$/, '');
    s = s.replace(/\/chat\/completions$/i, '');
    if (!/^https?:\/\//i.test(s)) {
      if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(s)) s = 'http://' + s;
      else s = 'https://' + s;
    }
    return s;
  }

  function activePresetId(url) {
    var u = normalizeBase(url).toLowerCase();
    if (!u) return 'custom';
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id !== 'custom' && normalizeBase(PRESETS[i].baseUrl).toLowerCase() === u) return PRESETS[i].id;
    }
    return 'custom';
  }

  function buildChips() {
    if (!el.presetChips) return;
    el.presetChips.innerHTML = '';
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.preset = p.id;
      b.textContent = p.name;
      el.presetChips.appendChild(b);
    });
  }

  function markChips(id) {
    if (!el.presetChips) return;
    Array.prototype.forEach.call(el.presetChips.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('active', c.dataset.preset === id);
    });
  }

  function updateModelList(models) {
    if (!el.modelList) return;
    el.modelList.innerHTML = '';
    (models || []).forEach(function (m) {
      var o = document.createElement('option');
      o.value = m;
      el.modelList.appendChild(o);
    });
  }

  function fillSettingsForm(s) {
    el.baseUrl.value = s.baseUrl || '';
    el.apiKey.value = s.apiKey || '';
    el.modelInput.value = s.model || '';
    el.systemPrompt.value = s.systemPrompt || '';
    el.temperature.value = String(s.temperature);
    el.tempVal.textContent = Number(s.temperature).toFixed(1);
    el.maxTokens.value = String(s.maxTokens);
    el.streamToggle.checked = !!s.stream;
    el.testResult.hidden = true;
    el.testResult.className = 'test-result';
    el.testResult.textContent = '';

    var id = activePresetId(s.baseUrl);
    var p = presetById(id);
    el.apiKey.placeholder = (p && p.keyHint) || 'Tempel API key di sini';
    updateModelList(p ? p.models : []);
    markChips(id);
  }

  function readSettingsForm() {
    return {
      preset: activePresetId(el.baseUrl.value),
      baseUrl: normalizeBase(el.baseUrl.value),
      apiKey: el.apiKey.value.trim(),
      model: el.modelInput.value.trim(),
      systemPrompt: el.systemPrompt.value,
      temperature: clamp(parseFloat(el.temperature.value) || 0, 0, 2),
      maxTokens: clamp(parseInt(el.maxTokens.value, 10) || 1024, 64, 32000),
      stream: el.streamToggle.checked
    };
  }

  function openSettings() {
    fillSettingsForm(state.settings);
    lastFocus = document.activeElement;
    el.modal.hidden = false;
    if (window.innerWidth > 760) {
      setTimeout(function () { try { el.baseUrl.focus(); } catch (e) {} }, 60);
    }
  }

  function closeSettings() {
    el.modal.hidden = true;
    if (lastFocus && lastFocus.focus) {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  function saveSettingsFromForm() {
    var s = readSettingsForm();
    if (!s.baseUrl) { toast('Base URL wajib diisi.', true); el.baseUrl.focus(); return; }
    if (!s.model) { toast('Nama model wajib diisi.', true); el.modelInput.focus(); return; }
    state.settings = normalizeSettings(s);
    writeJSON(K.settings, state.settings);
    updateModeUI();
    closeSettings();
    toast(isDemo() ? 'Disimpan. Mode demo masih aktif karena API key kosong.' : 'Pengaturan disimpan.');
  }

  function testConnection() {
    var s = readSettingsForm();
    var out = el.testResult;
    out.hidden = false;
    out.className = 'test-result';
    out.textContent = 'Menghubungkan...';

    if (!s.baseUrl) {
      out.className = 'test-result err';
      out.textContent = 'Base URL masih kosong.';
      return;
    }

    el.testBtn.disabled = true;
    var headers = {};
    if (s.apiKey) headers.Authorization = 'Bearer ' + s.apiKey;

    fetch(s.baseUrl + '/models', { headers: headers })
      .then(function (res) {
        if (res.ok) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            var n = data && data.data && data.data.length;
            out.className = 'test-result ok';
            out.textContent = 'Terhubung ✓' + (n ? ' ' + n + ' model tersedia.' : '') +
              (s.model ? ' Model di form: ' + s.model + '.' : '');
          });
        }
        if (res.status === 404 || res.status === 405) {
          return fetch(endpoint(s.baseUrl), {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
            body: JSON.stringify({
              model: s.model,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 1,
              stream: false
            })
          }).then(function (r2) {
            if (r2.ok) {
              out.className = 'test-result ok';
              out.textContent = 'Terhubung ✓ (endpoint /models tidak tersedia, tapi chat berhasil).';
              return;
            }
            return readError(r2).then(function (m) {
              out.className = 'test-result err';
              out.textContent = 'Gagal (' + r2.status + '): ' + m;
            });
          });
        }
        return readError(res).then(function (m) {
          out.className = 'test-result err';
          out.textContent = 'Gagal (' + res.status + '): ' + m;
        });
      })
      .catch(function () {
        out.className = 'test-result err';
        out.textContent = 'Tidak bisa terhubung. Cek Base URL, koneksi, atau CORS penyedia.';
      })
      .then(function () {
        el.testBtn.disabled = false;
      });
  }

  /* ---------------- sidebar ---------------- */

  function openSidebar() {
    el.app.classList.add('sidebar-open');
    el.scrim.hidden = false;
  }

  function closeSidebar() {
    el.app.classList.remove('sidebar-open');
    el.scrim.hidden = true;
  }

  function selectConvo(id) {
    state.activeId = id;
    state.stick = true;
    saveConvos();
    renderConvList();
    renderChat();
    scrollToBottom(true);
    closeSidebar();
    if (window.innerWidth > 900) {
      try { el.input.focus(); } catch (e) {}
    }
  }

  function renameConvo(id) {
    var conv = null;
    state.convos.forEach(function (c) { if (c.id === id) conv = c; });
    if (!conv) return;
    showAsk({
      title: 'Ganti nama chat',
      value: conv.title || '',
      placeholder: 'Nama chat',
      confirmText: 'Simpan'
    }).then(function (name) {
      if (name === null) return;
      conv.title = String(name).slice(0, 80);
      conv.updatedAt = now();
      saveConvos();
      renderConvList();
      if (conv.id === state.activeId) renderChat();
      toast('Nama chat diperbarui.');
    });
  }

  function deleteConvo(id) {
    var conv = null;
    state.convos.forEach(function (c) { if (c.id === id) conv = c; });
    if (!conv) return;
    showAsk({
      title: 'Hapus chat?',
      message: '“' + (conv.title || 'Tanpa judul') + '” akan dihapus permanen.',
      input: false,
      confirmText: 'Hapus',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      state.convos = state.convos.filter(function (c) { return c.id !== id; });
      if (state.activeId === id) state.activeId = state.convos.length ? state.convos[0].id : null;
      saveConvos();
      renderConvList();
      renderChat();
      if (state.activeId) scrollToBottom(true);
      toast('Chat dihapus.');
    });
  }

  /* ---------------- event ---------------- */

  function bindEvents() {
    /* sidebar */
    el.newChat.addEventListener('click', function () {
      state.activeId = null;
      state.stick = true;
      saveConvos();
      renderConvList();
      renderChat();
      closeSidebar();
      try { el.input.focus(); } catch (e) {}
    });

    el.searchInput.addEventListener('input', function () {
      state.query = el.searchInput.value.trim();
      renderConvList();
    });

    el.convList.addEventListener('click', function (e) {
      var actBtn = e.target.closest('[data-act]');
      var item = e.target.closest('.conv-item');
      if (!item) return;
      var id = item.dataset.id;
      if (actBtn) {
        e.stopPropagation();
        if (actBtn.dataset.act === 'rename') renameConvo(id);
        else if (actBtn.dataset.act === 'delete') deleteConvo(id);
        return;
      }
      selectConvo(id);
    });

    el.convList.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var item = e.target.closest('.conv-item');
      if (!item) return;
      e.preventDefault();
      selectConvo(item.dataset.id);
    });

    el.openSidebar.addEventListener('click', openSidebar);
    el.closeSidebar.addEventListener('click', closeSidebar);
    el.scrim.addEventListener('click', closeSidebar);

    /* tema */
    $('#toggleTheme').addEventListener('click', function () {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    /* composer */
    el.composer.addEventListener('submit', function (e) {
      e.preventDefault();
      handleSend();
    });

    el.input.addEventListener('input', function () {
      autoResize();
      updateSendState();
    });

    el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!state.streaming) handleSend();
      }
    });

    /* saran */
    Array.prototype.forEach.call(document.querySelectorAll('.sug'), function (btn) {
      btn.addEventListener('click', function () {
        el.input.value = btn.dataset.prompt || '';
        autoResize();
        updateSendState();
        el.input.focus();
        handleSend();
      });
    });

    /* scroll */
    el.chatScroll.addEventListener('scroll', function () {
      state.stick = nearBottom();
      updateScrollBtn();
    });

    el.scrollBottom.addEventListener('click', function () {
      state.stick = true;
      el.chatScroll.scrollTo({ top: el.chatScroll.scrollHeight, behavior: 'smooth' });
      updateScrollBtn();
    });

    /* aksi pesan */
    el.messages.addEventListener('click', function (e) {
      var copyCode = e.target.closest('.copy-code');
      if (copyCode) {
        var codeEl = copyCode.closest('.codeblock').querySelector('code');
        copyText(codeEl ? codeEl.textContent : '').then(function () {
          flash(copyCode, 'Tersalin ✓');
        });
        return;
      }

      var actBtn = e.target.closest('[data-act]');
      if (!actBtn) return;
      var msgEl = actBtn.closest('.msg');
      if (!msgEl) return;
      var idx = Number(msgEl.dataset.idx);
      var conv = activeConvo();
      if (!conv || !conv.messages[idx]) return;

      if (actBtn.dataset.act === 'copy') {
        copyText(conv.messages[idx].content).then(function () {
          flash(actBtn, 'Tersalin ✓');
          toast('Pesan disalin.');
        });
      } else if (actBtn.dataset.act === 'regen') {
        regenerate();
      }
    });

    /* ekspor */
    $('#exportBtn').addEventListener('click', exportChat);
    $('#exportAllBtn').addEventListener('click', exportAll);

    /* modal */
    $('#openSettings').addEventListener('click', openSettings);
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#modelPill').addEventListener('click', openSettings);
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#cancelBtn').addEventListener('click', closeSettings);

    el.modal.addEventListener('click', function (e) {
      if (e.target === el.modal) closeSettings();
    });

    /* dialog internal */
    $('#askOk').addEventListener('click', askValue);
    $('#askCancel').addEventListener('click', function () { closeAsk(null); });
    $('#askClose').addEventListener('click', function () { closeAsk(null); });
    $('#askInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); askValue(); }
    });
    $('#askModal').addEventListener('click', function (e) {
      if (e.target === $('#askModal')) closeAsk(null);
    });

    $('#saveBtn').addEventListener('click', saveSettingsFromForm);
    el.testBtn.addEventListener('click', testConnection);

    $('#resetBtn').addEventListener('click', function () {
      var keepKey = el.apiKey.value;
      fillSettingsForm(Object.assign({}, DEFAULT_SETTINGS, { apiKey: keepKey }));
      toast('Form dikembalikan ke default.');
    });

    $('#clearAllBtn').addEventListener('click', function () {
      if (!state.convos.length) { toast('Belum ada chat.'); return; }
      if (!window.confirm('Hapus SEMUA chat? Tindakan ini tidak bisa dibatalkan.')) return;
      state.convos = [];
      state.activeId = null;
      saveConvos();
      renderConvList();
      renderChat();
      toast('Semua chat dihapus.');
    });

    el.temperature.addEventListener('input', function () {
      el.tempVal.textContent = Number(el.temperature.value).toFixed(1);
    });

    el.toggleKey.addEventListener('click', function () {
      var show = el.apiKey.type === 'password';
      el.apiKey.type = show ? 'text' : 'password';
      el.toggleKey.title = show ? 'Sembunyikan' : 'Tampilkan';
    });

    el.presetChips.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var p = presetById(chip.dataset.preset);
      if (!p) return;
      markChips(p.id);
      if (p.id === 'custom') {
        try { el.baseUrl.focus(); } catch (e2) {}
        return;
      }
      el.baseUrl.value = p.baseUrl;
      if (p.models.length) el.modelInput.value = p.models[0];
      el.apiKey.placeholder = p.keyHint || 'Tempel API key di sini';
      updateModelList(p.models);
      el.testResult.hidden = true;
    });

    el.baseUrl.addEventListener('input', function () {
      var id = activePresetId(el.baseUrl.value);
      markChips(id);
      var p = presetById(id);
      if (p && p.models.length) updateModelList(p.models);
    });

    /* pintasan papan tombol */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!document.querySelector('#askModal').hidden) { closeAsk(null); return; }
        if (!el.modal.hidden) { closeSettings(); return; }
        closeSidebar();
        return;
      }
      var mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (window.innerWidth <= 900) openSidebar();
        try { el.searchInput.focus(); } catch (e2) {}
      }
      if (mod && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        el.newChat.click();
      }
    });
  }

  /* ---------------- init ---------------- */

  function init() {
    applyTheme(state.theme);
    buildChips();
    updateModeUI();
    renderConvList();
    renderChat();
    bindEvents();
    autoResize();
    updateSendState();
    updateScrollBtn();

    if (state.convos.length && state.activeId) scrollToBottom(true);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline opsional */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
