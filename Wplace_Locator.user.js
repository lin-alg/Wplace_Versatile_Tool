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
      minimized: '最小化',
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
  (function installBallMinimize() {
  try {
    const BALL_ID = 'wplace_net_ball';
    const LSK_BALL_POS = 'wplace_net_ball_pos_v1';

    // add top-right control container
    const ctrl = document.createElement('div');
    ctrl.style.position = 'absolute';
    ctrl.style.right = '8px';
    ctrl.style.top = '8px';
    ctrl.style.display = 'flex';
    ctrl.style.gap = '6px';
    ctrl.style.alignItems = 'center';
    ctrl.style.zIndex = '2147483648';
    ctrl.style.pointerEvents = 'none'; // allow children to control events
    panel.appendChild(ctrl);

    // create minimize-to-ball button (icon-like)
    const minBtn = document.createElement('button');
    minBtn.setAttribute('aria-label', 'minimize to ball');
    minBtn.title = t('minimized');
    minBtn.className = 'wplace_btn ghost';
    minBtn.style.pointerEvents = 'auto';
    minBtn.style.padding = '6px';
    minBtn.style.width = '34px';
    minBtn.style.height = '28px';
    minBtn.style.display = 'inline-flex';
    minBtn.style.alignItems = 'center';
    minBtn.style.justifyContent = 'center';
    minBtn.style.borderRadius = '6px';
    minBtn.style.fontSize = '12px';
    minBtn.textContent = '—';
    ctrl.appendChild(minBtn);

    // create the ball element (hidden by default)
    const ball = document.createElement('div');
    ball.id = BALL_ID;
    ball.style.position = 'fixed';
    ball.style.width = '56px';
    ball.style.height = '56px';
    ball.style.borderRadius = '50%';
    ball.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))';
    ball.style.boxShadow = '0 8px 20px rgba(0,0,0,0.4)';
    ball.style.color = '#e8e8e8';
    ball.style.display = 'none';
    ball.style.alignItems = 'center';
    ball.style.justifyContent = 'center';
    ball.style.zIndex = '2147483647';
    ball.style.cursor = 'pointer';
    ball.style.userSelect = 'none';
    ball.style.fontWeight = '700';
    ball.style.fontSize = '12px';
    ball.style.backdropFilter = 'blur(4px)';
    ball.textContent = 'W';
    document.body.appendChild(ball);

    // load ball pos if exists
    function loadBallPos() {
      try {
        const raw = localStorage.getItem(LSK_BALL_POS);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (typeof o.left === 'number' && typeof o.top === 'number') return o;
      } catch (e) {}
      return null;
    }
    function saveBallPos(left, top) {
      try { localStorage.setItem(LSK_BALL_POS, JSON.stringify({ left: left, top: top })); } catch (e) {}
    }

    // show/hide helpers
    function showBall(left, top) {
      ball.style.left = (left !== undefined ? left : (window.innerWidth - 76)) + 'px';
      ball.style.top = (top !== undefined ? top : (window.innerHeight - 96)) + 'px';
      ball.style.display = 'flex';
    }
    function hideBall() {
      ball.style.display = 'none';
    }

    // drag behavior for ball
    (function makeBallDraggable() {
      let dragging = false, pid = null, sx = 0, sy = 0, sl = 0, st = 0;
      // reset drag flag
      ball._wasDragged = false;

      // detect mobile devices (UA + pointer capability fallback)
      const isMobile = (typeof navigator !== 'undefined' &&
        (/Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)))
        || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

      ball.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        ev.preventDefault();
        dragging = true;
        pid = ev.pointerId;
        ball.setPointerCapture && ball.setPointerCapture(pid);
        sx = ev.clientX; sy = ev.clientY;
        const r = ball.getBoundingClientRect();
        sl = r.left; st = r.top;
        ball._wasDragged = false;
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp, { passive: false });
        window.addEventListener('pointercancel', onUp, { passive: false });
      });

      function onMove(ev) {
        if (!dragging || ev.pointerId !== pid) return;
        ev.preventDefault();
        const dx = ev.clientX - sx, dy = ev.clientY - sy;

        // on desktop: keep small-threshold and margin clamping (original behavior)
        if (!isMobile) {
          if (!ball._wasDragged && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) ball._wasDragged = true;
          const margin = 8;
          let L = Math.round(sl + dx), T = Math.round(st + dy);
          L = Math.max(margin, Math.min(window.innerWidth - ball.offsetWidth - margin, L));
          T = Math.max(margin, Math.min(window.innerHeight - ball.offsetHeight - margin, T));
          ball.style.left = L + 'px';
          ball.style.top = T + 'px';
          return;
        }

        // on mobile: remove the "elastic" behavior — move directly with pointer (no small-threshold, no extra margin),
        // but still keep element inside viewport (strict clamp to edges)
        if (!ball._wasDragged) ball._wasDragged = true;
        let L = Math.round(sl + dx), T = Math.round(st + dy);
        const maxL = Math.max(0, window.innerWidth - ball.offsetWidth);
        const maxT = Math.max(0, window.innerHeight - ball.offsetHeight);
        L = Math.max(0, Math.min(maxL, L));
        T = Math.max(0, Math.min(maxT, T));
        ball.style.left = L + 'px';
        ball.style.top = T + 'px';
      }

      function onUp(ev) {
        if (!dragging || ev.pointerId !== pid) return;
        dragging = false;
        try { ball.releasePointerCapture && ball.releasePointerCapture(pid); } catch (_) {}
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.userSelect = '';
        try {
          const r = ball.getBoundingClientRect();
          // on mobile we saved the strict clamped position; on desktop it's the original clamped one
          saveBallPos(Math.round(r.left), Math.round(r.top));
        } catch (e) {}
        // keep ball._wasDragged value for click handler to check
        pid = null;
      }
    })();

    // when panel is minimized -> hide panel element, show ball
    function minimizeToBall() {
      try {
        // hide panel
        panel.classList.add('hidden');
        try { localStorage.setItem(LSK_MIN, '1'); } catch (e) {}
        // show ball at stored pos or near previous panel pos
        const bp = loadBallPos();
        if (bp) showBall(bp.left, bp.top);
        else {
          // if panel has a stored pos, try to place ball near panel
          try {
            const rect = panel.getBoundingClientRect();
            const left = Math.min(window.innerWidth - 56 - 8, Math.max(8, rect.left + rect.width - 56));
            const top = Math.min(window.innerHeight - 56 - 8, Math.max(8, rect.top));
            showBall(left, top);
            saveBallPos(left, top);
          } catch (e) { showBall(); }
        }
        showToast(t('minimized'), 1200);
      } catch (e) {}
    }

    // restore from ball -> hide ball, show panel and restore size/pos
    function restoreFromBall() {
      try {
        hideBall();
        panel.classList.remove('hidden');
        try { localStorage.removeItem(LSK_MIN); } catch (e) {}
        // attempt to restore panel clamp (size/position)
        try { panel.__wplace_size_api && panel.__wplace_size_api.loadSizeAndPosition && panel.__wplace_size_api.loadSizeAndPosition(); } catch (e) {}
        showToast(t('restored'), 1200);
      } catch (e) {}
    }

    // button click -> minimize
    minBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const isHidden = panel.classList.contains('hidden');
      if (!isHidden) minimizeToBall();
      else restoreFromBall();
    });

    // ball click -> restore
    ball.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // if a drag happened just before click, ignore this click
      if (ball._wasDragged) {
        // reset flag so next actual click works
        ball._wasDragged = false;
        return;
      }
      restoreFromBall();
    });

    // integrate with existing S-key toggle: when toggling to hidden state, prefer ball display
    // replace applyMinimizedState usage by wrapping it: if requested min -> minimizeToBall; else restoreFromBall
    // to avoid touching many call sites, monkey-patch applyMinimizedState if exists
    try {
      if (typeof applyMinimizedState === 'function') {
        const original = applyMinimizedState;
        applyMinimizedState = function(min) {
          if (min) minimizeToBall();
          else restoreFromBall();
        };
      }
    } catch (e) {}

    // when page loads and LSK_MIN indicates minimized, show ball
    try {
      const raw = localStorage.getItem(LSK_MIN);
      if (raw === '1') {
        // show ball after a tick so layout has settled
        setTimeout(() => { minimizeToBall(); }, 60);
      }
    } catch (e) {}
  } catch (e) { console.warn('ball install failed', e); }
})();
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

