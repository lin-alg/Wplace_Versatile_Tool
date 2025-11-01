// content_ui.js (完整替换文件)
// 功能：浮动面板、稳定拖拽、最小化为可拖拽图标、智能检测并填充 Blue/Skirk 输入后跳转
(() => {
  if (window.__WPLACE_LOCATOR_INJECTED) return;
  window.__WPLACE_LOCATOR_INJECTED = true;

  const i18n = {
    en: {
      title: "Wplace Locator",
      share: "Share",
      jump: "Jump",
      placeholder: "Enter TlX, TlY, PxX, PxY (e.g. 180,137,42,699)",
      copied: "Copied to clipboard:",
      no_share: "No recent share found",
      copy_fail: "Failed to copy to clipboard",
      minimized_tip: "Click to expand",
      choose_map: "Map style"
    },
    zh: {
      title: "Wplace 定位",
      share: "分享",
      jump: "跳转",
      placeholder: "输入 TlX, TlY, PxX, PxY，例如 180,137,42,699",
      copied: "已复制到剪贴板：",
      no_share: "未发现最近的分享",
      copy_fail: "复制到剪贴板失败",
      minimized_tip: "最小化",
      choose_map: "地图样式"
    }
  };

  let lang = localStorage.getItem("wplace_lang") || "en";
  function t(k) { return i18n[lang] && i18n[lang][k] ? i18n[lang][k] : i18n.en[k]; }

  // ---------- Create root UI (no map-style select) ----------
  const root = document.createElement("div");
  root.id = "wplace_locator";
  root.innerHTML = `
    <div id="wplace_header">
      <div class="drag-handle" style="display:flex;align-items:center;gap:8px;">
        <div id="wplace_title">${t("title")}</div>
      </div>
      <div id="wplace_controls">
        <button id="wplace_min_btn" title="${t("minimized_tip")}" class="lang-toggle">—</button>
        <select id="wplace_lang_sel" class="lang-toggle">
          <option value="en">EN</option>
          <option value="zh">中文</option>
        </select>
      </div>
    </div>
    <div id="wplace_body">
      <div style="margin-bottom:8px;">
        <button id="wplace_share" class="wplace_btn">${t("share")}</button>
        <button id="wplace_jump_btn" class="wplace_btn secondary">${t("jump")}</button>
      </div>
      <input id="wplace_input" type="text" placeholder="${t("placeholder")}" />
    </div>
    <div id="wplace_toast"></div>
  `;
  document.body.appendChild(root);

  const styleId = "wplace_locator_css";
  if (!document.getElementById(styleId)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    try { link.href = chrome.runtime.getURL("content_ui.css"); } catch (e) { link.href = ""; }
    link.id = styleId;
    document.head.appendChild(link);
  }

  const shareBtn = root.querySelector("#wplace_share");
  const jumpBtn = root.querySelector("#wplace_jump_btn");
  const inputEl = root.querySelector("#wplace_input");
  const toast = root.querySelector("#wplace_toast");
  const minBtn = root.querySelector("#wplace_min_btn");
  const langSel = root.querySelector("#wplace_lang_sel");

  langSel.value = lang;
  langSel.addEventListener("change", () => {
    lang = langSel.value;
    localStorage.setItem("wplace_lang", lang);
    root.querySelector("#wplace_title").textContent = t("title");
    shareBtn.textContent = t("share");
    jumpBtn.textContent = t("jump");
    inputEl.placeholder = t("placeholder");
    minBtn.title = t("minimized_tip");
  });

  function showToast(msg, timeout=2500) {
    toast.style.display = "block";
    toast.textContent = msg;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(()=> { toast.style.display = "none"; }, timeout);
  }

  // --------- Parsing & math ----------
  function parseFourCoords(str) {
    if (!str) return null;
    const parts = str.split(",").map(s => s.trim()).filter(s => s.length>0);
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
    const lng = (180 / Math.PI) * ( (X - A1) / B1 );
    const t = Math.exp( (A2 - Y) / B2 );
    const lat = (360 / Math.PI) * ( Math.atan(t) - Math.PI / 4 );
    return { lat, lng };
  }

  // --------- Share logic ----------
  shareBtn.addEventListener("click", async () => {
    try {
      chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, async (resp) => {
        const coords = resp && resp.coords;
        if (!coords) {
          showToast(t("no_share"));
          return;
        }
        try {
          await navigator.clipboard.writeText(coords);
          showToast(`${t("copied")} ${coords}`);
        } catch (e) {
          try {
            const ta = document.createElement("textarea");
            ta.value = coords;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            ta.remove();
            if (ok) showToast(`${t("copied")} ${coords}`);
            else showToast(t("copy_fail"));
          } catch (e2) {
            showToast(t("copy_fail"));
          }
        }
      });
    } catch (e) {
      showToast(t("no_share"));
    }
  });

  // --------- Stable draggable for panel ----------
  function installStableDraggable(rootEl, opts = {}) {
    const snapThreshold = typeof opts.snapThreshold === 'number' ? opts.snapThreshold : 6;
    const padding = typeof opts.padding === 'number' ? opts.padding : 8;
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function ensureLeftTop() {
      const rect = rootEl.getBoundingClientRect();
      rootEl.style.position = 'fixed';
      rootEl.style.left = Math.round(rect.left) + 'px';
      rootEl.style.top = Math.round(rect.top) + 'px';
      rootEl.style.right = 'auto';
      rootEl.style.bottom = 'auto';
    }
    ensureLeftTop();

    let dragging = false;
    let startPointerX = 0, startPointerY = 0, startLeft = 0, startTop = 0, pointerId = null;
    const handle = rootEl.querySelector('.drag-handle') || rootEl;

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      ensureLeftTop();
      dragging = true;
      pointerId = e.pointerId;
      handle.setPointerCapture && handle.setPointerCapture(pointerId);
      startPointerX = e.clientX; startPointerY = e.clientY;
      const rect = rootEl.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      document.body.style.userSelect = 'none';
      document.body.style.touchAction = 'none';
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: false });
      window.addEventListener('pointercancel', onPointerUp, { passive: false });
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      e.preventDefault();
      const dx = e.clientX - startPointerX;
      const dy = e.clientY - startPointerY;
      let targetLeft = startLeft + dx;
      let targetTop = startTop + dy;

      const vw = window.innerWidth, vh = window.innerHeight;
      const rect = rootEl.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const minLeft = padding;
      const minTop = padding;
      const maxLeft = Math.max(padding, vw - w - padding);
      const maxTop = Math.max(padding, vh - h - padding);

      targetLeft = clamp(Math.round(targetLeft), minLeft, maxLeft);
      targetTop = clamp(Math.round(targetTop), minTop, maxTop);

      if (snapThreshold > 0) {
        if (Math.abs(dx) <= snapThreshold && Math.abs(dy) <= snapThreshold) {
        } else {
          rootEl.style.left = targetLeft + 'px';
          rootEl.style.top = targetTop + 'px';
        }
      } else {
        rootEl.style.left = targetLeft + 'px';
        rootEl.style.top = targetTop + 'px';
      }
    }

    function onPointerUp(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      handle.releasePointerCapture && handle.releasePointerCapture(pointerId);
      pointerId = null;
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      try {
        const rect = rootEl.getBoundingClientRect();
        const pos = { left: Math.round(rect.left), top: Math.round(rect.top) };
        try { chrome.storage.local.set({ wplace_position: pos }); } catch(e){ localStorage.setItem('wplace_position', JSON.stringify(pos)); }
      } catch (e) {}
    }

    handle.addEventListener('pointerdown', onPointerDown, { passive: false });

    function destroy() {
      handle.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    }

    function setPosition(x, y) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const rect = rootEl.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const targetLeft = clamp(Math.round(x), padding, Math.max(padding, vw - w - padding));
      const targetTop = clamp(Math.round(y), padding, Math.max(padding, vh - h - padding));
      rootEl.style.left = targetLeft + 'px';
      rootEl.style.top = targetTop + 'px';
    }

    window.__wplace_rebind_draggable = function(reRoot){
      try {
        if (reRoot && reRoot.__draggable && typeof reRoot.__draggable.destroy === 'function') reRoot.__draggable.destroy();
      } catch(e){}
      const api = installStableDraggable(reRoot || rootEl, opts);
      return api;
    };

    try {
      chrome.storage.local.get(['wplace_position'], (res) => {
        const pos = res && res.wplace_position;
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') setPosition(pos.left, pos.top);
        else {
          const raw = localStorage.getItem('wplace_position');
          if (raw) {
            try {
              const p = JSON.parse(raw);
              if (p && typeof p.left === 'number' && typeof p.top === 'number') setPosition(p.left, p.top);
            } catch(e){}
          }
        }
      });
    } catch(e){
      try {
        const raw = localStorage.getItem('wplace_position');
        if (raw) {
          const p = JSON.parse(raw);
          if (p && typeof p.left === 'number' && typeof p.top === 'number') setPosition(p.left, p.top);
        }
      } catch(e){}
    }

    window.addEventListener('resize', () => {
      const rect = rootEl.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const x = clamp(rect.left, padding, Math.max(padding, vw - rect.width - padding));
      const y = clamp(rect.top, padding, Math.max(padding, vh - rect.height - padding));
      rootEl.style.left = x + 'px';
      rootEl.style.top = y + 'px';
    });

    const api = { destroy, setPosition };
    rootEl.__draggable = api;
    return api;
  }

  const draggableApi = installStableDraggable(root, { snapThreshold: 6, padding: 8 });

  // --------- Minimize to draggable icon ----------
  const MIN_ICON_FILENAME = 'icons/minimize-icon.png';
  const MINIMIZED_STORAGE_KEY = 'wplace_minimized_v2';
  const MIN_ICON_POS_KEY = 'wplace_min_icon_pos_v1';

  function createOrReplaceFloatBtn() {
    let existing = document.getElementById('wplace_min_icon_btn');
    if (existing) {
      try { if (existing.__wplace_cleanup) existing.__wplace_cleanup(); } catch(e){}
      existing.remove();
    }

    const floatBtn = document.createElement('button');
    floatBtn.id = 'wplace_min_icon_btn';
    floatBtn.setAttribute('aria-label', 'Wplace Locator');
    Object.assign(floatBtn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '2147483647',
      width: '56px',
      height: '56px',
      borderRadius: '10px',
      padding: '0',
      display: 'none',
      border: 'none',
      boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
      background: 'transparent',
      cursor: 'grab',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const img = document.createElement('img');
    img.id = 'wplace_min_icon_img';
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      pointerEvents: 'none'
    });
    try { img.src = chrome.runtime.getURL(MIN_ICON_FILENAME); } catch (e) { img.src = ''; }
    floatBtn.appendChild(img);
    document.body.appendChild(floatBtn);

    (function makeFloatBtnDraggable(btn) {
      const savedKey = MIN_ICON_POS_KEY;
      let dragging = false;
      let pointerId = null;
      let startX = 0, startY = 0, startLeft = 0, startTop = 0;
      let moved = false;
      const clickThreshold = 6;
      btn.style.touchAction = 'none';

      function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

      function readSaved() {
        try {
          chrome.storage.local.get([savedKey], res => {
            const p = res && res[savedKey];
            if (p && typeof p.left === 'number' && typeof p.top === 'number') {
              applyPos(p.left, p.top);
            }
          });
        } catch(e){
          try {
            const raw = localStorage.getItem(savedKey);
            if (raw) {
              const p = JSON.parse(raw);
              if (p && typeof p.left === 'number' && typeof p.top === 'number') applyPos(p.left, p.top);
            }
          } catch(e){}
        }
      }

      function savePos(left, top) {
        const pos = { left: Math.round(left), top: Math.round(top) };
        try { chrome.storage.local.set({ [savedKey]: pos }); } catch(e){ try { localStorage.setItem(savedKey, JSON.stringify(pos)); } catch(_) {} }
      }

      function applyPos(left, top) {
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = btn.offsetWidth, h = btn.offsetHeight;
        const minLeft = 4, minTop = 4;
        const maxLeft = Math.max(minLeft, vw - w - 4);
        const maxTop = Math.max(minTop, vh - h - 4);
        const L = clamp(Math.round(left), minLeft, maxLeft);
        const T = clamp(Math.round(top), minTop, maxTop);
        btn.style.left = L + 'px';
        btn.style.top = T + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      }

      function onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        pointerId = e.pointerId;
        btn.setPointerCapture && btn.setPointerCapture(pointerId);
        startX = e.clientX; startY = e.clientY;
        const rect = btn.getBoundingClientRect();
        startLeft = (parseInt(btn.style.left, 10) || rect.left);
        startTop = (parseInt(btn.style.top, 10) || rect.top);
        moved = false;
        btn.style.cursor = 'grabbing';
        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp, { passive: false });
        window.addEventListener('pointercancel', onPointerUp, { passive: false });
      }

      function onPointerMove(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && Math.hypot(dx, dy) > clickThreshold) moved = true;
        const newLeft = startLeft + dx;
        const newTop = startTop + dy;
        applyPos(newLeft, newTop);
      }

      function onPointerUp(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        btn.releasePointerCapture && btn.releasePointerCapture(pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        btn.style.cursor = 'grab';
        const rect = btn.getBoundingClientRect();
        if (moved) savePos(rect.left, rect.top);
        pointerId = null;
        setTimeout(()=>{ moved = false; }, 50);
      }

      btn.addEventListener('click', (e) => {
        if (moved) { e.stopImmediatePropagation(); e.preventDefault(); return; }
      }, true);

      btn.addEventListener('pointerdown', onPointerDown, { passive: false });

      const resizeHandler = () => {
        const rect = btn.getBoundingClientRect();
        applyPos(rect.left, rect.top);
      };
      window.addEventListener('resize', resizeHandler);

      btn.__wplace_cleanup = function(){
        try {
          btn.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('resize', resizeHandler);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
        } catch(e){}
      };

      readSaved();
    })(floatBtn);

    return floatBtn;
  }

  const floatBtn = createOrReplaceFloatBtn();

  function hideRootCompletely() {
    try {
      if (root.__draggable && typeof root.__draggable.destroy === 'function') {
        root.__draggable.destroy();
      }
    } catch (e) {}
    root.style.display = 'none';
    root.setAttribute('data-wplace-minimized', 'true');
  }
  function showRootFromMin() {
    root.style.display = '';
    root.removeAttribute('data-wplace-minimized');
    try {
      if (typeof window.__wplace_rebind_draggable === 'function') window.__wplace_rebind_draggable(root);
    } catch(e) {}
  }

  function setPersistMinimized(v) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [MINIMIZED_STORAGE_KEY]: !!v });
      } else {
        localStorage.setItem(MINIMIZED_STORAGE_KEY, !!v ? '1' : '0');
      }
    } catch (e) {
      try { localStorage.setItem(MINIMIZED_STORAGE_KEY, !!v ? '1' : '0'); } catch(_) {}
    }
  }
  function getPersistMinimized(defaultVal = false) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([MINIMIZED_STORAGE_KEY], res => {
          const v = res && (res[MINIMIZED_STORAGE_KEY] === true || res[MINIMIZED_STORAGE_KEY] === '1');
          applyMinimizedState(!!v, { persist: false });
        });
        return defaultVal;
      }
    } catch (e) {}
    try {
      const v = localStorage.getItem(MINIMIZED_STORAGE_KEY);
      return v === '1';
    } catch (e) { return defaultVal; }
  }

  function applyMinimizedState(minimized, opts = { persist: true }) {
    if (minimized) {
      hideRootCompletely();
      floatBtn.style.display = 'flex';
      floatBtn.setAttribute('aria-hidden', 'false');
      const img = floatBtn.querySelector('#wplace_min_icon_img');
      try { if (img && !img.src) img.src = chrome.runtime.getURL(MIN_ICON_FILENAME); } catch (e) {}
    } else {
      showRootFromMin();
      floatBtn.style.display = 'none';
      floatBtn.setAttribute('aria-hidden', 'true');
    }
    if (opts.persist) setPersistMinimized(minimized);
  }

  floatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyMinimizedState(false);
  });

  if (minBtn) {
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyMinimizedState(true);
    });
  }

  window.__wplace = window.__wplace || {};
  window.__wplace.toggleMinimized = function(){ 
    const cur = root.getAttribute('data-wplace-minimized') === 'true';
    applyMinimizedState(!cur);
  };
  window.__wplace.setMinimized = function(v){ applyMinimizedState(!!v); };
  window.__wplace.getMinimized = function(){ return root.getAttribute('data-wplace-minimized') === 'true'; };
  window.__wplace.setIcon = function(filename){
    try {
      const img = document.querySelector('#wplace_min_icon_img');
      if (img) img.src = chrome.runtime.getURL(filename);
    } catch (e) { console.warn('setIcon failed', e); }
  };

  const persisted = getPersistMinimized(false);
  applyMinimizedState(persisted, { persist: false });

  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes && changes[MINIMIZED_STORAGE_KEY]) {
          const newV = changes[MINIMIZED_STORAGE_KEY].newValue;
          applyMinimizedState(!!newV, { persist: false });
        }
      });
    }
  } catch (e) {}

  floatBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyMinimizedState(false); }
  });

  window.__wplace_floatBtn = floatBtn;
  window.__wplace_rebind_draggable = window.__wplace_rebind_draggable || ((r) => installStableDraggable(r || root, { snapThreshold: 6, padding: 8 }));

  // --------- Utilities for filling inputs ----------
  async function getLatestCoordsString() {
    try {
      const resp = await new Promise(resolve => {
        try {
          chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, resolve);
        } catch (e) { resolve(null); }
      });
      if (resp && resp.coords) return resp.coords;
    } catch (e) {}
    return inputEl && inputEl.value ? inputEl.value : null;
  }

  function safeDispatchInputEvents(el, value) {
    try {
      if ('valueAsNumber' in el && typeof el.valueAsNumber === 'number') {
        el.value = String(value);
        try { el.valueAsNumber = Number(value); } catch (_) {}
      } else {
        el.value = String(value);
      }
    } catch (e) {
      try { el.setAttribute('value', String(value)); } catch (_) {}
    }

    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      try { el.focus({ preventScroll: true }); } catch(_) {}
      setTimeout(() => { try { el.blur(); } catch(_) {} }, 50);
    } catch (e) {}
  }

  // ---------- Smart detection & filling (header-aware) ----------
  function detectPageHeaderType() {
    try {
      const hs = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => (h.innerText || '').trim());
      for (const txt of hs) {
        const low = txt.toLowerCase();
        if (low.includes('skirk')) return 'skirk';
        if (low.includes('blue')) return 'blue';
      }
    } catch (e) {}
    return null;
  }

  function detectBmGroups() {
    const groups = [];
    const seen = new Set();

    Array.from(document.querySelectorAll('[id],[class]')).forEach(el => {
      try {
        const id = (el.id || '').toLowerCase();
        const cls = (el.className || '').toString().toLowerCase();
        if (id.includes('bm') || cls.includes('bm')) {
          let root = el;
          while (root && root !== document.body) {
            const inputs = root.querySelectorAll && root.querySelectorAll('input, textarea, select, [contenteditable="true"]');
            if (inputs && inputs.length > 0) break;
            root = root.parentElement;
          }
          root = root || el;
          if (!seen.has(root)) {
            seen.add(root);
            const inputs = Array.from(root.querySelectorAll('input, textarea, select, [contenteditable="true"]'))
              .filter(i => i.type !== 'hidden');
            if (inputs.length > 0) groups.push({ root, inputs, meta: { text: (root.innerText||'').trim().slice(0,200) } });
          }
        }
      } catch(e){}
    });

    Array.from(document.querySelectorAll('body *')).slice(0, 400).forEach(el => {
      try {
        const txt = (el.innerText || '').toLowerCase();
        if (txt.includes('tile') || txt.match(/\bt1\b/)) {
          let root = el;
          while (root && root !== document.body) {
            const inputs = root.querySelectorAll && root.querySelectorAll('input, textarea, select, [contenteditable="true"]');
            if (inputs && inputs.length > 0) break;
            root = root.parentElement;
          }
          root = root || el;
          if (!seen.has(root)) {
            seen.add(root);
            const inputs = Array.from(root.querySelectorAll('input, textarea, select, [contenteditable="true"]'))
              .filter(i => i.type !== 'hidden');
            if (inputs.length > 0) groups.push({ root, inputs, meta: { text: (root.innerText||'').trim().slice(0,200) } });
          }
        }
      } catch(e){}
    });

    if (groups.length === 0) {
      const bmInputs = Array.from(document.querySelectorAll('input[id^="bm-"], input[id*="bm"]'));
      if (bmInputs.length > 0) groups.push({ root: document.body, inputs: bmInputs, meta: { text: 'fallback-body-group' } });
    }

    return groups;
  }

  function scoreInputForRoles(el) {
    const scores = { tlx:0, tly:0, pxx:0, pxy:0 };
    const id = (el.id || '').toLowerCase();
    const ph = (el.getAttribute && (el.getAttribute('placeholder') || '') || '').toLowerCase();
    const labelText = (() => {
      try {
        if (el.id) {
          const lab = document.querySelector(`label[for="${el.id}"]`);
          if (lab) return (lab.innerText || '').toLowerCase();
        }
      } catch(e){}
      try { const p = el.previousElementSibling; if (p && p.innerText) return (p.innerText || '').toLowerCase(); } catch(e){}
      return '';
    })();
    const near = ((el.closest && el.closest('[id]') && el.closest('[id]').innerText) || '').toLowerCase();
    const textPool = [id, ph, labelText, near].join(' ');

    if (textPool.includes('tlx') || textPool.includes('tl x')) scores.tlx += 12;
    if (textPool.includes('t1 x') || textPool.includes('t1x')) scores.tlx += 10;
    if (textPool.includes('tly') || textPool.includes('tl y')) scores.tly += 12;
    if (textPool.includes('t1 y') || textPool.includes('t1y')) scores.tly += 10;
    if (textPool.includes('pxx') || textPool.includes('px x')) scores.pxx += 12;
    if (textPool.includes('pxy') || textPool.includes('px y')) scores.pxy += 12;

    if (id.includes('bm-v') || id.match(/bm[-_]?v\b/)) scores.tlx += 14;
    if (id.includes('bm-w') || id.match(/bm[-_]?w\b/)) scores.tly += 14;
    if (id.includes('bm-x') || id.match(/bm[-_]?x\b/)) scores.pxx += 14;
    if (id.includes('bm-y') || id.match(/bm[-_]?y\b/)) scores.pxy += 14;

    // skirk uppercase mapping W/X/Y/Z -> TlX/TlY/PxX/PxY
    if (id.includes('bm-w') && id.match(/bm[-_]?w\b/i)) { scores.tlx += 16; }
    if (id.includes('bm-x') && id.match(/bm[-_]?x\b/i)) { scores.tly += 16; }
    if (id.includes('bm-y') && id.match(/bm[-_]?y\b/i)) { scores.pxx += 16; }
    if (id.includes('bm-z') && id.match(/bm[-_]?z\b/i)) { scores.pxy += 16; }

    try {
      const min = el.getAttribute && el.getAttribute('min');
      const max = el.getAttribute && el.getAttribute('max');
      if (min !== null && max !== null) {
        const nmin = Number(min), nmax = Number(max);
        if (!Number.isNaN(nmin) && !Number.isNaN(nmax) && nmin >= 0 && nmax <= 5000) {
          scores.pxx += 4; scores.pxy += 4;
        }
      }
    } catch(e){}

    return scores;
  }

  function assignRolesInGroup(group, preferredType = null) {
    const scoresList = group.inputs.map(el => ({ el, score: scoreInputForRoles(el) }));
    const assigned = { tlx:null, tly:null, pxx:null, pxy:null, debug: scoresList };

    if (preferredType === 'skirk') {
      for (const el of group.inputs) {
        const id = (el.id || '');
        const low = id.toLowerCase();
        if (low.includes('bm-w')) assigned.tlx = assigned.tlx || el;
        if (low.includes('bm-x') && !assigned.tly) assigned.tly = el;
        if (low.includes('bm-y') && !assigned.pxx) assigned.pxx = el;
        if (low.includes('bm-z') && !assigned.pxy) assigned.pxy = el;
      }
    } else if (preferredType === 'blue') {
      for (const el of group.inputs) {
        const id = (el.id || '');
        const low = id.toLowerCase();
        if (low.includes('bm-v')) assigned.tlx = assigned.tlx || el;
        if (low.includes('bm-w')) assigned.tly = assigned.tly || el;
        if (low.includes('bm-x')) assigned.pxx = assigned.pxx || el;
        if (low.includes('bm-y')) assigned.pxy = assigned.pxy || el;
      }
    }

    const roles = ['tlx','tly','pxx','pxy'];
    for (const role of roles) {
      if (assigned[role]) continue;
      let best = null, bestScore = -Infinity;
      for (const s of scoresList) {
        if (Object.values(assigned).includes(s.el)) continue;
        const sc = s.score[role] || 0;
        if (sc > bestScore) { best = s.el; bestScore = sc; }
      }
      if (best && bestScore > 0) assigned[role] = best;
    }

    return assigned;
  }

  function chooseGroupByHeaderPreference(groups) {
    const hTags = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => ({ el: h, text: (h.innerText||'').toLowerCase() }));
    let pref = null;
    for (const h of hTags) {
      if (h.text.includes('skirk')) { pref = 'skirk'; break; }
      if (h.text.includes('blue')) { pref = 'blue'; break; }
    }
    if (!pref) return null;

    let bestGroup = null, bestDist = Infinity;
    for (const g of groups) {
      for (const h of hTags.filter(x => x.text.includes(pref))) {
        try {
          if (g.root.contains(h.el) || h.el.contains(g.root)) {
            bestGroup = g; bestDist = 0; break;
          } else {
            let a = g.root, depth = 0;
            let found = false;
            while (a && a !== document.body) {
              let b = h.el;
              let steps = 0;
              while (b && b !== document.body) {
                if (a === b) { found = true; break; }
                b = b.parentElement; steps++;
              }
              if (found) { if (steps + depth < bestDist) { bestDist = steps + depth; bestGroup = g; } break; }
              a = a.parentElement; depth++;
            }
          }
        } catch(e){}
      }
      if (bestDist === 0) break;
    }
    return bestGroup ? { chosenGroup: bestGroup, preferredType: pref } : null;
  }

  async function fillFromDetectedGroupsSmart(coordsStr) {
    if (!coordsStr) return { ok:false, reason:'no coords' };
    const parsed = parseFourCoords(coordsStr);
    if (!parsed) return { ok:false, reason:'parse_failed' };
    const [tlx, tly, pxx, pxy] = parsed;

    const groups = detectBmGroups();
    if (!groups || groups.length === 0) return { ok:false, reason:'no_groups' };

    const choice = chooseGroupByHeaderPreference(groups);
    if (choice && choice.chosenGroup) {
      const assign = assignRolesInGroup(choice.chosenGroup, choice.preferredType);
      const mapped = [
        { role:'tlx', val: tlx },
        { role:'tly', val: tly },
        { role:'pxx', val: pxx },
        { role:'pxy', val: pxy }
      ];
      const missing = [];
      let any = false;
      for (const m of mapped) {
        const el = assign[m.role];
        if (el) { safeDispatchInputEvents(el, m.val); any = true; }
        else missing.push(m.role);
      }
      return { ok:true, mode:'header-preferred', filled: any, missing, assigned: assign, group: choice.chosenGroup };
    }

    let bestResult = null;
    for (const g of groups) {
      const assign = assignRolesInGroup(g, null);
      const filledCount = ['tlx','tly','pxx','pxy'].reduce((acc,role)=> acc + (assign[role] ? 1 : 0), 0);
      if (!bestResult || filledCount > bestResult.filledCount) bestResult = { group:g, assign, filledCount };
    }

    if (bestResult && bestResult.filledCount > 0) {
      const a = bestResult.assign;
      if (a.tlx) safeDispatchInputEvents(a.tlx, tlx);
      if (a.tly) safeDispatchInputEvents(a.tly, tly);
      if (a.pxx) safeDispatchInputEvents(a.pxx, pxx);
      if (a.pxy) safeDispatchInputEvents(a.pxy, pxy);
      const missingRoles = ['tlx','tly','pxx','pxy'].filter(r => !bestResult.assign[r]);
      return { ok:true, mode:'best-group', filledCount: bestResult.filledCount, missing: missingRoles, group: bestResult.group, assigned: bestResult.assign };
    }

    return { ok:false, reason:'no_assignable' };
  }

  // --------- Replace jump behavior: fill intelligently then jump ----------
  jumpBtn.addEventListener("click", async () => {
  // 读取用于跳转的原始面板输入（四元坐标字符串）
  const raw = inputEl.value || "";
  const parsed2 = parseFourCoords(raw);
  if (!parsed2) {
    showToast(t("placeholder"));
    return;
  }

  // 把四元坐标写入 chrome.storage.local（作为待填充数据）
  const coordsToStore = parsed2.join(',');
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ wplace_pending_coords: coordsToStore });
    } else {
      localStorage.setItem('wplace_pending_coords', coordsToStore);
    }
  } catch (e) {
    try { localStorage.setItem('wplace_pending_coords', coordsToStore); } catch(_) {}
  }

  // 生成并执行跳转（不再等待填充）
  const [tlx2, tly2, pxx2, pxy2] = parsed2;
  const { lat, lng } = computeLatLngFromFour(tlx2, tly2, pxx2, pxy2);
  const latS = lat.toFixed(15).replace(/(?:\.0+|(\.\d+?)0+)$/,"$1");
  const lngS = lng.toFixed(15).replace(/(?:\.0+|(\.\d+?)0+)$/,"$1");
  const zoom = 11.5;
  const url = `https://wplace.live/?lat=${latS}&lng=${lngS}&zoom=${zoom}`;
  try {
    window.location.href = url;
  } catch (e) {
    try { top.location.href = url; } catch (_) { showToast("Navigation blocked"); }
  }
});

  (async function consumePendingCoordsOnLoad() {
  let pending = null;
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      const res = await new Promise(resolve => chrome.storage.local.get(['wplace_pending_coords'], resolve));
      if (res && res.wplace_pending_coords) pending = res.wplace_pending_coords;
    }
  } catch (e) {
    try {
      pending = localStorage.getItem('wplace_pending_coords');
    } catch (e) { pending = null; }
  }

  if (!pending) return;

  // Try to fill; if page hasn't rendered target inputs yet, retry a few times with small delays
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fillFromDetectedGroupsSmart(pending);
      // If filled (ok true) or no groups assignable, break and clear pending
      if (res && res.ok) break;
    } catch (e) {
      // ignore and retry
    }
    // wait 200ms before next attempt (gives SPA frameworks time to render)
    await new Promise(r => setTimeout(r, 200));
  }

  // remove pending key
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['wplace_pending_coords']);
    } else {
      localStorage.removeItem('wplace_pending_coords');
    }
  } catch (e) {
    try { localStorage.removeItem('wplace_pending_coords'); } catch(_) {}
  }
})();

