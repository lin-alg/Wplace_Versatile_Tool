// ==UserScript==
// @name         Wplace Locator
// @namespace    http://tampermonkey.net/
// @version      1.2.5
// @description  Detect backend pixel requests, extract TlX,TlY,PxX,PxY; provide Share & Jump UI; persist safe size/pos; S toggles minimize/restore. Auto-fill external page inputs after jump/refresh. Powered by lin-alg.
// @match        https://*.wplace.live/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------- i18n ----------
  const lang = (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const I = {
    en: {
      title: 'Wplace Locator',
      hint: 'Press S to minimize this window; drag the bottom right corner to resize the window.',
      share: 'Share',
      jump: 'Jump',
      more_version: 'More features version',
      placeholder: 'TlX, TlY, PxX, PxY (e.g. 1677,888,158,952)',
      copied: 'Copied to clipboard:',
      no_share: 'No coords captured yet',
      copy_fail: 'Copy failed',
      invalid_input: 'Invalid coords',
      nav_blocked: 'Navigation blocked',
      captured: 'Captured',
      minimized: 'Minimized',
      restored: 'Restored',
      powered_by: 'Powered by lin-alg',
      autofilled: 'Auto-filled external inputs'
    },
    zh: {
      title: 'Wplace 定位器',
      hint: '按S最小化此窗口，拖动右下角可调节窗口大小',
      share: '分享',
      jump: '跳转',
      more_version: '更多功能的版本',
      placeholder: 'TlX, TlY, PxX, PxY，例如 1677,888,158,952',
      copied: '已复制到剪贴板：',
      no_share: '尚未捕获坐标',
      copy_fail: '复制失败',
      invalid_input: '坐标无效',
      nav_blocked: '导航被阻止',
      captured: '已捕获',
      minimized: '已最小化',
      restored: '已恢复',
      powered_by: 'Powered by lin-alg',
      autofilled: '已填写外部输入框'
    }
  };
  const t = key => (I[lang] && I[lang][key]) || I.en[key];

  // ---------- styles ----------
  GM_addStyle(`
    #wplace_net_panel { position: fixed; right: 18px; bottom: 18px; width: 340px; max-width: 92vw;
      background: rgba(18,18,18,0.96); color:#e8e8e8; border-radius:10px; padding:8px;
      box-shadow:0 8px 26px rgba(0,0,0,.6); font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial;
      z-index:2147483647; user-select:none; box-sizing:border-box; }
    #wplace_net_panel.hidden { display: none !important; }
    #wplace_net_panel .row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    #wplace_net_panel input { flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);
      background:transparent; color:#e8e8e8; outline:none; box-sizing:border-box; min-width:0; }
    .wplace_btn { padding:8px 10px; border-radius:8px; border:none; cursor:pointer; background:rgba(255,255,255,0.04); color:inherit; font-weight:600; }
    .wplace_btn.ghost { background: rgba(255,255,255,0.03); color: #e8e8e8 !important; border: 1px solid rgba(255,255,255,0.03); }
    #wplace_net_toast { position: absolute; left:10px; right:10px; bottom:8px; background: rgba(0,0,0,0.6);
      color:#fff; padding:6px 8px; border-radius:6px; text-align:center; display:none; font-size:13px; }
    #wplace_net_title { font-weight:700; margin-bottom:6px; font-size:13px; text-align:center; }
    #wplace_net_hint { font-size:12px; color:#9aa0a6; margin-bottom:6px; text-align:center; }
    #wplace_powered_by { text-align:center; font-size:11px; color:#7f8c8d; margin-top:6px; }
    /* resize handle visual (optional) */
    #wplace_net_panel .resize-handle { position:absolute; right:6px; bottom:6px; width:14px; height:14px; opacity:0.8; cursor:nwse-resize; }
  `);

  // ---------- IDs and keys ----------
  const PANEL_ID = 'wplace_net_panel';
  const LSK_COORDS = 'wplace_pending_coords';
  const LSK_POS = 'wplace_net_panel_pos_v2';
  const LSK_SIZE = 'wplace_net_panel_size_v1';
  const LSK_MIN = 'wplace_net_minimized_v1';
  const MORE_URL = 'https://github.com/lin-alg/Wplace_Versatile_Tool';

  // ---------- create UI ----------
  if (document.getElementById(PANEL_ID)) return;
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div id="wplace_net_title">${t('title')}</div>
    <div id="wplace_net_hint">${t('hint')}</div>
    <div class="row">
      <button id="wplace_share_btn" class="wplace_btn">${t('share')}</button>
      <button id="wplace_jump_btn" class="wplace_btn ghost">${t('jump')}</button>
      <button id="wplace_more_btn" class="wplace_btn ghost">${t('more_version')}</button>
    </div>
    <div class="row">
      <input id="wplace_coords_input" placeholder="${t('placeholder')}" aria-label="Wplace coords input" />
    </div>
    <div id="wplace_powered_by">${t('powered_by')}</div>
    <div id="wplace_net_toast" aria-live="polite"></div>
    <div class="resize-handle" aria-hidden="true"></div>
  `;
  document.body.appendChild(panel);

  const shareBtn = panel.querySelector('#wplace_share_btn');
  const jumpBtn = panel.querySelector('#wplace_jump_btn');
  const moreBtn = panel.querySelector('#wplace_more_btn');
  const inputEl = panel.querySelector('#wplace_coords_input');
  const toast = panel.querySelector('#wplace_net_toast');
  const resizeHandle = panel.querySelector('.resize-handle');

  function showToast(msg, ms = 2200) {
    try {
      toast.textContent = msg;
      toast.style.display = 'block';
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { toast.style.display = 'none'; }, ms);
    } catch (e) { console.log(msg); }
  }

  // ---------- safe size/position handling ----------
  (function installSafeSizeHandlers(rootEl) {
    if (!rootEl) return;
    const DEFAULT = { width: 356, height: 181 };
    const MIN = { width: 280, height: 181 };
    const MAX_PADDING = 12;

    function clampSize(w, h) {
      const vw = Math.max(200, window.innerWidth - MAX_PADDING);
      const vh = Math.max(120, window.innerHeight - MAX_PADDING);
      const W = Math.min(Math.max(Math.round(w || DEFAULT.width), MIN.width), vw);
      const H = Math.min(Math.max(Math.round(h || DEFAULT.height), MIN.height), vh);
      return { W, H };
    }

    function clampPos(left, top, w, h) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const minLeft = Math.max(-w + 40, 8);
      const maxLeft = Math.max(8, vw - 8);
      const minTop = Math.max(-h + 40, 8);
      const maxTop = Math.max(8, vh - 8);
      const L = Math.min(Math.max(Math.round(left), minLeft), Math.max(8, vw - Math.min(w, vw) - 8 + Math.min(w, vw)));
      const T = Math.min(Math.max(Math.round(top), minTop), Math.max(8, vh - Math.min(h, vh) - 8 + Math.min(h, vh)));
      return { L, T };
    }

    function applySize(w, h, persist = true) {
      try {
        const { W, H } = clampSize(w, h);
        rootEl.style.width = W + 'px';
        rootEl.style.height = H + 'px';
        rootEl.style.boxSizing = 'border-box';
        if (persist) {
          try { localStorage.setItem(LSK_SIZE, JSON.stringify({ width: W, height: H })); } catch (e) {}
        }
        clampPositionIntoView();
      } catch (e) {}
    }

    function clampPositionIntoView() {
      try {
        const rect = rootEl.getBoundingClientRect();
        const w = rect.width || DEFAULT.width;
        const h = rect.height || DEFAULT.height;
        let left = rect.left || 8;
        let top = rect.top || (window.innerHeight - h - 18);
        const p = clampPos(left, top, w, h);
        rootEl.style.left = p.L + 'px';
        rootEl.style.top = p.T + 'px';
        rootEl.style.right = 'auto';
        rootEl.style.bottom = 'auto';
        try { localStorage.setItem(LSK_POS, JSON.stringify({ left: p.L, top: p.T })); } catch (e) {}
      } catch (e) {}
    }

    async function loadSizeAndPosition() {
      let size = null, pos = null;
      try {
        if (window.chrome && chrome.storage && chrome.storage.local) {
          const res = await new Promise(r => chrome.storage.local.get([LSK_SIZE, LSK_POS], r));
          if (res && res[LSK_SIZE]) size = res[LSK_SIZE];
          if (res && res[LSK_POS]) pos = res[LSK_POS];
        }
      } catch (e) {}
      if (!size) {
        try { const raw = localStorage.getItem(LSK_SIZE); if (raw) size = JSON.parse(raw); } catch (e) {}
      }
      if (!pos) {
        try { const raw = localStorage.getItem(LSK_POS); if (raw) pos = JSON.parse(raw); } catch (e) {}
      }

      const s = (size && typeof size.width === 'number' && typeof size.height === 'number') ? size : DEFAULT;
      const clamped = clampSize(s.width, s.height);

      rootEl.style.position = rootEl.style.position || 'fixed';
      applySize(clamped.W, clamped.H, false);

      if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
        const p = clampPos(pos.left, pos.top, clamped.W, clamped.H);
        rootEl.style.left = p.L + 'px';
        rootEl.style.top = p.T + 'px';
      } else {
        clampPositionIntoView();
      }

      // small retry after layout settles
      setTimeout(() => { try { applySize(clamped.W, clamped.H, false); clampPositionIntoView(); } catch(_) {} }, 80);
    }

    // resize handle behavior
    (function installResize() {
      if (!resizeHandle) return;
      let dragging = false, pid = null, sx = 0, sy = 0, sw = 0, sh = 0;
      resizeHandle.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        ev.preventDefault();
        dragging = true;
        pid = ev.pointerId;
        resizeHandle.setPointerCapture && resizeHandle.setPointerCapture(pid);
        sx = ev.clientX; sy = ev.clientY;
        const rect = rootEl.getBoundingClientRect();
        sw = rect.width; sh = rect.height;
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp, { passive: false });
        window.addEventListener('pointercancel', onUp, { passive: false });
      });
      function onMove(ev) {
        if (!dragging || ev.pointerId !== pid) return;
        ev.preventDefault();
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        const newW = sw + dx, newH = sh + dy;
        const { W, H } = clampSize(newW, newH);
        rootEl.style.width = W + 'px';
        rootEl.style.height = H + 'px';
      }
      function onUp(ev) {
        if (!dragging || ev.pointerId !== pid) return;
        dragging = false;
        try { resizeHandle.releasePointerCapture && resizeHandle.releasePointerCapture(pid); } catch (_) {}
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.userSelect = '';
        try {
          const rect = rootEl.getBoundingClientRect();
          applySize(rect.width, rect.height, true);
        } catch (e) {}
      }
    })();

    // window resize -> clamp
    window.addEventListener('resize', () => {
      try {
        const rect = rootEl.getBoundingClientRect();
        const cl = clampSize(rect.width, rect.height);
        applySize(cl.W, cl.H, true);
        clampPositionIntoView();
      } catch (e) {}
    });

    // init
    loadSizeAndPosition();

    // expose small API
    rootEl.__wplace_size_api = { applySize, clampPositionIntoView, loadSizeAndPosition };
  })(panel);

  // ---------- coords helpers ----------
  function setLatestCoordsString(s) {
    try { localStorage.setItem(LSK_COORDS, s); } catch (e) {}
    try { inputEl.value = s; } catch (e) {}
    try { window.__wplace_latest_coords = s; } catch (e) {}
  }
  function getLatestCoordsString() {
    try { const v = inputEl.value && String(inputEl.value).trim(); if (v && v.split(',').map(x => x.trim()).filter(Boolean).length === 4) return v; } catch (e) {}
    try { const v2 = localStorage.getItem(LSK_COORDS); if (v2) return v2; } catch (e) {}
    try { if (window.__wplace_latest_coords) return window.__wplace_latest_coords; } catch (e) {}
    return null;
  }

  function parseFourCoords(str) {
    if (!str) return null;
    const parts = String(str).split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length !== 4) return null;
    const nums = parts.map(s => Number(s));
    if (nums.some(n => Number.isNaN(n))) return null;
    return nums;
  }

  function computeLatLngFromFour(TlX, TlY, PxX, PxY) {
    const X = TlX * 1000 + PxX;
    const Y = TlY * 1000 + PxY;
    const A1 = 1023999.50188499956857413054;
    const B1 = 325949.32345220289425924420;
    const A2 = 1023999.50188501563388854265;
    const B2 = 325949.32345236750552430749;
    const lng = (180 / Math.PI) * ((X - A1) / B1);
    const t = Math.exp((A2 - Y) / B2);
    const lat = (360 / Math.PI) * (Math.atan(t) - Math.PI / 4);
    return { lat, lng };
  }

  async function copyTextToClipboard(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok; } catch (e) { return false; }
  }

  // ---------- Share and Jump handlers ----------
  shareBtn.addEventListener('click', async () => {
    const latest = getLatestCoordsString();
    if (!latest) { showToast(t('no_share')); return; }
    const cleaned = String(latest).split(',').map(s => s.trim()).join(', ');
    const ok = await copyTextToClipboard(cleaned);
    if (ok) showToast(`${t('copied')} ${cleaned}`); else showToast(t('copy_fail'));
  });

  jumpBtn.addEventListener('click', () => {
    const raw = getLatestCoordsString();
    if (!raw) { showToast(t('invalid_input')); return; }
    const parsed = parseFourCoords(raw);
    if (!parsed) { showToast(t('invalid_input')); return; }
    const [tlx, tly, pxx, pxy] = parsed;
    try { localStorage.setItem(LSK_COORDS, parsed.join(',')); } catch (e) {}
    const { lat, lng } = computeLatLngFromFour(tlx, tly, pxx, pxy);
    const latS = Number(lat).toFixed(15).replace(/(?:\.0+|(\.\d+?)0+)$/,"$1");
    const lngS = Number(lng).toFixed(15).replace(/(?:\.0+|(\.\d+?)0+)$/,"$1");
    const url = `https://wplace.live/?lat=${latS}&lng=${lngS}&zoom=15`;
    try { window.location.href = url; } catch (e) { try { top.location.href = url; } catch (e2) { showToast(t('nav_blocked')); } }
  });

  // ---------- More version button handler ----------
  moreBtn.addEventListener('click', () => {
    try {
      // try open in new tab/window first
      const w = window.open(MORE_URL, '_blank');
      if (!w) {
        // fallback to same-tab navigation
        try { window.location.href = MORE_URL; } catch (e) { try { top.location.href = MORE_URL; } catch (e2) { showToast(t('nav_blocked')); } }
      }
    } catch (e) {
      try { window.location.href = MORE_URL; } catch (e2) { showToast(t('nav_blocked')); }
    }
  });

  // ---------- network detection (fetch/XHR/performance) ----------
  // limit to backend.wplace.live host
  const hostPattern = /(^|\.)backend\.wplace\.live$/i;

  function tryExtractFromUrl(u) {
    try {
      const url = new URL(u, location.href);
      if (!hostPattern.test(url.hostname)) return null;
      // match /s0/pixel/{TlX}/{TlY}
      const m = url.pathname.match(/\/s0\/pixel\/(-?\d+)\/(-?\d+)(?:\/)?$/i);
      if (!m) return null;
      const TlX = Number(m[1]), TlY = Number(m[2]);
      const q = url.searchParams;
      let PxX = null, PxY = null;
      if (q.has('x')) PxX = Number(q.get('x'));
      else if (q.has('px')) PxX = Number(q.get('px'));
      if (q.has('y')) PxY = Number(q.get('y'));
      else if (q.has('py')) PxY = Number(q.get('py'));
      if (PxX === null || PxY === null) {
        const nums = [];
        for (const v of q.values()) {
          const n = Number(v);
          if (!Number.isNaN(n)) nums.push(n);
        }
        if (nums.length >= 2) { PxX = PxX === null ? nums[0] : PxX; PxY = PxY === null ? nums[1] : PxY; }
      }
      if ([TlX, TlY, PxX, PxY].some(n => typeof n !== 'number' || Number.isNaN(n))) return null;
      return { TlX, TlY, PxX, PxY };
    } catch (e) { return null; }
  }

  (function patchFetch() {
    try {
      const nativeFetch = window.fetch;
      if (!nativeFetch) return;
      window.fetch = async function(input, init) {
        try {
          const url = (typeof input === 'string') ? input : (input && input.url) || '';
          const method = (init && init.method) ? String(init.method).toUpperCase() : (typeof input === 'object' && input && input.method ? String(input.method).toUpperCase() : 'GET');
          if (method === 'GET' && url) {
            const extracted = tryExtractFromUrl(url);
            if (extracted) {
              const s = `${extracted.TlX},${extracted.TlY},${extracted.PxX},${extracted.PxY}`;
              setLatestCoordsString(s);
              showToast(`${t('captured')} ${s}`, 1200);
            }
          }
        } catch (e) {}
        return nativeFetch.apply(this, arguments);
      };
    } catch (e) {}
  })();

  (function patchXHR() {
    try {
      const X = window.XMLHttpRequest;
      if (!X) return;
      const nativeOpen = X.prototype.open;
      X.prototype.open = function(method, url) {
        try {
          const m = String(method || '').toUpperCase();
          if (m === 'GET' && url) {
            const extracted = tryExtractFromUrl(url);
            if (extracted) {
              const s = `${extracted.TlX},${extracted.TlY},${extracted.PxX},${extracted.PxY}`;
              setLatestCoordsString(s);
              showToast(`${t('captured')} ${s}`, 1200);
            }
          }
        } catch (e) {}
        return nativeOpen.apply(this, arguments);
      };
    } catch (e) {}
  })();

  (function perfObserverFallback() {
    try {
      if (typeof PerformanceObserver === 'function') {
        const obs = new PerformanceObserver((list) => {
          try {
            const entries = list.getEntries();
            for (const en of entries) {
              const u = en.name;
              const extracted = tryExtractFromUrl(u);
              if (extracted) {
                const s = `${extracted.TlX},${extracted.TlY},${extracted.PxX},${extracted.PxY}`;
                setLatestCoordsString(s);
                showToast(`${t('captured')} ${s}`, 1200);
              }
            }
          } catch (e) {}
        });
        obs.observe({ entryTypes: ['resource'] });
      }
    } catch (e) {}
  })();

  (function preloadFromPerformance() {
    try {
      const entries = performance.getEntriesByType('resource') || [];
      for (const en of entries) {
        try {
          const extracted = tryExtractFromUrl(en.name);
          if (extracted) {
            const s = `${extracted.TlX},${extracted.TlY},${extracted.PxX},${extracted.PxY}`;
            setLatestCoordsString(s);
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}
  })();

  // ---------- panel draggable ----------
  (function makePanelDraggable(el) {
    el.style.touchAction = 'none';
    let dragging = false, pid = null, sx = 0, sy = 0, sl = 0, st = 0;
    el.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      if (ev.target && (ev.target.closest('input') || ev.target.closest('button') || ev.target.closest('.resize-handle'))) return;
      ev.preventDefault();
      dragging = true;
      pid = ev.pointerId;
      el.setPointerCapture && el.setPointerCapture(pid);
      sx = ev.clientX; sy = ev.clientY;
      const r = el.getBoundingClientRect();
      sl = r.left; st = r.top;
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp, { passive: false });
      window.addEventListener('pointercancel', onUp, { passive: false });
    });
    function onMove(ev) {
      if (!dragging || ev.pointerId !== pid) return;
      ev.preventDefault();
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      const L = Math.round(sl + dx), T = Math.round(st + dy);
      el.style.left = L + 'px';
      el.style.top = T + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.position = 'fixed';
    }
    function onUp(ev) {
      if (!dragging || ev.pointerId !== pid) return;
      dragging = false;
      try { el.releasePointerCapture && el.releasePointerCapture(pid); } catch (_) {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      try {
        const r = el.getBoundingClientRect();
        localStorage.setItem(LSK_POS, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
      } catch (e) {}
    }
  })(panel);

  // ---------- minimize / restore via S key ----------
  function isTypingElement(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function applyMinimizedState(min) {
    try {
      if (min) {
        panel.classList.add('hidden');
        try { localStorage.setItem(LSK_MIN, '1'); } catch (e) {}
        showToast(t('minimized'), 1200);
      } else {
        panel.classList.remove('hidden');
        try { localStorage.removeItem(LSK_MIN); } catch (e) {}
        showToast(t('restored'), 1200);
        // restore position/size clamp quickly after showing
        try { panel.__wplace_size_api && panel.__wplace_size_api.loadSizeAndPosition && panel.__wplace_size_api.loadSizeAndPosition(); } catch (e) {}
      }
    } catch (e) {}
  }

  // initialize minimized state from storage
  try {
    const raw = localStorage.getItem(LSK_MIN);
    if (raw === '1') panel.classList.add('hidden');
  } catch (e) {}

  window.addEventListener('keydown', (ev) => {
    try {
      if (!ev || !ev.key) return;
      const key = ev.key;
      if (key !== 's' && key !== 'S') return;
      const active = document.activeElement;
      if (isTypingElement(active)) return;
      const isMin = panel.classList.contains('hidden');
      applyMinimizedState(!isMin);
      ev.preventDefault();
      ev.stopPropagation();
    } catch (e) {}
  }, true);

  // ---------- Auto-fill external inputs after navigation/refresh ----------
  // Support two variants:
  // Variant A: ids bm-v, bm-w, bm-x, bm-y
  // Variant B: ids bm-W, bm-X, bm-Y, bm-Z
  // Behavior: when LSK_COORDS exists (set before navigation by jump), on new page load attempt to find these inputs and fill them with the four coords.
  // The script will try immediately on DOMContentLoaded, and then observe DOM mutations for a short period to catch dynamically inserted inputs.
  function tryFillExternalInputsFromStoredCoords() {
    try {
      const raw = localStorage.getItem(LSK_COORDS);
      if (!raw) return false;
      const parsed = parseFourCoords(raw);
      if (!parsed) return false;
      const [TlX, TlY, PxX, PxY] = parsed.map(n => Number(n));

      // candidate groups: array of {ids: [id1,id2,id3,id4], mapTo: [TlX,TlY,PxX,PxY]}
      const groups = [
        { ids: ['bm-v','bm-w','bm-x','bm-y'] }, // provided variant A
        { ids: ['bm-W','bm-X','bm-Y','bm-Z'] }  // provided variant B
      ];

      let filledAny = false;

      for (const g of groups) {
        const els = g.ids.map(id => document.getElementById(id)).filter(Boolean);
        if (els.length === 4) {
          try {
            els[0].value = TlX;
            els[1].value = TlY;
            els[2].value = PxX;
            els[3].value = PxY;

            // also dispatch input/change events to ensure page JS picks up the changes
            for (const el of els) {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }

            filledAny = true;
            // keep coords in storage for potential reuse; do not remove automatically
            showToast(t('autofilled'), 1500);
            break;
          } catch (e) {}
        }
      }

      return filledAny;
    } catch (e) { return false; }
  }

  function setupAutoFillObserver(timeoutMs = 3000) {
    try {
      // immediate attempt
      if (tryFillExternalInputsFromStoredCoords()) return;

      const obs = new MutationObserver((mutList) => {
        try {
          if (tryFillExternalInputsFromStoredCoords()) {
            try { obs.disconnect(); } catch (e) {}
          }
        } catch (e) {}
      });
      obs.observe(document.documentElement || document.body || document, { childList: true, subtree: true });

      // stop observing after timeout
      setTimeout(() => { try { obs.disconnect(); } catch (e) {} }, timeoutMs);
    } catch (e) {}
  }

  // Run autofill on DOMContentLoaded and also if document already ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setupAutoFillObserver(4000);
  } else {
    window.addEventListener('DOMContentLoaded', () => { setupAutoFillObserver(4000); }, { once: true });
  }

  // Also expose a small method to trigger manual autofill from console/pages
  try {
    window.__wplace_try_autofill_external = tryFillExternalInputsFromStoredCoords;
  } catch (e) {}

  // ---------- expose global API ----------
  window.__wplace_netwatch = {
    getLatest: getLatestCoordsString,
    computeLatLngFromFour,
    copyLatest: async function(){ const s = getLatestCoordsString(); if(!s) return false; return await copyTextToClipboard(s); },
    toggleMinimized: function(){ const isMin = panel.classList.contains('hidden'); applyMinimizedState(!isMin); },
    tryFillExternalInputsFromStoredCoords
  };

})();