(function () {
  'use strict';

  const SELECTOR_ATTR = '[readonly]';
  const SELECTOR_CLASS_MATCH = 'text-base-content/80';
  const POLL_MS = 500;
  const DEBOUNCE_MS = 250;

  // 用于防抖的简单计时器集合
  const debounceMap = new WeakMap();

  // 从元素或相关节点获取显示文本
  function findRenderedText(el) {
    if (!el) return '';
    const cand = (el.value || el.getAttribute('value') || el.innerText || el.textContent || '').trim();
    if (cand) return cand;
    const parent = el.parentNode;
    if (parent) {
      for (const node of Array.from(parent.childNodes)) {
        if (!node) continue;
        const txt = (node.textContent || '').trim();
        if (txt && /wplace\.live/i.test(txt)) return txt;
      }
    }
    // 往上再找一层
    if (parent && parent.parentNode) {
      for (const node of Array.from(parent.parentNode.childNodes)) {
        if (!node) continue;
        const txt = (node.textContent || '').trim();
        if (txt && /wplace\.live/i.test(txt)) return txt;
      }
    }
    return '';
  }

  // 抽取并格式化
  function extractAndFormatUrl(text) {
    if (!text) return null;
    const m = text.match(/(https?:\/\/)?(www\.)?wplace\.live[^\s]*/i);
    if (!m) return null;
    const raw = m[0].replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    let tmp;
    try {
      tmp = new URL((/^https?:\/\//i.test(m[0]) ? '' : 'https://') + m[0].replace(/^(https?:\/\/)?/i, ''));
    } catch (e) {
      try {
        tmp = new URL('https://' + raw);
      } catch (e2) {
        return null;
      }
    }
    const params = tmp.searchParams;
    if (!params.has('lat') || !params.has('lng')) return null;
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return `wplace.live/?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}`;
  }

  // 判断是否目标
  function isTargetInput(el) {
    if (!el || el.getAttribute == null) return false;
    if (el.getAttribute('readonly') == null) return false;
    const cls = el.getAttribute('class') || '';
    return cls.indexOf(SELECTOR_CLASS_MATCH) !== -1;
  }

  // 写回显示（仅当与期望不同时写）
  function applyFormattedIfNeeded(el, formatted) {
    if (!el || !formatted) return;
    const current = (el.value || el.getAttribute('value') || el.innerText || el.textContent || '').trim();
    if (current === formatted) return;
    // 防抖：同一元素短时间内只处理一次
    const lastTimer = debounceMap.get(el);
    if (lastTimer) {
      clearTimeout(lastTimer);
    }
    const t = setTimeout(() => {
      try {
        if ('value' in el) {
          el.value = formatted;
        } else if ('innerText' in el) {
          el.innerText = formatted;
        } else {
          el.textContent = formatted;
        }
        el.setAttribute('title', `formatted → ${formatted}`);
      } catch (e) {
        try { el.innerText = formatted; } catch (ee) { el.textContent = formatted; }
      }
      debounceMap.delete(el);
    }, DEBOUNCE_MS);
    debounceMap.set(el, t);
  }

  // 处理单个元素（不再标记为已处理，而是每次检测并同步）
  function processElement(el) {
    if (!el) return;
    const text = findRenderedText(el);
    const formatted = extractAndFormatUrl(text);
    if (formatted) applyFormattedIfNeeded(el, formatted);
  }

  // 全页扫描并处理
  function scanAndProcess() {
    try {
      const candidates = Array.from(document.querySelectorAll(SELECTOR_ATTR)).filter(isTargetInput);
      for (const el of candidates) processElement(el);
    } catch (e) {
      /* ignore */
    }
  }

  // 绑定事件到元素，捕捉 value/输入变化
  function bindEventsTo(el) {
    if (!el) return;
    if (el.__wplace_bound) return;
    const handler = () => processElement(el);
    el.addEventListener('input', handler, { passive: true });
    el.addEventListener('change', handler, { passive: true });
    el.addEventListener('blur', handler, { passive: true });
    // 属性变化也会触发 MutationObserver（见下），这里只是做保险
    el.__wplace_bound = true;
  }

  // 绑定到现有和未来的目标元素
  function bindExistingAndFuture() {
    const list = Array.from(document.querySelectorAll(SELECTOR_ATTR)).filter(isTargetInput);
    for (const el of list) bindEventsTo(el);
  }

  // MutationObserver：监听属性/子树/字符数据变化
  const mo = new MutationObserver((mutations) => {
    let needsScan = false;
    for (const m of mutations) {
      // 如果有新增或替换节点，或属性变化，触发扫描与绑定
      if (m.type === 'childList' && (m.addedNodes && m.addedNodes.length > 0)) {
        needsScan = true;
        break;
      }
      if (m.type === 'attributes') {
        // 只对可能影响匹配或内容的属性继续
        const attr = m.attributeName;
        if (['class', 'value', 'textContent', 'innerText', 'readonly'].includes(attr)) {
          needsScan = true;
          break;
        }
      }
      if (m.type === 'characterData') {
        needsScan = true;
        break;
      }
    }
    if (needsScan) {
      bindExistingAndFuture();
      scanAndProcess();
    }
  });

  // 开始观察
  mo.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'value', 'readonly', 'textContent', 'innerText'],
    characterData: true
  });

  // 周期性轮询作为补偿
  const poll = setInterval(() => {
    bindExistingAndFuture();
    scanAndProcess();
  }, POLL_MS);

  // 初次运行
  bindExistingAndFuture();
  scanAndProcess();

  // 清理钩子（页面卸载）
  window.addEventListener('beforeunload', () => {
    mo.disconnect();
    clearInterval(poll);
  });
})();