(function installThemeSelectorAtEnd() {
  try {
    const controls = root && root.querySelector ? root.querySelector('#wplace_controls') : null;
    if (!controls) return;

    // create or reuse selector
    let sel = document.getElementById('wplace_theme_sel');
    if (!sel) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'inline-block';
      wrapper.style.marginLeft = '8px';

      sel = document.createElement('select');
      sel.id = 'wplace_theme_sel';
      sel.title = '切换主题';
      sel.style.padding = '4px 6px';
      sel.style.borderRadius = '6px';
      sel.style.background = 'rgba(255,255,255,0.03)';
      sel.style.color = '#9aa0a6';
      sel.style.border = '1px solid rgba(255,255,255,0.06)';
      sel.style.webkitAppearance = 'none';
      sel.style.appearance = 'none';

      const options = [
        { label: '默认', value: 'custom-winter' },
        { label: '万圣节', value: 'halloween' }
      ];
      options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        try { opt.style.color = '#6e7376'; } catch(e){}
        sel.appendChild(opt);
      });

      wrapper.appendChild(sel);
      controls.appendChild(wrapper);
    } else {
      sel.style.color = '#9aa0a6';
      sel.style.background = 'rgba(255,255,255,0.03)';
      sel.style.border = '1px solid rgba(255,255,255,0.06)';
    }

    // init select from storage (localStorage preferred, then chrome.storage.local)
    (function initThemeSelect() {
      try {
        const v = localStorage.getItem('theme');
        if (v) sel.value = v;
      } catch(e){}
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['theme'], res => {
            if (res && res.theme) sel.value = res.theme;
          });
        }
      } catch(e){}
    })();

    // on change: request page to set theme via postMessage+token, sync storages, then reload
    sel.addEventListener('change', () => {
      const chosen = sel.value;
      try { requestPageSetTheme(chosen); } catch(e){}
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ theme: chosen });
        }
      } catch(e){}
      try { localStorage.setItem('theme', chosen); } catch(e){}
      try { location.reload(); } catch(e){}
    });

  } catch (e) {
    console.warn('installThemeSelectorAtEnd failed', e);
  }

  // Inject external file (CSP-safe) only once
  (function ensureInjectFile() {
    try {
      if (document.getElementById('__wplace_theme_inject_script')) return;
      const s = document.createElement('script');
      s.id = '__wplace_theme_inject_script';
      try {
        s.src = chrome.runtime.getURL('wplace_theme_inject.js');
      } catch (e) {
        return;
      }
      (document.head || document.documentElement || document.body || document).appendChild(s);
    } catch (e) {
      console.warn('ensureInjectFile failed', e);
    }
  })();

  // content-script -> page message helper using postMessage + short token
  function requestPageSetTheme(value) {
    try {
      const token = Math.random().toString(36).slice(2);
      // briefly expose token so page injector can validate; content script stores it on window for injector to check
      try { window.__wplace_outbound_token = token; } catch(e){}
      window.postMessage({ __wplace_msg: 'SET_THEME', value: String(value), token }, '*');
    } catch (e) {
      console.warn('requestPageSetTheme failed', e);
    }
  }

  // Sync UI with page theme (once & via storage events)
  (function syncThemeUIWithPageAtEnd() {
    try {
      const sel = document.getElementById('wplace_theme_sel');
      if (!sel) return;
      try {
        const v = localStorage.getItem('theme');
        if (v) sel.value = v;
      } catch(e){}
      window.addEventListener('storage', (e) => {
        try {
          if (e.key === 'theme') {
            const newV = e.newValue;
            if (newV) sel.value = newV;
          }
        } catch(e){}
      });
    } catch(e){}
  })();

  // Optional response listener to clear token when injector responds
  window.addEventListener('message', (ev) => {
    try {
      const m = ev && ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.__wplace_resp === 'SET_THEME_DONE' && m.token) {
        try { delete window.__wplace_outbound_token; } catch(_) {}
      }
    } catch(e){}
  });
})();



  // --------- final small checks ----------
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(()=>{}).catch(()=>{});
    }
  } catch (e){}
})();
