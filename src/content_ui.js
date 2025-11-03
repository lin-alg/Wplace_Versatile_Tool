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
      minimized_tip: "Click to minimize",
      choose_map: "Map style",
      fav_add: "☆",
      fav_add_2: "Favorite",
      fav_added: "Saved to favorites",
      fav_no_input: "No valid coords to save",
      fav_empty: "No favorites yet",
      fav_rename: "Rename",
      fav_delete: "Delete",
      fav_copy: "Copy",
      fav_jump: "Jump",
      fav_name_placeholder: "Name (optional)",
      fav_saved_label: "Saved",
      fav_load: "Favorites",
      ruler_title: "Ruler",
      ruler_pick_start: "Pick Start",
      ruler_pick_end: "Pick End",
      ruler_start_label: "Start (TL):",
      ruler_end_label: "End (BR):",
      ruler_offset_label: "Offsets (X, Y):",
      ruler_area_label: "Area (sq units):",
      ruler_clear: "Clear",
      ruler_pick_toast: "Picked",
      ruler_wait_pick: "Click on the map to pick",
      ruler_no_coords: "No coords available to pick",
      theme_default: "Default",
      theme_dark: "Dark",
      check_updates: "Check updates",
      checking_updates: "Checking...",
      update_available: "New version available:",
      up_to_date: "Up to date",
      update_fail: "Update check failed",
      choose_map: "Map style",
      remove_roads: "Remove roads",
      remove_names: "Remove place names",
      save_and_refresh: "Save and refresh"
    },
    zh: {
      title: "Wplace 定位器",
      share: "分享",
      jump: "跳转",
      placeholder: "输入 TlX, TlY, PxX, PxY，例如 180,137,42,699",
      copied: "已复制到剪贴板：",
      no_share: "未发现最近的分享",
      copy_fail: "复制到剪贴板失败",
      minimized_tip: "最小化",
      choose_map: "地图样式",
      fav_add: "☆",
      fav_add_2: "收藏",
      fav_added: "已加入收藏",
      fav_no_input: "没有可保存的有效坐标",
      fav_empty: "尚无收藏",
      fav_rename: "重命名",
      fav_delete: "删除",
      fav_copy: "复制",
      fav_jump: "跳转",
      fav_name_placeholder: "名称（可选）",
      fav_saved_label: "已保存",
      fav_load: "收藏夹",
      ruler_title: "标尺",
      ruler_pick_start: "拾取 起点",
      ruler_pick_end: "拾取 终点",
      ruler_start_label: "起点（左上）:",
      ruler_end_label: "终点（右下）:",
      ruler_offset_label: "横纵偏移 (X, Y):",
      ruler_area_label: "面积 (平方单位):",
      ruler_clear: "清除",
      ruler_pick_toast: "已拾取",
      ruler_wait_pick: "请在地图上点击以拾取",
      ruler_no_coords: "没有可用的坐标",
      theme_default: "默认",
      theme_dark: "深色",
      check_updates: "检查更新",
      checking_updates: "检查中…",
      update_available: "发现新版本：",
      up_to_date: "已是最新",
      update_fail: "检查更新失败",
      choose_map: "地图样式",
      remove_roads: "移除道路",
      remove_names: "移除地名",
      save_and_refresh: "保存并刷新页面"
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
      <div style="margin-bottom:8px; display:flex; gap:8px; align-items:center;">
        <button id="wplace_share" class="wplace_btn">🔗</button>
        <button id="wplace_jump_btn" class="wplace_btn secondary">🚀</button>
        <button id="wplace_fav_btn" title="${t("fav_add")}" class="wplace_btn star">${t("fav_add")}</button>
        <button id="wplace_fav_manager_btn" class="wplace_btn">📁</button>
        <button id="wplace_ruler_btn" class="wplace_btn">📐</button>
        <button id="wplace_check_update" class="wplace_btn">⇪</button>
      </div>
      <input id="wplace_input" type="text" placeholder="${t("placeholder")}" />
    </div>
    <div id="wplace_toast"></div>
  `;
  document.body.appendChild(root);
  try {
    root.style.minWidth = '380px';
    root.style.maxWidth = '92vw';
  } catch (e) {}
  (function installResizableRoot() {
  try {
    const rootEl = document.getElementById('wplace_locator');
    if (!rootEl) return;

    // 配置
    const SIZE_KEY = 'wplace_main_panel_size_v1';
    const POS_KEY = 'wplace_position'; // 你原来可用的 key 仍可兼容
    const DEFAULT = { width: 380, height: 150 };
    const MIN = { width: 380, height: 150 };
    const MAX_PADDING = 16; // 离视窗边缘预留

    // 创建把手
    if (!document.getElementById('wplace_resize_handle')) {
      const handle = document.createElement('div');
      handle.id = 'wplace_resize_handle';
      Object.assign(handle.style, {
        position: 'absolute',
        right: '0px',
        bottom: '0px',
        width: '18px',
        height: '18px',
        cursor: 'nwse-resize',
        zIndex: '2147483648',
        borderRadius: '3px',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto'
      });
      // visual lines
      handle.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\
  <defs>\
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">\
      <stop offset="0" stop-color="rgba(255,255,255,0.98)"/>\
      <stop offset="1" stop-color="rgba(255,255,255,0.82)"/>\
    </linearGradient>\
  </defs>\
  <rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="transparent"/>\
  <polyline points="3.2,10.0 9.2,10.0 9.2,3.6"\
            stroke="url(#g)"\
            stroke-width="1.6"\
            stroke-linecap="butt"\
            stroke-linejoin="miter"\
            fill="none" />\
  <rect x="9.0" y="3.0" width="0.8" height="0.8" fill="rgba(255,255,255,0.94)"/>\
</svg>';
      // ensure root is positioned fixed so left/top/width/height work
      rootEl.style.position = rootEl.style.position || 'fixed';
      rootEl.style.boxSizing = 'border-box';
      rootEl.appendChild(handle);
    }

    const handleEl = document.getElementById('wplace_resize_handle');

    // load persisted size (and clamp)
    function clampSize(w, h) {
      const vw = Math.max(200, window.innerWidth - MAX_PADDING);
      const vh = Math.max(120, window.innerHeight - MAX_PADDING);
      const W = Math.min(Math.max(Math.round(w), MIN.width), vw);
      const H = Math.min(Math.max(Math.round(h), MIN.height), vh);
      return { W, H };
    }

    async function loadSize() {
      let size = null;
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          const res = await new Promise(resolve => chrome.storage.local.get([SIZE_KEY], resolve));
          if (res && res[SIZE_KEY]) size = res[SIZE_KEY];
        } else {
          const raw = localStorage.getItem(SIZE_KEY);
          if (raw) size = JSON.parse(raw);
        }
      } catch (e) { size = null; }
      if (!size || typeof size.width !== 'number' || typeof size.height !== 'number') {
        size = DEFAULT;
      }
      const clamped = clampSize(size.width, size.height);
      applySize(clamped.W, clamped.H, { persist: false });
    }

    function saveSize(w, h) {
      const obj = { width: Math.round(w), height: Math.round(h) };
      try {
        if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ [SIZE_KEY]: obj });
        else localStorage.setItem(SIZE_KEY, JSON.stringify(obj));
      } catch (e) { try { localStorage.setItem(SIZE_KEY, JSON.stringify(obj)); } catch(_) {} }
    }

    function applySize(w, h, opts = { persist: true }) {
      try {
        rootEl.style.width = w + 'px';
        rootEl.style.height = h + 'px';
        // ensure maxWidth doesn't exceed viewport
        rootEl.style.maxWidth = Math.max(200, window.innerWidth - 8) + 'px';
        if (opts.persist) saveSize(w, h);
        // clamp position so panel stays in viewport
        clampPositionIntoView();
      } catch (e) {}
    }

    function clampPositionIntoView() {
      try {
        const rect = rootEl.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let left = rect.left, top = rect.top, w = rect.width, h = rect.height;
        const padding = 8;
        if (left + w > vw - padding) left = Math.max(padding, vw - w - padding);
        if (top + h > vh - padding) top = Math.max(padding, vh - h - padding);
        if (left < padding) left = padding;
        if (top < padding) top = padding;
        rootEl.style.left = Math.round(left) + 'px';
        rootEl.style.top = Math.round(top) + 'px';
        // persist pos as your existing logic does
        try { chrome.storage.local.set({ wplace_position: { left: Math.round(left), top: Math.round(top) } }); } catch (e) { try { localStorage.setItem('wplace_position', JSON.stringify({ left: Math.round(left), top: Math.round(top) })); } catch(_) {} }
      } catch (e) {}
    }

    // pointer drag handling
    let dragging = false;
    let pointerId = null;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      pointerId = e.pointerId;
      handleEl.setPointerCapture && handleEl.setPointerCapture(pointerId);
      startX = e.clientX;
      startY = e.clientY;
      const rect = rootEl.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: false });
      window.addEventListener('pointercancel', onPointerUp, { passive: false });
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newW = startW + dx;
      const newH = startH + dy;
      const { W, H } = clampSize(newW, newH);
      applySize(W, H, { persist: false });
    }

    function onPointerUp(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      handleEl.releasePointerCapture && handleEl.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.body.style.userSelect = '';
      // persist final
      const rect = rootEl.getBoundingClientRect();
      saveSize(rect.width, rect.height);
      // ensure still visible
      clampPositionIntoView();
    }

    handleEl.addEventListener('pointerdown', onPointerDown, { passive: false });

    // double-click handle to reset to default size
    handleEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      applySize(DEFAULT.width, DEFAULT.height, { persist: true });
    });

    // ensure panel resizes/clamps on window resize
    window.addEventListener('resize', () => {
      try {
        const rect = rootEl.getBoundingClientRect();
        const clamped = clampSize(rect.width, rect.height);
        applySize(clamped.W, clamped.H, { persist: true });
        clampPositionIntoView();
      } catch (e) {}
    });

    // initialize saved size (async)
    loadSize();

    // small accessibility: increase hit area for handle on touch
    try {
      handleEl.style.touchAction = 'none';
    } catch (e) {}

  } catch (e) {
    console.warn('installResizableRoot failed', e);
  }
})();

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
  const favBtn = root.querySelector("#wplace_fav_btn");
  const favManagerBtn = root.querySelector("#wplace_fav_manager_btn");
  const rulerBtn = root.querySelector("#wplace_ruler_btn");
  const checkUpdateBtn = root.querySelector('#wplace_check_update');

  function updateJumpBtnState() {
    const ok = (function(){ 
      try {
        if (!inputEl) return false;
        const parts = (inputEl.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        return parts.length === 4 && parts.every(s => !Number.isNaN(Number(s)));
      } catch(e){ return false; }
    })();
    if (!jumpBtn) return;
    if (ok) {
      jumpBtn.classList.remove('secondary');
      jumpBtn.disabled = false;
      jumpBtn.style.opacity = ''; // optional: 恢复不透明度
    } else {
      // 保持视觉为 secondary（灰色）
      jumpBtn.classList.add('secondary');
      jumpBtn.disabled = false; // 注意：不必真正禁用，否则 keyboard 无法聚焦；若要彻底禁用可设 true
      jumpBtn.style.opacity = '0.82'; // optional
    }
  }

  (function installButtonTooltips() {
  try {
    const map = [
      { el: shareBtn, key: 'share' },
      { el: jumpBtn, key: 'jump' },
      { el: favBtn, key: 'fav_add_2' },
      { el: favManagerBtn, key: 'fav_load' }, // favorites manager
      { el: rulerBtn, key: 'ruler_title' },
      { el: checkUpdateBtn, key: 'check_updates' },
      { el: minBtn, key: 'minimized_tip' }
    ];

    // safe setter: set title and aria-label (defensive)
    function setTooltip(node, text) {
      if (!node) return;
      try { node.title = text; } catch (e) {}
      try { node.setAttribute && node.setAttribute('aria-label', text); } catch (e) {}
    }

    // initialize
    for (const item of map) {
      try {
        const txt = t(item.key);
        setTooltip(item.el, txt);
      } catch (e) {}
    }

    // special case: map style button if present
    try {
      const mbtn = document.getElementById('wplace_map_style_btn');
      if (mbtn) setTooltip(mbtn, t('choose_map'));
    } catch (e) {}

    // theme selector: set title
    try {
      const themeSel = document.getElementById('wplace_theme_sel');
      if (themeSel) {
        try { themeSel.title = t('theme_default'); } catch (e) {}
      }
    } catch (e) {}

    // Expose updater so language-change handler can call it
    window.__wplace_update_button_tooltips = function() {
      try {
        for (const item of map) {
          try {
            const txt = t(item.key);
            setTooltip(item.el, txt);
          } catch (e) {}
        }
        try {
          const mbtn = document.getElementById('wplace_map_style_btn');
          if (mbtn) setTooltip(mbtn, t('choose_map'));
        } catch (e) {}
        try {
          const themeSel = document.getElementById('wplace_theme_sel');
          if (themeSel) themeSel.title = t('theme_default');
        } catch (e) {}
      } catch (e) {}
    };

    // call once to be safe
    try { window.__wplace_update_button_tooltips(); } catch (e) {}
  } catch (e) {
    console.warn('installButtonTooltips failed', e);
  }
})();
  if (inputEl) {
    inputEl.addEventListener('input', updateJumpBtnState);
    // 立刻运行一次以初始化状态
    updateJumpBtnState();
  }

  try {
    if (checkUpdateBtn) {
      checkUpdateBtn.textContent = '⇧';
      checkUpdateBtn.style.fontSize = '18px';
      checkUpdateBtn.style.lineHeight = '1';
      checkUpdateBtn.style.padding = '7px 11px';
      checkUpdateBtn.title = t('check_updates');
      checkUpdateBtn.setAttribute('aria-label', t('check_updates'));
    }
  } catch(e){}

// 小的 toast 包装（优先使用 showToast）
function showMainToast(msg, timeout=2500) {
  try { showToast(msg, timeout); } catch (e) {
    try {
      if (toast) {
        toast.style.display = 'block';
        toast.textContent = msg;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(()=>{ toast.style.display='none'; }, timeout);
      } else { console.log(msg); }
    } catch(_) { console.log(msg); }
  }
}

(function installMapStylePanel() {
  try {
    const parentRow = root.querySelector('#wplace_body > div') || root.querySelector('#wplace_controls') || root.querySelector('#wplace_body');
    if (!parentRow) return;

    const wrap = document.createElement('div');
    wrap.id = 'wplace_map_style_btn_wrap';
    wrap.style.display = 'inline-block';
    wrap.style.verticalAlign = 'middle';
    wrap.style.marginLeft = '6px';
    const btn = document.createElement('button');
    btn.id = 'wplace_map_style_btn';
    btn.className = 'wplace_btn';
    btn.textContent = t('choose_map');
    btn.style.padding = '6px 10px';
    wrap.appendChild(btn);

    try {
      if (checkUpdateBtn && checkUpdateBtn.parentElement === parentRow) parentRow.insertBefore(wrap, checkUpdateBtn);
      else parentRow.appendChild(wrap);
    } catch (e) { parentRow.appendChild(wrap); }

    const panel = document.createElement('div');
    panel.id = 'wplace_map_style_panel';
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: 2147483647,
      width: '260px',
      background: 'rgba(12,12,12,0.98)',
      color: '#e8e8e8',
      borderRadius: '10px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
      padding: '8px',
      display: 'none',
      flexDirection: 'column',
      gap: '8px',
      fontFamily: 'sans-serif'
    });

    panel.innerHTML = `
      <div id="wplace_map_style_header" class="drag-handle" style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:grab;padding:6px 4px 8px 4px;font-weight:600;">
        <div>${t('choose_map')}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button id="wplace_map_style_close" class="wplace_btn small">✕</button>
        </div>
      </div>
      <div id="wplace_map_style_body" style="padding:4px 6px; display:flex;flex-direction:column;gap:10px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="wplace_toggle_strip_roads" />
          <span id="wplace_label_strip_roads">${t('remove_roads')}</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="wplace_toggle_strip_names" />
          <span id="wplace_label_strip_names">${t('remove_names')}</span>
        </label>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
          <button id="wplace_map_style_save" class="wplace_btn small">${t('save_and_refresh')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const chkRoads = panel.querySelector('#wplace_toggle_strip_roads');
    const chkNames = panel.querySelector('#wplace_toggle_strip_names');
    const closeBtn = panel.querySelector('#wplace_map_style_close');
    const saveBtn = panel.querySelector('#wplace_map_style_save');
    const headerHandle = panel.querySelector('.drag-handle');

    const KEY = 'wplace_map_style_cfg_v2';
    const POS_KEY = 'wplace_map_style_panel_pos_v1';

    (function ensureMapStyleCloseWorks() {
  try {
    const panel = document.getElementById('wplace_map_style_panel');
    if (!panel) return;

    // Remove any same-id elements that are not inside our panel to avoid collisions
    try {
      Array.from(document.querySelectorAll('#wplace_map_style_close')).forEach(el => {
        if (!panel.contains(el)) {
          try { el.remove(); } catch(_) {}
        }
      });
    } catch(e){}

    // Prefer panel-local button; if not present, create one inside the header actions container
    let btn = panel.querySelector('#wplace_map_style_close');
    if (!btn) {
      const hdrActions = panel.querySelector('.drag-handle > div') || panel.querySelector('.drag-handle') || panel;
      const wrapper = hdrActions.querySelector('div') || hdrActions;
      btn = document.createElement('button');
      try { btn.className = 'wplace_btn small'; } catch(_) {}
      btn.textContent = '✕';
      // insert to right-most area
      try { wrapper.appendChild(btn); } catch(e){ panel.insertBefore(btn, panel.firstChild); }
    }

    // Make the node robustly unique to panel by removing/avoiding a global id
    try {
      // keep accessibility labels but avoid global id collisions
      if (btn.id === 'wplace_map_style_close') {
        btn.removeAttribute('id');
        btn.setAttribute('data-wplace-close', '1');
      } else if (!btn.getAttribute('data-wplace-close')) {
        btn.setAttribute('data-wplace-close', '1');
      }
      // keep aria/title if present
      if (!btn.getAttribute('aria-label')) {
        try { btn.setAttribute('aria-label', 'Close map style'); } catch(_) {}
      }
    } catch(e){}

    // Safe handler that hides the panel and prevents interference
    function safeHide(ev) {
      try { ev && ev.stopPropagation && ev.stopPropagation(); } catch(_) {}
      try { ev && ev.preventDefault && ev.preventDefault(); } catch(_) {}
      try { panel.style.display = 'none'; } catch(_) {}
    }

    // Install pointerdown and click (capture) to maximize chance of receiving interaction
    try {
      if (!btn.__wplace_pointer_installed) {
        btn.addEventListener('pointerdown', function __wplace_ptrdown(ev){
          safeHide(ev);
        }, { capture: true, passive: false });
        btn.__wplace_pointer_installed = true;
      }
    } catch(e){}

    try {
      if (!btn.__wplace_click_installed) {
        btn.addEventListener('click', function __wplace_click(ev){
          safeHide(ev);
        }, { capture: true, passive: false });
        btn.__wplace_click_installed = true;
      }
    } catch(e){}

    // Global capture-phase guard: if some listener prevents event reaching button,
    // this capture listener will still see it and close the panel.
    if (!window.__wplace_map_style_global_capture_installed) {
    window.__wplace_map_style_global_capture_installed = function(ev) {
      try {
        // 获取事件路径，兼容各种浏览器
        const path = ev.composedPath ? ev.composedPath() : (ev.path || []);
        // 如果无法拿到路径，退回到 target 判断
        const nodes = (path && path.length) ? path : [ev.target];

        let clickedInsidePanel = false;
        let clickedCloseMarker = false;

        for (const n of nodes) {
          try {
            if (!n || n.nodeType !== 1) continue;
            if (n === panel || panel.contains(n)) { clickedInsidePanel = true; break; }
            if (n.getAttribute && n.getAttribute('data-wplace-close') === '1') { clickedCloseMarker = true; break; }
          } catch (_) {}
        }

        // 只在点击**panel 之外**并且不是我们显式标记的关闭控件时才隐藏 panel
        if (!clickedInsidePanel) {
          // allow explicit close marker to also close (kept for parity)
          if (clickedCloseMarker) {
            try { ev.stopImmediatePropagation && ev.stopImmediatePropagation(); ev.preventDefault && ev.preventDefault(); } catch(_) {}
          }
          try { panel.style.display = 'none'; } catch(_) {}
        }
      } catch (_) {}
    };
    document.addEventListener('click', window.__wplace_map_style_global_capture_installed, true);
  }


    // Monitor for accidental replacement of our button and rebind quickly if needed
    try {
      const mo = new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.type === 'childList' && m.removedNodes && m.removedNodes.length) {
            // if our data-wplace-close button was removed, re-run this function to re-create/rebind
            for (const r of m.removedNodes) {
              try {
                if (r && r.getAttribute && (r.getAttribute('data-wplace-close') === '1' || r.id === 'wplace_map_style_close')) {
                  // small timeout to let other scripts settle, then rebind
                  setTimeout(() => { try { ensureMapStyleCloseWorks(); } catch(_) {} }, 30);
                  return;
                }
              } catch(_) {}
            }
          }
        }
      });
      mo.observe(panel, { childList: true, subtree: true });
      // Disconnect observer after a short time to avoid long-lived observers; keep it alive for e.g. 5s
      setTimeout(() => { try { mo.disconnect(); } catch(_) {} }, 5000);
    } catch(e){}

    // Ensure panel is clickable
    try {
      if (getComputedStyle(panel).pointerEvents === 'none') panel.style.pointerEvents = 'auto';
      if (!panel.style.zIndex) panel.style.zIndex = String(2147483647);
    } catch(e){}

  } catch (e) {
    try { console.warn('ensureMapStyleCloseWorks failed', e); } catch(_) {}
  }
})();

    async function loadState() {
      let state = { stripRoads: true, stripNames: true };
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          const res = await new Promise(resolve => chrome.storage.local.get([KEY], resolve));
          if (res && res[KEY]) state = Object.assign(state, res[KEY]);
        } else {
          const raw = localStorage.getItem(KEY);
          if (raw) state = Object.assign(state, JSON.parse(raw));
        }
      } catch (e) {
        try { const raw = localStorage.getItem(KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch(_) {}
      }
      chkRoads.checked = !!state.stripRoads;
      chkNames.checked = !!state.stripNames;
      postConfigToPage(state);
    }

    function saveState(state) {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [KEY]: state });
        } else {
          localStorage.setItem(KEY, JSON.stringify(state));
        }
      } catch (e) {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(_) {}
      }
    }

    function postConfigToPage(cfg) {
      try {
        window.postMessage(Object.assign({ __wplace_style_patch: 'SET_CONFIG' }, cfg), '*');
      } catch (e) {}
    }

    function showPanel() {
      panel.style.display = 'flex';
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([POS_KEY], res => {
            const p = res && res[POS_KEY];
            if (p && typeof p.left === 'number' && typeof p.top === 'number') {
              panel.style.left = p.left + 'px'; panel.style.top = p.top + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
            } else {
              const rect = btn.getBoundingClientRect();
              panel.style.left = Math.max(8, Math.round(rect.left)) + 'px';
              panel.style.top = Math.min(window.innerHeight - 120, Math.round(rect.bottom + 8)) + 'px';
            }
          });
        } else {
          const raw = localStorage.getItem(POS_KEY);
          if (raw) {
            const p = JSON.parse(raw);
            if (p && typeof p.left === 'number' && typeof p.top === 'number') {
              panel.style.left = p.left + 'px'; panel.style.top = p.top + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
            } else {
              const rect = btn.getBoundingClientRect();
              panel.style.left = Math.max(8, Math.round(rect.left)) + 'px';
              panel.style.top = Math.min(window.innerHeight - 120, Math.round(rect.bottom + 8)) + 'px';
            }
          } else {
            const rect = btn.getBoundingClientRect();
            panel.style.left = Math.max(8, Math.round(rect.left)) + 'px';
            panel.style.top = Math.min(window.innerHeight - 120, Math.round(rect.bottom + 8)) + 'px';
          }
        }
      } catch (e) {}
    }
    function hidePanel() { panel.style.display = 'none'; }

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (panel.style.display === 'none' || panel.style.display === '') {
        loadState(); showPanel();
      } else hidePanel();
    });

    closeBtn.addEventListener('click', () => { hidePanel(); });

    saveBtn.addEventListener('click', () => {
      const cfg = { stripRoads: !!chkRoads.checked, stripNames: !!chkNames.checked };
      saveState(cfg);
      postConfigToPage(cfg);
      try { showToast && showToast(t('fav_saved_label') || 'Saved'); } catch (e) {}
      setTimeout(() => {
        try { location.reload(); } catch (e) { try { top.location.reload(); } catch (_) {} }
      }, 200);
    });

    document.addEventListener('click', (ev) => {
    try {
      const target = ev.target;
      // 忽略任何在地图样式 panel 或其按钮上的点击
      if (panel && panel.contains(target)) return;
      if (wrap && wrap.contains(target)) return;
      // 忽略点击主面板（wplace_locator）及其子元素
      const mainRoot = document.getElementById('wplace_locator');
      if (mainRoot && mainRoot.contains(target)) return;
      // 其余情况才关闭
      hidePanel();
    } catch (e) {
      // 如果出现异常，保守起见不自动关闭
    }
  }, true);

    (function makeDraggable(el, handle){
      const padding = 6;
      let dragging = false, pointerId = null, startX = 0, startY = 0, startLeft = 0, startTop = 0;
      if (!handle) handle = el;
      handle.style.cursor = 'grab';
      handle.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        pointerId = e.pointerId;
        handle.setPointerCapture && handle.setPointerCapture(pointerId);
        startX = e.clientX; startY = e.clientY;
        const rect = el.getBoundingClientRect();
        startLeft = rect.left; startTop = rect.top;
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onMove, { passive:false });
        window.addEventListener('pointerup', onUp, { passive:false });
        window.addEventListener('pointercancel', onUp, { passive:false });
        handle.style.cursor = 'grabbing';
      });
      function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
      function onMove(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        e.preventDefault();
        const dx = e.clientX - startX, dy = e.clientY - startY;
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = el.offsetWidth, h = el.offsetHeight;
        let L = Math.round(startLeft + dx), T = Math.round(startTop + dy);
        L = clamp(L, padding, Math.max(padding, vw - w - padding));
        T = clamp(T, padding, Math.max(padding, vh - h - padding));
        el.style.left = L + 'px'; el.style.top = T + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
      }
      function onUp(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        handle.releasePointerCapture && handle.releasePointerCapture(pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        handle.style.cursor = 'grab';
        document.body.style.userSelect = '';
        try {
          const rect = el.getBoundingClientRect();
          const pos = { left: Math.round(rect.left), top: Math.round(rect.top) };
          if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ [POS_KEY]: pos });
          else localStorage.setItem(POS_KEY, JSON.stringify(pos));
        } catch (e) {}
      }
      el.style.position = 'fixed';
    })(panel, headerHandle);

    (async function init() {
      try { await loadState(); } catch (e) {}
    })();

  } catch (e) {
    console.warn('installMapStylePanel failed', e);
  }
})();

function updateMapStyleI18n() {
  try {
    // 主按钮（显示一个地图图标）
    const mainBtn = document.getElementById('wplace_map_style_btn');
    if (mainBtn) mainBtn.textContent = "🗺️";

    // Panel title
    const headerTitle = document.querySelector('#wplace_map_style_panel .drag-handle > div');
    if (headerTitle) headerTitle.textContent = t('choose_map');

    // Labels
    const labelRoads = document.getElementById('wplace_label_strip_roads');
    if (labelRoads) labelRoads.textContent = t('remove_roads');

    const labelNames = document.getElementById('wplace_label_strip_names');
    if (labelNames) labelNames.textContent = t('remove_names');

    // Save button
    const saveBtn = document.getElementById('wplace_map_style_save');
    if (saveBtn) saveBtn.textContent = t('save_and_refresh');

    // Close button attributes only — 不在这里重新绑定点击事件以避免引用不存在的 hidePanel
    const closeBtn = document.getElementById('wplace_map_style_close');
    if (closeBtn) {
      try {
        closeBtn.setAttribute('aria-label', t('choose_map'));
        closeBtn.title = t('choose_map');
      } catch (e) {}
      // 安全回退：如果没有原先的关闭绑定，则提供一个本地安全 handler（不依赖外部 hidePanel）
      // 但仅在没有已有 click listener（或已经存在但不可用）时才添加，避免覆盖原有逻辑。
      // 我们用 a flag 来避免重复添加。
      try {
        if (!closeBtn.__wplace_close_installed) {
          closeBtn.addEventListener('click', (ev) => {
            try {
              ev.stopPropagation();
            } catch (e) {}
            try {
              const panel = document.getElementById('wplace_map_style_panel');
              if (panel) panel.style.display = 'none';
            } catch (e) {}
          });
          closeBtn.__wplace_close_installed = true;
        }
      } catch (e) {}
    }
  } catch (e) { /* ignore */ }
}

try { updateMapStyleI18n(); } catch (e) {}

// 调用点 B: 在语言切换处理器中确保调用（在 langSel.addEventListener('change', ...) 的末尾加入）
try {
  // 如果你的已有 handler 已有多处更新调用，把下面这一行加入到最后：
  updateMapStyleI18n();
} catch (e) {};

// 尝试读取本地版本
async function getLocalVersionMain() {
  try {
    // 1) Preferred: chrome.runtime.getManifest (synchronous, available in extensions)
    try {
      if (window.chrome && chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
        const manifest = chrome.runtime.getManifest();
        if (manifest && manifest.version) return String(manifest.version);
      }
    } catch (e) {}

    // 2) Fallback: manifest.json via chrome.runtime.getURL + fetch
    try {
      if (window.chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        const url = chrome.runtime.getURL('manifest.json');
        const r = await fetch(url, { cache: 'no-store' }).catch(()=>null);
        if (r && r.ok) {
          const j = await r.json().catch(()=>null);
          if (j && j.version) return String(j.version);
        }
      }
    } catch (e) {}

    // 3) Fallback: any bundled meta file (wplace_meta.json)
    try {
      if (window.chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        const url2 = chrome.runtime.getURL('wplace_meta.json');
        const r2 = await fetch(url2, { cache: 'no-store' }).catch(()=>null);
        if (r2 && r2.ok) {
          const j2 = await r2.json().catch(()=>null);
          if (j2 && j2.version) return String(j2.version);
        }
      }
    } catch (e) {}

    // 4) Fallback: localStorage / window variables (compat with existing code)
    try {
      const raw = localStorage.getItem('wplace_local_meta') || localStorage.getItem('wplace_local_version') || localStorage.getItem('wplace_version');
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p && p.version) return String(p.version);
        } catch (e) {
          return String(raw);
        }
      }
    } catch (e) {}

    try {
      if (window.__wplace_local_version) return String(window.__wplace_local_version);
      if (window.__wplace_meta && window.__wplace_meta.version) return String(window.__wplace_meta.version);
    } catch (e) {}

  } catch (e) {
    // swallow and return null at end
  }
  return null;
}

// semver-like compare: returns -1 if a<b, 0 if equal, 1 if a>b, null if cannot compare
function compareVersionsMain(a, b) {
  // normalize: remove BOM/zero-width, trim, extract tag from GH URL, remove leading v/V
  function normalizeRaw(v) {
    if (v === null || typeof v === 'undefined') return null;
    try {
      let s = String(v);
      s = s.replace(/[\u200B-\u200F\uFEFF]/g, ''); // strip invisible chars
      s = s.trim();
      // if input is a GH release URL containing /tag/, extract the tag part
      try {
        if (/\/tag\//i.test(s)) {
          const m = s.match(/\/tag\/([^\/\?#]+)/i);
          if (m && m[1]) s = decodeURIComponent(m[1]);
        }
      } catch (e) {}
      // remove leading v or V and optional whitespace
      s = s.replace(/^[vV]\s*/, '');
      // final trim
      s = s.trim();
      return s.length ? s : null;
    } catch (e) {
      return null;
    }
  }

  // split main numeric dotted part and suffix
  function splitMainAndSuffix(s) {
    const m = String(s).match(/^([0-9]+(?:\.[0-9]+)*)(.*)$/);
    if (m) return { main: m[1], suffix: (m[2] || '') };
    return { main: '0', suffix: s };
  }

  // tokenize suffix into segments for comparison
  function tokenizeSuffix(s) {
    return s.replace(/^[\.\-\+_]+/, '').split(/[\.\-\+_]+/).filter(Boolean);
  }

  const na = normalizeRaw(a);
  const nb = normalizeRaw(b);
  if (!na || !nb) return null;

  // If exactly identical strings after normalization, short-circuit to equal
  if (na === nb) return 0;

  const A = splitMainAndSuffix(na);
  const B = splitMainAndSuffix(nb);

  const partsA = A.main.split('.').map(x => (x === '' ? 0 : Number(x)));
  const partsB = B.main.split('.').map(x => (x === '' ? 0 : Number(x)));
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const va = (i < partsA.length && Number.isFinite(partsA[i])) ? partsA[i] : 0;
    const vb = (i < partsB.length && Number.isFinite(partsB[i])) ? partsB[i] : 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }

  // numeric main equal -> suffix handling (stable > pre-release)
  const sa = (A.suffix || '').trim();
  const sb = (B.suffix || '').trim();
  if (!sa && !sb) return 0;
  if (!sa && sb) return 1;
  if (sa && !sb) return -1;

  const ta = tokenizeSuffix(sa);
  const tb = tokenizeSuffix(sb);
  const tlen = Math.max(ta.length, tb.length);
  for (let i = 0; i < tlen; i++) {
    const xa = i < ta.length ? ta[i] : '';
    const xb = i < tb.length ? tb[i] : '';
    const naNum = (xa !== '' && !isNaN(Number(xa))) ? Number(xa) : null;
    const nbNum = (xb !== '' && !isNaN(Number(xb))) ? Number(xb) : null;

    if (naNum !== null && nbNum !== null) {
      if (naNum < nbNum) return -1;
      if (naNum > nbNum) return 1;
    } else if (naNum !== null && nbNum === null) {
      return -1;
    } else if (naNum === null && nbNum !== null) {
      return 1;
    } else {
      const ca = String(xa);
      const cb = String(xb);
      if (ca < cb) return -1;
      if (ca > cb) return 1;
    }
  }

  return 0;
}

async function initLocalVersionFromManifest() {
  try {
    // try to read already-known values first
    let existing = null;
    try { existing = localStorage.getItem('wplace_local_version') || localStorage.getItem('wplace_local_meta'); } catch(e){ existing = null; }
    if (existing) return; // already initialized

    // try manifest.json via chrome.runtime.getURL if available
    try {
      if (chrome && chrome.runtime && chrome.runtime.getURL) {
        const url = chrome.runtime.getURL('manifest.json');
        const resp = await fetch(url, { cache: 'no-store' }).catch(()=>null);
        if (resp && resp.ok) {
          const j = await resp.json().catch(()=>null);
          if (j && j.version) {
            try { localStorage.setItem('wplace_local_version', String(j.version)); } catch(e){}
            try { window.__wplace_local_version = String(j.version); } catch(e){}
            return;
          }
        }
      }
    } catch(e){}

    // fallback: try wplace_meta.json (if you bundle one)
    try {
      if (chrome && chrome.runtime && chrome.runtime.getURL) {
        const url2 = chrome.runtime.getURL('wplace_meta.json');
        const r2 = await fetch(url2, { cache: 'no-store' }).catch(()=>null);
        if (r2 && r2.ok) {
          const m2 = await r2.json().catch(()=>null);
          if (m2 && m2.version) {
            try { localStorage.setItem('wplace_local_version', String(m2.version)); } catch(e){}
            try { window.__wplace_local_version = String(m2.version); } catch(e){}
            return;
          }
        }
      }
    } catch(e){}

    // final fallback: read manifest via relative URL (rare in MV3 but harmless)
    try {
      const r3 = await fetch('/manifest.json', { cache: 'no-store' }).catch(()=>null);
      if (r3 && r3.ok) {
        const j3 = await r3.json().catch(()=>null);
        if (j3 && j3.version) {
          try { localStorage.setItem('wplace_local_version', String(j3.version)); } catch(e){}
          try { window.__wplace_local_version = String(j3.version); } catch(e){}
          return;
        }
      }
    } catch(e){}
  } catch (err) {
    // silent fail — initialization best-effort only
    try { console.debug('initLocalVersionFromManifest failed', err); } catch(_) {}
  }
}

// call it once (no await required to avoid blocking UI)
async function ensureLocalVersionIsSet() {
  try {
    // 如果已有值则不覆盖
    try {
      const existing = localStorage.getItem('wplace_local_version') || localStorage.getItem('wplace_local_meta') || (window.__wplace_local_version || null);
      if (existing && String(existing).trim().length) return;
    } catch(e) {}

    // 1) 尝试通过 chrome.runtime.getURL 读取 manifest.json
    try {
      if (window.chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        const url = chrome.runtime.getURL('manifest.json');
        const r = await fetch(url, { cache: 'no-store' }).catch(()=>null);
        if (r && r.ok) {
          const j = await r.json().catch(()=>null);
          if (j && j.version) {
            const v = String(j.version).trim();
            try { localStorage.setItem('wplace_local_version', v); } catch(_) {}
            try { window.__wplace_local_version = v; } catch(_) {}
            try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ wplace_local_version: v }); } catch(_) {}
            return;
          }
        }
      }
    } catch(e){}

    // 2) 回退到扩展打包的自定义 meta 文件（如果有）
    try {
      if (window.chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        const url2 = chrome.runtime.getURL('wplace_meta.json');
        const r2 = await fetch(url2, { cache: 'no-store' }).catch(()=>null);
        if (r2 && r2.ok) {
          const m2 = await r2.json().catch(()=>null);
          if (m2 && m2.version) {
            const v2 = String(m2.version).trim();
            try { localStorage.setItem('wplace_local_version', v2); } catch(_) {}
            try { window.__wplace_local_version = v2; } catch(_) {}
            try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ wplace_local_version: v2 }); } catch(_) {}
            return;
          }
        }
      }
    } catch(e){}

    // 3) 开发/页面相对路径兜底（在某些调试场景有用）
    try {
      const r3 = await fetch('/manifest.json', { cache: 'no-store' }).catch(()=>null);
      if (r3 && r3.ok) {
        const j3 = await r3.json().catch(()=>null);
        if (j3 && j3.version) {
          const v3 = String(j3.version).trim();
          try { localStorage.setItem('wplace_local_version', v3); } catch(_) {}
          try { window.__wplace_local_version = v3; } catch(_) {}
          try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ wplace_local_version: v3 }); } catch(_) {}
          return;
        }
      }
    } catch(e){}

    // 4) 若所有外部读取都失败，且 manifest/version 无法拿到，可尝试从已有 local keys 中解析并写入标准 key
    try {
      const candidates = [
        localStorage.getItem('wplace_local_meta'),
        localStorage.getItem('wplace_meta'),
        localStorage.getItem('wplace_version'),
        localStorage.getItem('wplace_local_version')
      ];
      for (const c of candidates) {
        if (!c) continue;
        try {
          const p = JSON.parse(c);
          if (p && p.version) {
            const v4 = String(p.version).trim();
            try { localStorage.setItem('wplace_local_version', v4); } catch(_) {}
            try { window.__wplace_local_version = v4; } catch(_) {}
            try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ wplace_local_version: v4 }); } catch(_) {}
            return;
          }
        } catch(_) {
          // 如果不是 JSON，直接认为它就是版本字符串
          const s = String(c).trim();
          if (s.length) {
            try { localStorage.setItem('wplace_local_version', s); } catch(_) {}
            try { window.__wplace_local_version = s; } catch(_) {}
            try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ wplace_local_version: s }); } catch(_) {}
            return;
          }
        }
      }
    } catch(e){}

  } catch (err) {
    try { console.debug('ensureLocalVersionIsSet failed', err); } catch(_) {}
  }
}

// 立即执行一次（不阻塞主流程）
try { ensureLocalVersionIsSet(); } catch(e) {}


// fetch latest release from GitHub
async function fetchLatestReleaseMain() {
  try {
    const api = 'https://api.github.com/repos/lin-alg/Wplace_Locator/releases/latest';
    const r = await fetch(api, { cache: 'no-store' });
    if (!r || !r.ok) throw new Error('gh fetch failed');
    const j = await r.json();
    return j;
  } catch (e) {
    return null;
  }
}

// 主检查更新函数（被按钮调用）
async function checkForUpdatesMain() {
  if (!checkUpdateBtn) return;

  function extractTagFromGH(gh) {
    if (!gh) return null;
    if (gh.tag_name && String(gh.tag_name).trim().length) return String(gh.tag_name);
    if (gh.name && String(gh.name).trim().length) return String(gh.name);
    const u = gh.html_url || gh.url || '';
    if (u && typeof u === 'string') {
      try {
        const m = u.match(/\/tag\/([^\/\?#]+)/i);
        if (m && m[1]) return decodeURIComponent(m[1]);
      } catch (e) {}
    }
    return null;
  }

  function normalizeForDisplay(v) {
    if (v === null || typeof v === 'undefined') return null;
    try {
      return String(v).replace(/[\u200B-\u200F\uFEFF]/g, '').trim();
    } catch (e) { return String(v); }
  }

  try {
    checkUpdateBtn.disabled = true;
    const prev = checkUpdateBtn.textContent;
    showMainToast(t('checking_updates'));

    const [localRaw, gh] = await Promise.all([getLocalVersionMain(), fetchLatestReleaseMain().catch(()=>null)]);
    const remoteRaw = extractTagFromGH(gh); // e.g. "v2.0" or "2.0" or null

    const localNorm = localRaw ? localRaw.toString().replace(/^[\u200B-\u200F\uFEFF]+/, '').trim().replace(/^[vV]\s*/, '') : null;
    const remoteNorm = remoteRaw ? remoteRaw.toString().replace(/^[\u200B-\u200F\uFEFF]+/, '').trim().replace(/^[vV]\s*/, '') : null;

    // If both normalized values exist and are exactly equal -> show up-to-date
    if (localNorm && remoteNorm && localNorm === remoteNorm) {
      showMainToast(`${t('up_to_date')}: v${normalizeForDisplay(localNorm)}`);
      try { checkUpdateBtn.textContent = prev; checkUpdateBtn.disabled = false; } catch(e){}
      return;
    }

    // proceed to compare using robust comparator
    if (!localNorm && !remoteNorm) {
      showMainToast(t('update_fail'));
      try { checkUpdateBtn.textContent = prev; checkUpdateBtn.disabled = false; } catch(e){}
      return;
    }

    if (!remoteNorm && localNorm) {
      showMainToast(`${t('up_to_date')}: ${normalizeForDisplay(localNorm)}`);
      try { checkUpdateBtn.textContent = prev; checkUpdateBtn.disabled = false; } catch(e){}
      return;
    }

    if (!localNorm && remoteNorm) {
      const msg = `${t('update_available')} ${normalizeForDisplay(remoteRaw || remoteNorm)}`;
      showMainToast(msg, 6000);
      if (confirm(`${msg}\n\n${gh && gh.html_url ? gh.html_url : 'https://github.com/lin-alg/Wplace_Locator/releases'}\n\nOpen release page?`)) {
        try { window.open((gh && gh.html_url) || 'https://github.com/lin-alg/Wplace_Locator/releases', '_blank'); } catch(_) {}
      }
      try { checkUpdateBtn.textContent = prev; checkUpdateBtn.disabled = false; } catch(e){}
      return;
    }

    const cmp = compareVersionsMain(localNorm, remoteNorm);
    if (cmp === null) {
      showMainToast(t('update_fail'));
    } else if (cmp < 0) {
      const msg = `${t('update_available')} ${normalizeForDisplay(remoteRaw || remoteNorm)}`;
      showMainToast(msg, 6000);
      if (confirm(`${msg}\n\n${gh && gh.html_url ? gh.html_url : 'https://github.com/lin-alg/Wplace_Locator/releases'}\n\nOpen release page?`)) {
        try { window.open((gh && gh.html_url) || 'https://github.com/lin-alg/Wplace_Locator/releases', '_blank'); } catch(_) {}
      }
    } else {
      showMainToast(`${t('up_to_date')}: v${normalizeForDisplay(localRaw || localNorm)}`);
    }

    try { checkUpdateBtn.textContent = prev; checkUpdateBtn.disabled = false; } catch(e){}
  } catch (e) {
    console.error('checkForUpdatesMain error', e);
    try { showMainToast(t('update_fail')); } catch(_) {}
    try { checkUpdateBtn.textContent = t('check_updates'); checkUpdateBtn.disabled = false; } catch(_) {}
  }
}


// 绑定点击事件
try {
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', (ev) => {
      try { checkForUpdatesMain(); } catch(e) {}
    });
  }
} catch(e){}
  langSel.value = lang;
  // 更全面且稳健的语言切换处理器（替换原有的 change handler）
  langSel.addEventListener("change", () => {
  lang = langSel.value;
  try { localStorage.setItem("wplace_lang", lang); } catch (e) {}

  try {
  if (typeof window.__wplace_update_button_tooltips === 'function') {
    window.__wplace_update_button_tooltips();
  }
  } catch (e) {}
  // 更新主面板静态文本
  try {
    const titleEl = root.querySelector("#wplace_title");
    if (titleEl) titleEl.textContent = t("title");

    const inputElLocal = root.querySelector("#wplace_input");
    if (inputElLocal) inputElLocal.placeholder = t("placeholder");

    const minBtnLocal = root.querySelector("#wplace_min_btn");
    if (minBtnLocal) minBtnLocal.title = t("minimized_tip");

    const favBtnLocal = root.querySelector("#wplace_fav_btn");
    if (favBtnLocal) favBtnLocal.title = t("fav_add");

    const favBtnLocal_2 = root.querySelector("#wplace_fav_btn");
    if (favBtnLocal) favBtnLocal.title = t("fav_add_2");
  } catch (e) {}

  // 尝试调用已存在的面板 i18n 更新函数；若不存在则做回退 DOM 更新
  try {
    try { updateFavManagerI18n(); } catch (e) {
      try {
        const m = document.getElementById('wplace_fav_manager');
        if (m) {
          const nm = m.querySelector('#wplace_fav_newname'); if (nm) nm.placeholder = t('fav_name_placeholder');
          const addBtn = m.querySelector('#wplace_fav_add_from_input'); if (addBtn) addBtn.textContent = t('fav_add');
          const btnCopy = m.querySelector('#wplace_fav_action_copy'); if (btnCopy) btnCopy.textContent = t('fav_copy');
          const btnJump = m.querySelector('#wplace_fav_action_jump'); if (btnJump) btnJump.textContent = t('fav_jump');
          const btnRename = m.querySelector('#wplace_fav_action_rename'); if (btnRename) btnRename.textContent = t('fav_rename');
          const btnDelete = m.querySelector('#wplace_fav_action_delete'); if (btnDelete) btnDelete.textContent = t('fav_delete');
        }
      } catch (e2) {}
    }
  } catch (e) {}

  try {
    try { updateRulerI18n(); } catch (e) {
      try {
        const r = document.getElementById('wplace_ruler_panel');
        if (r) {
          const hdr = r.querySelector('.drag-handle'); if (hdr) hdr.textContent = t('ruler_title');
          const ps = r.querySelector('#wplace_ruler_pick_start'); if (ps) ps.textContent = t('ruler_pick_start');
          const pe = r.querySelector('#wplace_ruler_pick_end'); if (pe) pe.textContent = t('ruler_pick_end');
          const cl = r.querySelector('#wplace_ruler_clear'); if (cl) cl.textContent = t('ruler_clear');
          const labels = Array.from(r.querySelectorAll('label'));
          if (labels[0]) labels[0].textContent = t('ruler_start_label');
          if (labels[1]) labels[1].textContent = t('ruler_end_label');
          const offEl = r.querySelector('#wplace_ruler_offsets'); if (offEl) offEl.textContent = `${t('ruler_offset_label')} —`;
          const areaEl = r.querySelector('#wplace_ruler_area'); if (areaEl) areaEl.textContent = `${t('ruler_area_label')} —`;
        }
      } catch (e2) {}
    }
  } catch (e) {}
  try {
    updateMapStyleI18n();
  } catch (e) {};
  // 如果收藏管理器有 refresh API，调用一次以确保内部也更新
  try {
    if (window.__wplace_fav_manager && typeof window.__wplace_fav_manager.refresh === 'function') {
      window.__wplace_fav_manager.refresh();
    }
  } catch (e) {}

  // 如果 ruler 模块暴露了 i18n 更新方法，调用它
  try {
    if (typeof window.__wplace_update_ruler_i18n === 'function') {
      window.__wplace_update_ruler_i18n();
    }
  } catch (e) {}
  try {
  const themeSel = document.getElementById('wplace_theme_sel');
  if (themeSel) {
    for (const opt of Array.from(themeSel.options)) {
      if (opt.value === 'custom-winter') opt.textContent = t('theme_default');
      else if (opt.value === 'dark') opt.textContent = t('theme_dark');
    }
  }
  } catch (e) {}
});


  function showToast(msg, timeout=2500) {
    toast.style.display = "block";
    toast.textContent = msg;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = "none"; }, timeout);
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

  // 更新收藏管理器中的所有可本地化文本（语言切换时调用）
  function updateFavManagerI18n() {
    const m = document.getElementById('wplace_fav_manager');
    if (!m) return; // 未创建则无需处理

    // header
    const hdr = m.querySelector(' .drag-handle');
    if (hdr) hdr.textContent = t('fav_manager');

    // footer placeholder & add button
    const nm = m.querySelector('#wplace_fav_newname');
    if (nm) nm.placeholder = t('fav_name_placeholder');
    const addBtn = m.querySelector('#wplace_fav_add_from_input');
    if (addBtn) addBtn.textContent = t('fav_add');

    // actions
    const btnLoad = m.querySelector('#wplace_fav_action_load');
    const btnCopy = m.querySelector('#wplace_fav_action_copy');
    const btnJump = m.querySelector('#wplace_fav_action_jump');
    const btnRename = m.querySelector('#wplace_fav_action_rename');
    const btnDelete = m.querySelector('#wplace_fav_action_delete');

    if (btnLoad) btnLoad.textContent = t('fav_load');
    if (btnCopy) btnCopy.textContent = t('fav_copy');
    if (btnJump) btnJump.textContent = t('fav_jump');
    if (btnRename) btnRename.textContent = t('fav_rename');
    if (btnDelete) btnDelete.textContent = t('fav_delete');

    // close button （如果你想本地化 X 也可）
    const closeBtn = m.querySelector('#wplace_fav_close');
    if (closeBtn) {
      try { closeBtn.setAttribute('aria-label', t('fav_manager')); } catch(e) {}
    }

    // 如果当前列表为空，更新提示文本
    const body = m.querySelector('#wplace_fav_body');
    if (body && body.children.length === 1) {
      const only = body.children[0];
      if (only && only.textContent && only.textContent.trim().length > 0) {
        if (only.textContent.trim() === 'No favorites yet' || only.textContent.trim() === '尚无收藏' || only.getAttribute('data-fav-empty')) {
          only.textContent = t('fav_empty');
        }
      }
    }

    try {
      if (window.__wplace_fav_manager && typeof window.__wplace_fav_manager.refresh === 'function') {
        window.__wplace_fav_manager.refresh();
      }
    } catch (e) {}
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

  // --------- Favorites storage helpers ----------
  const FAV_KEY = 'wplace_favorites_v1';
  function readFavorites() {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get([FAV_KEY], res => {
          const raw = res && res[FAV_KEY];
          if (Array.isArray(raw)) resolve(raw);
          else {
            try {
              const local = localStorage.getItem(FAV_KEY);
              resolve(local ? JSON.parse(local) : []);
            } catch(e){ resolve([]); }
          }
        });
      } catch(e) {
        try {
          const local = localStorage.getItem(FAV_KEY);
          resolve(local ? JSON.parse(local) : []);
        } catch(e2){ resolve([]); }
      }
    });
  }
  function writeFavorites(arr) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [FAV_KEY]: arr });
      } else {
        localStorage.setItem(FAV_KEY, JSON.stringify(arr));
      }
    } catch(e){
      try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch(_) {}
    }
  }
  function makeFavId() {
    return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  // --------- Favorite add button behavior ----------
  favBtn.addEventListener('click', async () => {
    const raw = inputEl.value || '';
    const parsed = parseFourCoords(raw);
    if (!parsed) { showToast(t("fav_no_input")); return; }
    const coords = parsed.join(', ');
    const favName = '';
    const item = { id: makeFavId(), name: favName, coords, createdAt: Date.now() };
    const list = await readFavorites();
    list.unshift(item);
    writeFavorites(list);
    showToast(t("fav_added"));
    if (window.__wplace_fav_manager && typeof window.__wplace_fav_manager.refresh === 'function') {
      window.__wplace_fav_manager.refresh();
    }
  });

  // --------- Stable draggable for panel ----------
  function installStableDraggable(rootEl, opts = {}) {
  const snapThreshold = typeof opts.snapThreshold === 'number' ? opts.snapThreshold : 6;
  // 最少可见边缘（确保用户能拖回）
  const MIN_VISIBLE = typeof opts.minVisible === 'number' ? opts.minVisible : 40;
  const padding = typeof opts.padding === 'number' ? opts.padding : 8;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function ensureLeftTop() {
    const rect = rootEl.getBoundingClientRect();
    rootEl.style.position = 'fixed';
    // 保持数值为整数，避免子像素抖动
    rootEl.style.left = Math.round(rect.left) + 'px';
    rootEl.style.top = Math.round(rect.top) + 'px';
    rootEl.style.right = 'auto';
    rootEl.style.bottom = 'auto';
  }
  ensureLeftTop();

  let dragging = false;
  let startPointerX = 0, startPointerY = 0, startLeft = 0, startTop = 0, pointerId = null;

  // 使用主面板顶部 header 作为把手，回退到 .drag-handle 或 root 本身
  let handle = null;
  try {
    handle = rootEl.querySelector('#wplace_header') || rootEl.querySelector('.drag-handle') || rootEl;
  } catch (e) {
    handle = rootEl;
  }

  // 指向 header 上的控制区（右侧最小化/语言/主题切换），拖拽时需要忽略这些控件
  let headerControls = null;
  try {
    headerControls = rootEl.querySelector('#wplace_controls') || rootEl.querySelector('.wplace_header_controls') || rootEl.querySelector('.controls') || null;
  } catch (e) {
    headerControls = null;
  }

  // 更友好的光标
  try { handle.style.cursor = 'grab'; } catch (e) {}

  function onPointerDown(e) {
    // 如果点击在 headerControls 上，不启动拖拽（保留控件原生交互）
    try { if (headerControls && headerControls.contains(e.target)) return; } catch(_) {}

    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    ensureLeftTop();
    dragging = true;
    pointerId = e.pointerId;
    try { handle.setPointerCapture && handle.setPointerCapture(pointerId); } catch (e) {}
    startPointerX = e.clientX; startPointerY = e.clientY;
    const rect = rootEl.getBoundingClientRect();
    startLeft = rect.left; startTop = rect.top;
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });
    try { handle.style.cursor = 'grabbing'; } catch (e) {}
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

    // 允许部分隐藏出屏，但保留 MIN_VISIBLE px 在视窗内
    const minLeft = -(w - MIN_VISIBLE);
    const maxLeft = Math.max(MIN_VISIBLE, vw - MIN_VISIBLE);
    const minTop = -(h - MIN_VISIBLE);
    const maxTop = Math.max(MIN_VISIBLE, vh - MIN_VISIBLE);

    targetLeft = clamp(Math.round(targetLeft), minLeft, maxLeft);
    targetTop = clamp(Math.round(targetTop), minTop, maxTop);

    if (snapThreshold > 0) {
      if (Math.abs(dx) <= snapThreshold && Math.abs(dy) <= snapThreshold) {
        // 小幅移动时不立即应用（避免误触）
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
    try { handle.releasePointerCapture && handle.releasePointerCapture(pointerId); } catch (e) {}
    pointerId = null;
    document.body.style.userSelect = '';
    document.body.style.touchAction = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    try { handle.style.cursor = 'grab'; } catch (e) {}

    try {
      const rect = rootEl.getBoundingClientRect();
      const pos = { left: Math.round(rect.left), top: Math.round(rect.top) };
      // 持久化位置（兼容 chrome.storage 和 localStorage）
      try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ wplace_position: pos }); else localStorage.setItem('wplace_position', JSON.stringify(pos)); } catch (e) { try { localStorage.setItem('wplace_position', JSON.stringify(pos)); } catch(_) {} }
    } catch (e) {}
  }

  try { handle.addEventListener('pointerdown', onPointerDown, { passive: false }); } catch (e) { rootEl.addEventListener && rootEl.addEventListener('pointerdown', onPointerDown, { passive: false }); }

  function destroy() {
    try { handle.removeEventListener('pointerdown', onPointerDown); } catch (e) {}
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  function setPosition(x, y) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = rootEl.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const minLeft = -(w - MIN_VISIBLE);
    const maxLeft = Math.max(MIN_VISIBLE, vw - MIN_VISIBLE);
    const minTop = -(h - MIN_VISIBLE);
    const maxTop = Math.max(MIN_VISIBLE, vh - MIN_VISIBLE);
    const targetLeft = clamp(Math.round(x), minLeft, maxLeft);
    const targetTop = clamp(Math.round(y), minTop, maxTop);
    rootEl.style.left = targetLeft + 'px';
    rootEl.style.top = targetTop + 'px';
  }

  // 暴露重绑定 API
  window.__wplace_rebind_draggable = function(reRoot){
    try {
      if (reRoot && reRoot.__draggable && typeof reRoot.__draggable.destroy === 'function') reRoot.__draggable.destroy();
    } catch(e){}
    const api = installStableDraggable(reRoot || rootEl, opts);
    return api;
  };

  // 尝试恢复之前保存的位置（保持兼容）
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
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
    } else {
      const raw = localStorage.getItem('wplace_position');
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p && typeof p.left === 'number' && typeof p.top === 'number') setPosition(p.left, p.top);
        } catch(e){}
      }
    }
  } catch(e){
    try {
      const raw = localStorage.getItem('wplace_position');
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.left === 'number' && typeof p.top === 'number') setPosition(p.left, p.top);
      }
    } catch(e){}
  }

  // 窗口 resize 时确保最少可见部分仍然可见
  window.addEventListener('resize', () => {
    try {
      const rect = rootEl.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const minLeft = -(rect.width - MIN_VISIBLE);
      const maxLeft = Math.max(MIN_VISIBLE, vw - MIN_VISIBLE);
      const minTop = -(rect.height - MIN_VISIBLE);
      const maxTop = Math.max(MIN_VISIBLE, vh - MIN_VISIBLE);
      const x = clamp(rect.left, minLeft, maxLeft);
      const y = clamp(rect.top, minTop, maxTop);
      rootEl.style.left = x + 'px';
      rootEl.style.top = y + 'px';
    } catch(e){}
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
  const zoom = 15;
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
      sel.title = 'Change theme|切换主题';
      sel.style.padding = '4px 6px';
      sel.style.borderRadius = '6px';
      sel.style.background = 'rgba(255,255,255,0.03)';
      sel.style.color = '#9aa0a6';
      sel.style.border = '1px solid rgba(255,255,255,0.06)';
      sel.style.webkitAppearance = 'none';
      sel.style.appearance = 'none';

    const options = [
      { key: 'theme_default', value: 'custom-winter' },
      { key: 'theme_dark', value: 'dark' }
    ];
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = t(o.key);
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

// --------- Favorites manager panel (draggable) implementation - click-to-select, footer actions ----------
(function favoritesManagerModule() {
  let mgr = null;
  let selectedId = null;
  let currentList = [];

  function createManager() {
  if (document.getElementById('wplace_fav_manager')) {
    return document.getElementById('wplace_fav_manager');
  }
  const m = document.createElement('div');
  m.id = 'wplace_fav_manager';
  m.setAttribute('role','dialog');
  Object.assign(m.style, {
    position: 'fixed',
    zIndex: 2147483647,
    width: '360px',
    maxWidth: '90vw',
    height: '340px',
    background: 'rgba(10,10,10,0.95)',
    color: '#e8e8e8',
    borderRadius: '10px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
    padding: '8px',
    display: 'none',
    flexDirection: 'column',
    overflow: 'hidden'
  });

  m.innerHTML = `
    <div id="wplace_fav_header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div class="drag-handle" style="font-weight:600;">📁</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button id="wplace_fav_close" class="wplace_btn small">✕</button>
      </div>
    </div>
    <div id="wplace_fav_body" style="margin-top:8px; overflow:auto; flex:1; padding-right:6px;"></div>
    <div id="wplace_fav_footer" style="margin-top:8px; display:flex; gap:8px; align-items:center;">
      <input id="wplace_fav_newname" placeholder="${t("fav_name_placeholder")}" style="flex:1; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:#e8e8e8;" />
      <button id="wplace_fav_add_from_input" class="wplace_btn small">${t("fav_add")}</button>
    </div>
    <div id="wplace_fav_actions" style="display:flex; gap:6px; margin-top:8px; border-top:1px solid rgba(255,255,255,0.04); padding-top:8px;">
      <button id="wplace_fav_action_copy" class="wplace_btn">${t("fav_copy")}</button>
      <button id="wplace_fav_action_jump" class="wplace_btn">${t("fav_jump")}</button>
      <button id="wplace_fav_action_rename" class="wplace_btn">${t("fav_rename")}</button>
      <button id="wplace_fav_action_delete" class="wplace_btn danger">${t("fav_delete")}</button>
    </div>
  `;
  document.body.appendChild(m);

  // 初始化位置（优先 chrome.storage.local 回退 localStorage）
  try {
    chrome.storage.local.get(['wplace_fav_manager_pos'], res => {
      const p = res && res.wplace_fav_manager_pos;
      if (p && typeof p.left === 'number' && typeof p.top === 'number') {
        m.style.left = p.left + 'px'; m.style.top = p.top + 'px';
      } else {
        m.style.right = '20px'; m.style.bottom = '80px';
      }
    });
  } catch(e){
    try {
      const raw = localStorage.getItem('wplace_fav_manager_pos');
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.left === 'number' && typeof p.top === 'number') {
          m.style.left = p.left + 'px'; m.style.top = p.top + 'px';
        } else { m.style.right = '20px'; m.style.bottom = '80px'; }
      } else { m.style.right = '20px'; m.style.bottom = '80px'; }
    } catch(e){ m.style.right = '20px'; m.style.bottom = '80px'; }
  }

  // 通过 header 可拖拽
  (function makeDraggable(el){
    const handle = el.querySelector('.drag-handle') || el;
    let dragging = false, pointerId=null, sx=0, sy=0, sl=0, st=0;
    handle.style.cursor = 'grab';
    handle.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      ev.preventDefault();
      dragging = true;
      pointerId = ev.pointerId;
      handle.setPointerCapture && handle.setPointerCapture(pointerId);
      sx = ev.clientX; sy = ev.clientY;
      const rect = el.getBoundingClientRect();
      sl = rect.left; st = rect.top;
      handle.style.cursor = 'grabbing';
      window.addEventListener('pointermove', onMove, { passive:false });
      window.addEventListener('pointerup', onUp, { passive:false });
      window.addEventListener('pointercancel', onUp, { passive:false });
    });
    function onMove(ev){
      if (!dragging || ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      const left = Math.round(sl + dx), top = Math.round(st + dy);
      el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.right='auto'; el.style.bottom='auto';
    }
    function onUp(ev){
      if (!dragging || ev.pointerId !== pointerId) return;
      dragging = false;
      handle.releasePointerCapture && handle.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      handle.style.cursor = 'grab';
      // persist 位置
      try {
        chrome.storage.local.set({ wplace_fav_manager_pos: { left: parseInt(el.style.left,10)||0, top: parseInt(el.style.top,10)||0 } });
      } catch(e){
        try { localStorage.setItem('wplace_fav_manager_pos', JSON.stringify({ left: parseInt(el.style.left,10)||0, top: parseInt(el.style.top,10)||0 })); } catch(_) {}
      }
    }
  })(m);

  // 关闭按钮
  m.querySelector('#wplace_fav_close').addEventListener('click', () => { hideManager(); });

  // 从输入添加收藏
  m.querySelector('#wplace_fav_add_from_input').addEventListener('click', async () => {
    const val = inputEl.value || '';
    const parsed = parseFourCoords(val);
    if (!parsed) { showToast(t("fav_no_input")); return; }
    const name = (m.querySelector('#wplace_fav_newname') || {value:''}).value || '';
    const item = { id: makeFavId(), name, coords: parsed.join(', '), createdAt: Date.now() };
    const arr = await readFavorites();
    arr.unshift(item);
    writeFavorites(arr);
    showToast(t("fav_added"));
    refreshList();
  });

  // footer action 按钮引用
  const btnCopy = m.querySelector('#wplace_fav_action_copy');
  const btnJump = m.querySelector('#wplace_fav_action_jump');
  const btnRename = m.querySelector('#wplace_fav_action_rename');
  const btnDelete = m.querySelector('#wplace_fav_action_delete');

  btnCopy.addEventListener('click', async () => {
    const item = currentList.find(x => x.id === selectedId);
    if (!item) { showToast(t('fav_empty')); return; }
    try {
      await navigator.clipboard.writeText(item.coords);
      showToast(`${t('copied')} ${item.coords}`);
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = item.coords;
        ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) showToast(`${t('copied')} ${item.coords}`);
        else showToast(t('copy_fail'));
      } catch(_) { showToast(t('copy_fail')); }
    }
  });

  btnJump.addEventListener('click', () => {
  const item = currentList.find(x => x.id === selectedId);
  if (!item) { showToast(t('fav_empty')); return; }
  const parsed = parseFourCoords(item.coords);
  if (!parsed) { showToast(t('fav_no_input')); return; }

  // 将四元坐标写入 pending key，目标页加载时会消费并填充
  const coordsToStore = parsed.join(',');
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ wplace_pending_coords: coordsToStore });
    } else {
      localStorage.setItem('wplace_pending_coords', coordsToStore);
    }
  } catch (e) {
    try { localStorage.setItem('wplace_pending_coords', coordsToStore); } catch (_) {}
  }

  // 计算 lat/lng 并导航（照搬主界面 jump 的 URL 生成逻辑）
  try {
    const [tlx, tly, pxx, pxy] = parsed;
    const { lat, lng } = computeLatLngFromFour(tlx, tly, pxx, pxy);
    const latS = lat.toFixed(15).replace(/(?:\.0+|(\.\d+?)0+)$/,"$1");
    const lngS = lng.toFixed(15).replace(/(?:\.0+|(\.\d+?)0+)$/,"$1");
    const url = `https://wplace.live/?lat=${latS}&lng=${lngS}&zoom=15`;
    try { window.location.href = url; } catch (e) { try { top.location.href = url; } catch (_) { showToast("Navigation blocked"); } }
  } catch (e) {
    showToast(t('fav_no_input'));
  }
});


  btnRename.addEventListener('click', async () => {
    const item = currentList.find(x => x.id === selectedId);
    if (!item) { showToast(t('fav_empty')); return; }
    const newName = prompt(t('fav_rename'), item.name || '');
    if (newName === null) return;
    item.name = String(newName || '').trim();
    const list = await readFavorites();
    const idx = list.findIndex(x => x.id === item.id);
    if (idx >= 0) { list[idx].name = item.name; writeFavorites(list); refreshList(); }
  });

  btnDelete.addEventListener('click', async () => {
    const item = currentList.find(x => x.id === selectedId);
    if (!item) { showToast(t('fav_empty')); return; }
    if (!confirm(t('fav_delete') + '?')) return;
    let list = await readFavorites();
    list = list.filter(x => x.id !== item.id);
    writeFavorites(list);
    selectedId = null;
    refreshList();
  });

  mgr = m;
  return m;
}

  function showManager() {
    const m = createManager();
    m.style.display = 'flex';
    refreshList();
    window.__wplace_fav_manager = {
      refresh: refreshList,
      hide: hideManager,
      show: showManager
    };
  }
  function hideManager() {
    if (!mgr) return;
    mgr.style.display = 'none';
  }

  async function refreshList() {
    const m = createManager();
    const body = m.querySelector('#wplace_fav_body');
    if (!body) return;
    body.innerHTML = '';
    const arr = await readFavorites();
    currentList = Array.isArray(arr) ? arr.slice() : [];
    if (!currentList || currentList.length === 0) {
      const empty = document.createElement('div');
      empty.style.opacity = '0.6';
      empty.style.padding = '10px';
      empty.textContent = t('fav_empty');
      body.appendChild(empty);
      // clear selection
      selectedId = null;
      updateFooterState();
      return;
    }

    // render clickable list items (single column)
    for (const item of currentList) {
      const row = document.createElement('div');
      row.className = 'wplace_fav_row';
      Object.assign(row.style, {
        display:'flex', flexDirection:'column', gap:'4px', padding:'8px', borderRadius:'6px',
        cursor:'pointer', marginBottom:'6px', background:'rgba(255,255,255,0.02)'
      });

      const topLine = document.createElement('div');
      topLine.style.display = 'flex';
      topLine.style.alignItems = 'center';
      topLine.style.justifyContent = 'space-between';

      const nameEl = document.createElement('div');
      nameEl.style.flex = '1';
      nameEl.style.minWidth = '0';
      nameEl.style.wordBreak = 'break-all';
      nameEl.style.fontWeight = '600';
      nameEl.textContent = item.name && item.name.length>0 ? item.name : item.coords;

      const timeEl = document.createElement('div');
      timeEl.style.opacity = '0.6';
      timeEl.style.fontSize = '12px';
      try {
        const d = new Date(item.createdAt);
        timeEl.textContent = d.toLocaleString();
      } catch(e){ timeEl.textContent = ''; }

      const coordsEl = document.createElement('div');
      coordsEl.style.opacity = '0.85';
      coordsEl.style.fontSize = '12px';
      coordsEl.textContent = item.coords;

      topLine.appendChild(nameEl);
      topLine.appendChild(timeEl);

      row.appendChild(topLine);
      row.appendChild(coordsEl);

      // selection handling
      row.addEventListener('click', () => {
        selectedId = item.id;
        // highlight selection: clear others
        const rows = body.querySelectorAll('.wplace_fav_row');
        rows.forEach(r => { r.style.boxShadow = ''; r.style.background = 'rgba(255,255,255,0.02)'; });
        row.style.boxShadow = 'inset 0 0 0 2px rgba(255,255,255,0.06)';
        row.style.background = 'rgba(255,255,255,0.03)';
        // populate rename input with current name for quick edit
        const nm = m.querySelector('#wplace_fav_newname');
        if (nm) nm.value = item.name || '';
        updateFooterState();
      });

      // if this item is current selection, mark it
      if (selectedId === item.id) {
        row.style.boxShadow = 'inset 0 0 0 2px rgba(255,255,255,0.06)';
        row.style.background = 'rgba(255,255,255,0.03)';
      }

      body.appendChild(row);
    }

    // ensure footer state updated
    updateFooterState();
  }

  function updateFooterState() {
    const m = createManager();
    const btnCopy = m.querySelector('#wplace_fav_action_copy');
    const btnJump = m.querySelector('#wplace_fav_action_jump');
    const btnRename = m.querySelector('#wplace_fav_action_rename');
    const btnDelete = m.querySelector('#wplace_fav_action_delete');
    const nm = m.querySelector('#wplace_fav_newname');

    const enabled = !!currentList.find(x => x.id === selectedId);
    [btnCopy, btnJump, btnRename, btnDelete].forEach(b => {
      if (!b) return;
      b.disabled = !enabled;
      b.style.opacity = enabled ? '1' : '0.45';
      b.style.pointerEvents = enabled ? '' : 'none';
    });

    if (nm) {
      nm.disabled = !enabled;
      nm.style.opacity = enabled ? '1' : '0.5';
    }
  }

  // open manager when button clicked
  favManagerBtn.addEventListener('click', () => {
    showManager();
  });

  // expose show/hide on window for other code
  window.__wplace_show_fav_manager = function(){ showManager(); };
  window.__wplace_hide_fav_manager = function(){ hideManager(); };

})();

// --------- Ruler module ----------
(function rulerModule() {
  let panel = null;
  let pickingMode = null; // 'start' | 'end' | null
  let startCoords = null; // [tlx, tly, pxx, pxy]
  let endCoords = null;   // [tlx, tly, pxx, pxy]

  function createRulerPanel() {
    if (document.getElementById('wplace_ruler_panel')) return document.getElementById('wplace_ruler_panel');
    const m = document.createElement('div');
    m.id = 'wplace_ruler_panel';
    m.setAttribute('role','dialog');
    Object.assign(m.style, {
      position: 'fixed',
      zIndex: 2147483647,
      width: '380px',
      maxWidth: '94vw',
      height: '260px',
      background: 'rgba(10,10,10,0.97)',
      color: '#e8e8e8',
      borderRadius: '10px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
      padding: '10px',
      display: 'none',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'sans-serif'
    });

    m.innerHTML = `
      <div id="wplace_ruler_header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div class="drag-handle" style="font-weight:600;">${t('ruler_title')}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button id="wplace_ruler_close" class="wplace_btn small">✕</button>
        </div>
      </div>
      <div id="wplace_ruler_body" style="margin-top:8px; overflow:auto; flex:1; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <div style="flex:1; display:flex; flex-direction:column;">
            <label style="font-size:12px; opacity:0.8;">${t('ruler_start_label')}</label>
            <input id="wplace_ruler_start" placeholder="TlX, TlY, PxX, PxY" style="padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:#e8e8e8; width:100%;" />
          </div>
          <button id="wplace_ruler_pick_start" class="wplace_btn small">${t('ruler_pick_start')}</button>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <div style="flex:1; display:flex; flex-direction:column;">
            <label style="font-size:12px; opacity:0.8;">${t('ruler_end_label')}</label>
            <input id="wplace_ruler_end" placeholder="TlX, TlY, PxX, PxY" style="padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:#e8e8e8; width:100%;" />
          </div>
          <button id="wplace_ruler_pick_end" class="wplace_btn small">${t('ruler_pick_end')}</button>
        </div>

        <div id="wplace_ruler_result" style="margin-top:6px; font-size:13px; opacity:0.95;">
          <div id="wplace_ruler_offsets">${t('ruler_offset_label')} —</div>
          <div id="wplace_ruler_area">${t('ruler_area_label')} —</div>
        </div>

        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:6px;">
          <button id="wplace_ruler_clear" class="wplace_btn small">${t('ruler_clear')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    // draggable by header
    (function makeDraggable(el){
      const handle = el.querySelector('.drag-handle') || el;
      let dragging = false, pointerId=null, sx=0, sy=0, sl=0, st=0;
      handle.style.cursor = 'grab';
      handle.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        ev.preventDefault();
        dragging = true;
        pointerId = ev.pointerId;
        handle.setPointerCapture && handle.setPointerCapture(pointerId);
        sx = ev.clientX; sy = ev.clientY;
        const rect = el.getBoundingClientRect();
        sl = rect.left; st = rect.top;
        handle.style.cursor = 'grabbing';
        window.addEventListener('pointermove', onMove, { passive:false });
        window.addEventListener('pointerup', onUp, { passive:false });
        window.addEventListener('pointercancel', onUp, { passive:false });
      });
      function onMove(ev){
        if (!dragging || ev.pointerId !== pointerId) return;
        ev.preventDefault();
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        const left = Math.round(sl + dx), top = Math.round(st + dy);
        el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.right='auto'; el.style.bottom='auto';
      }
      function onUp(ev){
        if (!dragging || ev.pointerId !== pointerId) return;
        dragging = false;
        handle.releasePointerCapture && handle.releasePointerCapture(pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        handle.style.cursor = 'grab';
        try {
          chrome.storage.local.set({ wplace_ruler_pos: { left: parseInt(el.style.left,10)||0, top: parseInt(el.style.top,10)||0 } });
        } catch(e){
          try { localStorage.setItem('wplace_ruler_pos', JSON.stringify({ left: parseInt(el.style.left,10)||0, top: parseInt(el.style.top,10)||0 })); } catch(_) {}
        }
      }
    })(m);

    // close
    m.querySelector('#wplace_ruler_close').addEventListener('click', () => { hideRuler(); });

    // clear
    m.querySelector('#wplace_ruler_clear').addEventListener('click', () => {
      startCoords = null; endCoords = null; pickingMode = null;
      const sIn = m.querySelector('#wplace_ruler_start');
      const eIn = m.querySelector('#wplace_ruler_end');
      if (sIn) sIn.value = '';
      if (eIn) eIn.value = '';
      updateRulerResult();
    });

    // pick buttons
    m.querySelector('#wplace_ruler_pick_start').addEventListener('click', () => {
      beginPick('start');
    });
    m.querySelector('#wplace_ruler_pick_end').addEventListener('click', () => {
      beginPick('end');
    });

    // manual input change
    const startInput = m.querySelector('#wplace_ruler_start');
    const endInput = m.querySelector('#wplace_ruler_end');
    if (startInput) startInput.addEventListener('change', () => {
      const p = parseFourCoords(startInput.value);
      startCoords = p; updateRulerResult();
    });
    if (endInput) endInput.addEventListener('change', () => {
      const p = parseFourCoords(endInput.value);
      endCoords = p; updateRulerResult();
    });

    // restore position
    try {
      chrome.storage.local.get(['wplace_ruler_pos'], res => {
        const p = res && res.wplace_ruler_pos;
        if (p && typeof p.left === 'number' && typeof p.top === 'number') {
          m.style.left = p.left + 'px'; m.style.top = p.top + 'px';
        } else {
          m.style.right = '30px'; m.style.bottom = '120px';
        }
      });
    } catch(e){
      try {
        const raw = localStorage.getItem('wplace_ruler_pos');
        if (raw) {
          const p = JSON.parse(raw);
          if (p && typeof p.left === 'number' && typeof p.top === 'number') {
            m.style.left = p.left + 'px'; m.style.top = p.top + 'px';
          } else { m.style.right = '30px'; m.style.bottom = '120px'; }
        } else { m.style.right = '30px'; m.style.bottom = '120px'; }
      } catch(e){ m.style.right = '30px'; m.style.bottom = '120px'; }
    }

    panel = m;
    updateRulerResult();
    return m;
  }

  function showRuler() {
    const m = createRulerPanel();
    m.style.display = 'flex';
  }

  function hideRuler() {
    if (!panel) return;
    panel.style.display = 'none';
    pickingMode = null;
  }

  function updateRulerI18n() {
  try {
    const m = document.getElementById('wplace_ruler_panel');
    if (!m) return;

    // header/title
    const header = m.querySelector('.drag-handle');
    if (header) header.textContent = t('ruler_title');

    // pick buttons / clear / result labels
    const pStart = m.querySelector('#wplace_ruler_pick_start');
    if (pStart) pStart.textContent = t('ruler_pick_start');

    const pEnd = m.querySelector('#wplace_ruler_pick_end');
    if (pEnd) pEnd.textContent = t('ruler_pick_end');

    const clearBtn = m.querySelector('#wplace_ruler_clear');
    if (clearBtn) clearBtn.textContent = t('ruler_clear');

    // labels: pick all label elements and set by index if present
    const labels = Array.from(m.querySelectorAll('label'));
    if (labels.length >= 1) labels[0].textContent = t('ruler_start_label');
    if (labels.length >= 2) labels[1].textContent = t('ruler_end_label');

    // update the result area if visible
    const offEl = m.querySelector('#wplace_ruler_offsets');
    if (offEl) {
      // if offsets currently empty/placeholder, keep the placeholder format
      const cur = offEl.textContent || '';
      if (!cur.includes(',')) offEl.textContent = `${t('ruler_offset_label')} —`;
      else {
        // preserve current numeric part if present (recompute will run anyway)
        // safe fallback: rewrite label prefix only
        const parts = cur.split(' ');
        offEl.textContent = `${t('ruler_offset_label')} ${parts.slice(1).join(' ')}`.trim();
      }
    }

    const areaEl = m.querySelector('#wplace_ruler_area');
    if (areaEl) {
      const cur = areaEl.textContent || '';
      if (!cur.match(/\d/)) areaEl.textContent = `${t('ruler_area_label')} —`;
      else {
        const parts = cur.split(' ');
        areaEl.textContent = `${t('ruler_area_label')} ${parts.slice(1).join(' ')}`.trim();
      }
    }

    // ensure computed values refresh with current language text
    updateRulerResult();
  } catch (e) {}
}


  function safePickLatestCoordsOnce(timeoutMs = 4000) {
    return new Promise((resolve) => {
      let resolved = false;
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, (resp) => {
            try {
              const coords = resp && resp.coords ? String(resp.coords) : null;
              if (coords) { resolved = true; resolve(coords); return; }
            } catch(e){}
            try {
              chrome.runtime.sendMessage({ type: "WPLACE_TRIGGER_FETCH" }, () => {
                const started = Date.now();
                const interval = setInterval(() => {
                  try {
                    chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, (r2) => {
                      const latest = r2 && r2.coords ? String(r2.coords) : null;
                      if (latest) {
                        clearInterval(interval);
                        resolved = true; resolve(latest); return;
                      }
                      if (Date.now() - started >= timeoutMs) {
                        clearInterval(interval);
                        resolved = true; resolve(null); return;
                      }
                    });
                  } catch (e) { clearInterval(interval); resolved = true; resolve(null); }
                }, 250);
              });
            } catch (e) { if (!resolved) { resolved = true; resolve(null); } }
          });
          setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, timeoutMs + 200);
          return;
        }
      } catch (e) {}
      try {
        const pending = localStorage.getItem('wplace_pending_coords');
        if (pending) { resolve(pending); return; }
      } catch(e){}
      try {
        if (inputEl && inputEl.value) {
          const maybe = String(inputEl.value || '').trim();
          if (maybe.split(',').map(s=>s.trim()).filter(Boolean).length === 4) { resolve(maybe); return; }
        }
      } catch(e){}
      resolve(null);
    });
  }

  async function beginPick(kind) {
    if (!panel) createRulerPanel();
    pickingMode = kind;
    showToast(t('ruler_wait_pick'), 2500);
    try {
      const coords = await safePickLatestCoordsOnce(4000);
      if (!coords) {
        showToast(t('ruler_no_coords'));
        pickingMode = null;
        return;
      }
      const cleaned = String(coords).split(',').map(s => s.trim()).join(', ');
      if (kind === 'start') {
        startCoords = parseFourCoords(cleaned);
        const inp = panel.querySelector('#wplace_ruler_start');
        if (inp) { inp.value = startCoords ? startCoords.join(', ') : cleaned; }
      } else {
        endCoords = parseFourCoords(cleaned);
        const inp = panel.querySelector('#wplace_ruler_end');
        if (inp) { inp.value = endCoords ? endCoords.join(', ') : cleaned; }
      }
      showToast(`${t('ruler_pick_toast')} ${cleaned}`, 1500);
      updateRulerResult();
    } catch (e) {
      showToast(t('ruler_no_coords'));
    } finally {
      pickingMode = null;
    }
  }

  function computeXYFromFour(arr) {
    if (!arr || arr.length !== 4) return null;
    const [TlX, TlY, PxX, PxY] = arr.map(Number);
    if ([TlX, TlY, PxX, PxY].some(n => Number.isNaN(n))) return null;
    const X = TlX * 1000 + PxX;
    const Y = TlY * 1000 + PxY;
    return { X, Y };
  }

  function updateRulerResult() {
    if (!panel) return;
    const offEl = panel.querySelector('#wplace_ruler_offsets');
    const areaEl = panel.querySelector('#wplace_ruler_area');
    if (!offEl || !areaEl) return;

    const a = computeXYFromFour(startCoords);
    const b = computeXYFromFour(endCoords);

    if (!a || !b) {
      offEl.textContent = `${t('ruler_offset_label')} —`;
      areaEl.textContent = `${t('ruler_area_label')} —`;
      return;
    }

    const deltaX = b.X - a.X + 1;
    const deltaY = b.Y - a.Y + 1;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const area = absX * absY;

    offEl.textContent = `${t('ruler_offset_label')} ${deltaX}, ${deltaY}`;
    areaEl.textContent = `${t('ruler_area_label')} ${area}`;
  }

  window.__wplace_show_ruler = showRuler;
  window.__wplace_hide_ruler = hideRuler;

  try {
    const rbtn = document.getElementById('wplace_ruler_btn') || window.__wplace_ruler_btn;
    if (rbtn) {
      rbtn.addEventListener('click', () => {
        const m = createRulerPanel();
        if (m.style.display === 'flex') hideRuler(); else showRuler();
      });
    }
  } catch (e) { console.warn('ruler attach failed', e); }

  window.__wplace_update_ruler_i18n = updateRulerI18n;
})();


(function bindMapClickFillInput() {
  const MAP_SELECTORS = [
    '.leaflet-container',
    '#map',
    '.mapboxgl-canvas',
    '.gm-style',
    '[data-map-root]',
    '.ol-viewport'
  ];

  function isMapElement(el) {
    if (!el) return false;
    try {
      for (const sel of MAP_SELECTORS) {
        if (el.matches && el.matches(sel)) return true;
        if (el.closest && el.closest(sel)) return true;
      }
    } catch (e) {}
    return false;
  }

  // 工具：调用 background 获取最新一次已知 coords（原有接口）
  function requestLatestOnce(cb) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, (resp) => {
          try { cb(null, resp && resp.coords ? String(resp.coords) : null); } catch(e){ cb(e); }
        });
      } else {
        (async () => { try { const c = await getLatestCoordsString(); cb(null, c); } catch(e){ cb(e); } })();
      }
    } catch (e) { cb(e); }
  }

  // 触发后台去拉最新坐标（后台应开启网络请求以拿到“当前点击”的坐标）
  function triggerBackgroundFetch(cb) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        // 发送一个触发消息，后台收到后应发起网络/服务器请求并更新其内部最新 coords
        chrome.runtime.sendMessage({ type: "WPLACE_TRIGGER_FETCH" }, (resp) => {
          // 不依赖 resp 内容，立即回到 caller 以开始轮询
          try { cb && cb(null, resp); } catch(e){ cb && cb(e); }
        });
      } else {
        // 如果没有 runtime 可用，直接回调（caller 会 fallback 到读取本地）
        cb && cb(null);
      }
    } catch (e) { cb && cb(e); }
  }

  // 触发 fetch 后轮询 get_latest，直到值变化或超时
  function triggerThenPollForLatest({ timeoutMs = 5000, intervalMs = 200 }, onDone) {
    // 先拿一个基线值，然后触发后台，再开始轮询直到值变化或超时
    requestLatestOnce((err, baseline) => {
      if (err) baseline = null;
      triggerBackgroundFetch(() => {
        const startedAt = Date.now();
        let lastSeen = baseline;
        const timer = setInterval(() => {
          requestLatestOnce((err2, latest) => {
            // 如果读取出错或无值，继续轮询直到超时
            if (latest && String(latest) !== String(lastSeen)) {
              clearInterval(timer);
              onDone(null, latest);
              return;
            }
            if (Date.now() - startedAt >= timeoutMs) {
              clearInterval(timer);
              // final attempt to return whatever exists (may be null)
              onDone(null, latest || lastSeen || null);
            }
            // 否则继续等待
            lastSeen = latest;
          });
        }, intervalMs);
      });
    });
  }

  // 点击后：触发后台拉取当次最新坐标并填入输入框
  function requestFetchAndFill() {
  try {
    triggerThenPollForLatest({ timeoutMs: 5000, intervalMs: 200 }, (err, coords) => {
      try {
        if (!coords) {
          showToast(t('no_share'));
          return;
        }
        const cleaned = String(coords).split(',').map(s => s.trim()).join(', ');
        // Use safeDispatchInputEvents if available to handle framework controlled inputs
        if (typeof safeDispatchInputEvents === 'function' && inputEl) {
          safeDispatchInputEvents(inputEl, cleaned);
        } else if (inputEl) {
          inputEl.value = cleaned;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          try { localStorage.setItem('wplace_pending_coords', cleaned); } catch (e) {}
        }
        showToast(cleaned, 1200);
      } catch (e) {}
    });
  } catch (e) {}
}


  // 全局 click 委托：点击落在地图容器或其子元素时触发
document.addEventListener('click', (ev) => {
  try {
    const path = ev.composedPath ? ev.composedPath() : (ev.path || []);
    if (!path || path.length === 0) {
      // fallback to target if composedPath not available
      if (!ev.target) return;
      if (ev.target.closest && ev.target.closest('#wplace_locator')) return;
      if (!isMapElement(ev.target)) return;
      setTimeout(() => { try { requestFetchAndFill(); } catch(e){} }, 700);
      return;
    }

    // ignore clicks inside our UI
    for (const node of path) {
      try { if (node && node.id === 'wplace_locator') return; } catch(e){}
    }

    // debouncing
    if (!document.__wplace_click_debounce_ts) document.__wplace_click_debounce_ts = 0;
    const now = Date.now();
    if (now - document.__wplace_click_debounce_ts < 600) return;
    document.__wplace_click_debounce_ts = now;

    // If any node in path looks like map container, trigger fetch+fill after small delay
    function pathHasMapElementFallback(p) {
      try {
        for (const node of p) {
          if (!node || typeof node !== 'object') continue;
          if (node.nodeType && node.nodeType !== 1) continue;
          if (node.matches) {
            for (const sel of MAP_SELECTORS) {
              try { if (node.matches(sel)) return true; } catch(e){}
            }
          }
          const tag = (node.tagName || '').toUpperCase();
          if (tag === 'CANVAS') {
            let up = node.parentElement; let steps = 0;
            while (up && steps < 8) {
              const cls = (up.className || '').toString().toLowerCase();
              if (cls && (cls.includes('map') || cls.includes('leaflet') || cls.includes('mapbox') || cls.includes('gm') || cls.includes('ol'))) return true;
              for (const sel of MAP_SELECTORS) {
                try { if (up.matches && up.matches(sel)) return true; } catch(e){}
              }
              up = up.parentElement; steps++;
            }
          }
        }
      } catch(e){}
      return false;
    }

    if (pathHasMapElementFallback(path)) {
      setTimeout(() => { try { requestFetchAndFill(); } catch(e){} }, 700);
    }
  } catch (e) {
    // ignore
  }
}, true);


})();

function installShareAndFavHandlers() {
  // 依赖：shareBtn, favBtn, inputEl, safeDispatchInputEvents,
  // parseFourCoords, readFavorites, writeFavorites, makeFavId, showToast, t
  if (typeof shareBtn === 'undefined' || typeof favBtn === 'undefined' || typeof inputEl === 'undefined') {
    console.warn('installShareAndFavHandlers: missing required elements (shareBtn, favBtn, inputEl)');
    return false;
  }

  // 如果先前存在早期 handler，先移除它（以避免并存导致 race）
  try {
    if (favBtn.__wplace_early_fav_handler) {
      try { favBtn.removeEventListener('click', favBtn.__wplace_early_fav_handler); } catch(e) {}
      // 保留引用以便调试，但不再绑定
    }
    if (shareBtn.__wplace_early_share_handler) {
      try { shareBtn.removeEventListener('click', shareBtn.__wplace_early_share_handler); } catch(e) {}
    }
  } catch (e) {}

  // helper: 从 background/localStorage/input 中选取最新 coords 并填入 input；forceSave=true 时同时加入收藏
  async function fetchAndFillLatestCoords(forceSave = false) {
    let coords = null;

    // 优先从 background 获取最新（WPLACE_GET_LATEST）
    try {
      coords = await new Promise(resolve => {
        try {
          chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, (resp) => {
            try { resolve(resp && resp.coords ? String(resp.coords) : null); } catch (e) { resolve(null); }
          });
        } catch (e) { resolve(null); }
      });
    } catch (e) {
      coords = null;
    }

    // 回退：localStorage 中 pending key
    try {
      if (!coords) {
        const pending = localStorage.getItem('wplace_pending_coords');
        if (pending) coords = pending;
      }
    } catch (e) {}

    // 回退：当前 input（若看起来是 4 个逗号值）
    try {
      if (!coords && inputEl && inputEl.value) {
        const maybe = String(inputEl.value || '').trim();
        if (maybe.split(',').map(s => s.trim()).filter(Boolean).length === 4) coords = maybe;
      }
    } catch (e) {}

    // 若仍无 coords，尝试触发后台抓取然后轮询（best-effort）
    if (!coords) {
      try {
        await new Promise((resolve) => {
          // 较短超时的轮询：触发后台请求后最多等 4s，每 250ms 轮询
          const timeoutMs = 4000;
          const intervalMs = 250;
          let baseline = null;
          // baseline
          try {
            chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, (resp) => {
              try { baseline = resp && resp.coords ? String(resp.coords) : null; } catch(e){}
              // 发触发请求
              try {
                chrome.runtime.sendMessage({ type: "WPLACE_TRIGGER_FETCH" }, () => {
                  const started = Date.now();
                  const poll = setInterval(() => {
                    try {
                      chrome.runtime.sendMessage({ type: "WPLACE_GET_LATEST" }, (resp2) => {
                        const latest = resp2 && resp2.coords ? String(resp2.coords) : null;
                        if (latest && String(latest) !== String(baseline)) {
                          clearInterval(poll);
                          coords = latest;
                          resolve();
                          return;
                        }
                        if (Date.now() - started >= timeoutMs) {
                          clearInterval(poll);
                          coords = latest || baseline || null;
                          resolve();
                        }
                      });
                    } catch (e) {
                      clearInterval(poll);
                      resolve();
                    }
                  }, intervalMs);
                });
              } catch (e) {
                resolve();
              }
            });
          } catch (e) { resolve(); }
        });
      } catch (e) {}
    }

    if (!coords) {
      showToast(t('no_share'));
      return null;
    }

    const cleaned = String(coords).split(',').map(s => s.trim()).join(', ');

    // 写回 panel input（使用 safeDispatchInputEvents 以兼容框架受控输入）
    try {
      if (inputEl) {
        safeDispatchInputEvents(inputEl, cleaned);
      } else {
        try { localStorage.setItem('wplace_pending_coords', cleaned); } catch (e) {}
      }
      showToast(cleaned, 1200);
    } catch (e) {}

    // 如果要求同时保存到收藏
    if (forceSave) {
      try {
        const parsed = parseFourCoords(cleaned);
        if (parsed) {
          const coordsStr = parsed.join(', ');
          const item = { id: makeFavId(), name: '', coords: coordsStr, createdAt: Date.now() };
          try {
            const arr = await readFavorites();
            arr.unshift(item);
            writeFavorites(arr);
            try { if (window.__wplace_fav_manager && typeof window.__wplace_fav_manager.refresh === 'function') window.__wplace_fav_manager.refresh(); } catch(e){}
            showToast(t('fav_added'));
          } catch (e) {
            showToast(t('fav_no_input'));
          }
        } else {
          showToast(t('fav_no_input'));
        }
      } catch (e) {
        showToast(t('fav_no_input'));
      }
    }

    return cleaned;
  }

  // Replace/attach share button行为：先确保 panel 有最新 coords 再尝试复制
  try {
    shareBtn.__wplace_old_share_handler = async function enhancedShareHandler() {
      try {
        const coords = await fetchAndFillLatestCoords(false);
        if (!coords) return;
        try {
          await navigator.clipboard.writeText(coords);
          showToast(`${t('copied')} ${coords}`);
        } catch (e) {
          try {
            const ta = document.createElement('textarea');
            ta.value = coords;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            if (ok) showToast(`${t('copied')} ${coords}`);
            else showToast(t('copy_fail'));
          } catch (e2) { showToast(t('copy_fail')); }
        }
      } catch (e) {
        showToast(t('no_share'));
      }
    };
    shareBtn.addEventListener('click', shareBtn.__wplace_old_share_handler);
  } catch (e) {
    console.warn('installShareAndFavHandlers: shareBtn attach failed', e);
  }

  // Replace/attach fav (star) button行为：先拉最新 coords 并填入，再保存为收藏
  try {
    favBtn.__wplace_old_fav_handler = async function enhancedFavHandler() {
      try {
        const coords = await fetchAndFillLatestCoords(true); // true -> fill then save
        // fetchAndFillLatestCoords 已在内部 showToast, 保存并刷新列表
      } catch (e) {
        showToast(t('fav_no_input'));
      }
    };
    favBtn.addEventListener('click', favBtn.__wplace_old_fav_handler);
  } catch (e) {
    console.warn('installShareAndFavHandlers: favBtn attach failed', e);
  }

  return true;
}

// 立即安装（安全尝试）
try { installShareAndFavHandlers(); } catch (e) { console.warn('installShareAndFavHandlers failed', e); }

(function installClickCenterPageZoomAuto() {
  if (window.__slowWheelUntilButtonGone || window.__wplace_click_center_zoom_installed) return;
  window.__wplace_click_center_zoom_installed = true;

  const DEFAULT = {
    deltaPerEvent: -300,
    intervalMs: 100,
    maxEvents: 5000,
    buttonSelector: 'button.btn.sm\\:btn-lg.duration.text-nowrap.text-xs.transition-opacity.sm\\:text-base',
    buttonTextMustContain: 'Zoom in to see the pixels',
    useCapture: true,
    clickMoveThreshold: 6,
    clickMaxDurationMs: 500,
    removeNotificationSelector:
      'section[aria-label="Notifications alt+T"][aria-live="polite"][aria-relevant="additions text"][aria-atomic="false"].svelte-tppj9g[tabindex="-1"],' +
      'section[aria-label="Notifications alt+T"][aria-live="polite"][aria-relevant="additions text"][aria-atomic="false"][tabindex="-1"],' +
      'section[aria-label="Notifications alt+T"][tabindex="-1"].svelte-tppj9g,' +
      'section[aria-label="Notifications alt+T"],' +
      'section.svelte-tppj9g[aria-label="Notifications alt+T"]',
    // Q/E keys
    zoomKey: 'q',
    shrinkKey: 'e',
    // smooth single-shot
    smoothDurationMs: 800,
    zoomCount: 8,
    shrinkCount: 8,
    zoomDeltaPerEventMultiplier: 0.45,
    shrinkDeltaPerEventMultiplier: 0.45,
    // continuous control (made more natural by default)
    controlZoomDeltaPerSecond: 900,      // initial target per-second
    controlZoomMaxDeltaPerSecond: 4800,  // safety cap
    rampUpMs: 300,                       // smooth acceleration
    rampDownMs: 150,                     // smooth deceleration
    // right-hold behavior tuning
    rightHoldMs: 0,
    rightHoldMoveThreshold: 10,
    // continuous fixed-rate fallback
    controlZoomDeltaPerSecond_fallback: 2400
  };

  const state = {
    cfg: Object.assign({}, DEFAULT),
    running: false,
    sent: 0,
    timerId: null,
    observer: null,
    buttonObserver: null,
    notifObserver: null,
    lastMousePos: null,
    lastPoint: { x: 0, y: 0 },

    mouseDownPos: null,
    mouseDownTime: 0,
    moved: false,
    listenersAttached: false,

    pointerListenerAttached: false,
    smoothController: null,

    continuousZoom: { rafId: null, running: false, direction: 0, lastTime: 0 }
  };

  /* helpers */
  function qButton() {
    const sel = state.cfg.buttonSelector || '';
    try {
      const list = Array.from(document.querySelectorAll(sel));
      if (!list.length) return null;
      if (!state.cfg.buttonTextMustContain) return list[0];
      for (const el of list) {
        if (el && el.textContent && el.textContent.includes(state.cfg.buttonTextMustContain)) return el;
      }
      return list[0];
    } catch (e) { return null; }
  }

  function isVisible(el) {
    if (!el) return false;
    if (!document.contains(el)) return false;
    try {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') === 0) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return true;
    } catch (e) { return false; }
  }

  function makeWheel(x, y, deltaX, deltaY) {
    try {
      return new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        deltaX: deltaX || 0,
        deltaY: deltaY || 0
      });
    } catch (e) {
      const ev = document.createEvent('Event');
      ev.initEvent('wheel', true, true);
      ev.clientX = x;
      ev.clientY = y;
      ev.deltaX = deltaX || 0;
      ev.deltaY = deltaY || 0;
      return ev;
    }
  }

  function getFocusPosOrCenter() {
    const pos = state.lastMousePos;
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') return { x: pos.x, y: pos.y };
    const cx = Math.round((document.documentElement.clientWidth || window.innerWidth) / 2);
    const cy = Math.round((document.documentElement.clientHeight || window.innerHeight) / 2);
    return { x: cx, y: cy };
  }

  /* click-slow-wheel logic */
  async function loopOnce(x, y) {
    if (!state.running) return;
    if (!isVisible(qButton())) { stop('button-gone-before'); return; }
    const target = document.elementFromPoint(x, y) || document.body;
    const ev = makeWheel(x, y, 0, state.cfg.deltaPerEvent);
    try { target.dispatchEvent(ev); } catch (e) {}
    state.sent += 1;
    if (!isVisible(qButton())) { stop('button-gone-after'); return; }
    if (state.cfg.maxEvents !== Infinity && state.sent >= state.cfg.maxEvents) { stop('max-events'); return; }
  }

  function startAt(x, y) {
    if (state.running) return;
    state.running = true;
    state.sent = 0;
    state.lastPoint = { x, y };
    try {
      const vw = Math.max(document.documentElement.clientWidth || window.innerWidth, 1);
      const vh = Math.max(document.documentElement.clientHeight || window.innerHeight, 1);
      const px = Math.max(0, Math.min(x, vw));
      const py = Math.max(0, Math.min(y, vh));
      const ox = Math.round((px / vw) * 10000) / 100;
      const oy = Math.round((py / vh) * 10000) / 100;
      document.documentElement.style.transformOrigin = ox + '% ' + oy + '%';
    } catch (e) {}
    state.observer = new MutationObserver(() => {
      if (!isVisible(qButton()) && state.running) stop('button-gone-mutation');
    });
    try { state.observer.observe(document.documentElement || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) {}
    state.timerId = setInterval(() => { if (!state.running) return; loopOnce(x, y); }, state.cfg.intervalMs);
  }

  function stop(reason = 'stopped') {
    state.running = false;
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    if (state.observer) { try { state.observer.disconnect(); } catch (e) {} state.observer = null; }
    stopContinuousZoom();
    if (state.smoothController) { state.smoothController.cancel(); state.smoothController = null; }
  }

  /* left-click detection (unchanged) */
  function onMouseDown(e) {
    if (e.button !== 0) return;
    state.mouseDownPos = { x: e.clientX, y: e.clientY };
    state.mouseDownTime = Date.now();
    state.moved = false;
  }
  function onMouseMove(e) {
    if (!state.mouseDownPos) return;
    const dx = e.clientX - state.mouseDownPos.x;
    const dy = e.clientY - state.mouseDownPos.y;
    if (Math.hypot(dx, dy) > (state.cfg.clickMoveThreshold || 6)) state.moved = true;
  }
  function onMouseUp(e) {
    if (e.button !== 0) { state.mouseDownPos = null; return; }
    const duration = Date.now() - (state.mouseDownTime || 0);
    const moved = !!state.moved;
    state.mouseDownPos = null;
    state.mouseDownTime = 0;
    state.moved = false;
    if (moved) return;
    if (duration > (state.cfg.clickMaxDurationMs || 500)) return;

    try {
      const markerSelector = '.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center';
      const popupCloseBtnSelector = '.rounded-t-box button.btn.btn-circle.btn-sm';
      if (e.target && (e.target.closest && (
            e.target.closest(markerSelector) ||
            e.target.closest(popupCloseBtnSelector)
          ))) {
        return;
      }
    } catch (innerErr) {}

    try { removeNotificationSectionsFrom(document); } catch (err) {}
    startAt(e.clientX, e.clientY);
  }
  function attachClickListener() {
    if (state.listenersAttached) return;
    try {
      window.__slowWheelUntilButtonGoneOnMouseDown = onMouseDown;
      window.__slowWheelUntilButtonGoneOnMouseMove = onMouseMove;
      window.__slowWheelUntilButtonGoneOnMouseUp = onMouseUp;
      window.addEventListener('mousedown', window.__slowWheelUntilButtonGoneOnMouseDown, !!state.cfg.useCapture);
      window.addEventListener('mousemove', window.__slowWheelUntilButtonGoneOnMouseMove, !!state.cfg.useCapture);
      window.addEventListener('mouseup', window.__slowWheelUntilButtonGoneOnMouseUp, !!state.cfg.useCapture);
      state.listenersAttached = true;
    } catch (e) {}
  }
  function detachClickListener() {
    try {
      window.removeEventListener('mousedown', window.__slowWheelUntilButtonGoneOnMouseDown || onMouseDown, !!state.cfg.useCapture);
      window.removeEventListener('mousemove', window.__slowWheelUntilButtonGoneOnMouseMove || onMouseMove, !!state.cfg.useCapture);
      window.removeEventListener('mouseup', window.__slowWheelUntilButtonGoneOnMouseUp || onMouseUp, !!state.cfg.useCapture);
    } catch (e) {}
    state.listenersAttached = false;
  }

  /* pointer tracking */
  function onPointerMove(e) {
    try {
      if (e.pointerType === 'mouse' || typeof e.pointerType === 'undefined') {
        state.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    } catch (e) {}
  }
  function attachPointerTracker() {
    if (state.pointerListenerAttached) return;
    try {
      window.__slowWheelUntilButtonGonePointerMove = onPointerMove;
      window.addEventListener('pointermove', window.__slowWheelUntilButtonGonePointerMove, true);
      state.pointerListenerAttached = true;
    } catch (e) {}
  }
  function detachPointerTracker() {
    try {
      window.removeEventListener('pointermove', window.__slowWheelUntilButtonGonePointerMove || onPointerMove, true);
    } catch (e) {}
    state.pointerListenerAttached = false;
  }

  /* remove notification sections */
  function removeNotificationSectionsFrom(root) {
    try {
      const sel = state.cfg.removeNotificationSelector;
      if (!sel) return 0;
      const rootNode = root || document;
      let list = [];
      try {
        list = Array.from(rootNode.querySelectorAll(sel));
      } catch (e) {
        const nodes = Array.from(rootNode.getElementsByTagName('section'));
        for (const n of nodes) {
          try {
            if (n.getAttribute('aria-label') === 'Notifications alt+T' &&
                n.getAttribute('aria-live') === 'polite' &&
                n.getAttribute('aria-relevant') === 'additions text' &&
                n.getAttribute('aria-atomic') === 'false' &&
                n.classList.contains('svelte-tppj9g') &&
                n.getAttribute('tabindex') === '-1') {
              list.push(n);
            }
          } catch (e2) {}
        }
      }
      let removed = 0;
      for (const el of list) {
        try { if (el && el.parentNode) { el.parentNode.removeChild(el); removed += 1; } } catch (e) {}
      }
      return removed;
    } catch (e) { return 0; }
  }
  function startNotifObserver() {
    if (state.notifObserver) return;
    removeNotificationSectionsFrom(document);
    state.notifObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            try { if (n.nodeType === 1) removeNotificationSectionsFrom(n); } catch (e) {}
          }
        }
        if (m.type === 'attributes' && m.target) {
          try { removeNotificationSectionsFrom(m.target); } catch (e) {}
        }
      }
    });
    try {
      state.notifObserver.observe(document.documentElement || document.body, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'aria-label', 'aria-live', 'aria-relevant', 'aria-atomic', 'tabindex']
      });
    } catch (e) {}
  }

  /* SmoothController */
  function SmoothController() {
    let rafId = null; let startTime = 0; let duration = 0; let cx = 0, cy = 0; let onFrame = null; let cancelled = false;
    this.start = function(opts) {
      if (rafId) this.cancel();
      startTime = performance.now();
      duration = Math.max(1, opts.duration || state.cfg.smoothDurationMs);
      cx = opts.cx; cy = opts.cy; onFrame = opts.onFrame; cancelled = false;
      const step = (t) => {
        if (cancelled) return;
        const elapsed = t - startTime;
        const p = Math.min(1, elapsed / duration);
        try { onFrame(p, cx, cy); } catch (e) {}
        if (p < 1) rafId = requestAnimationFrame(step); else rafId = null;
      };
      rafId = requestAnimationFrame(step);
    };
    this.cancel = function() { cancelled = true; if (rafId) { try { cancelAnimationFrame(rafId); } catch (e) {} rafId = null; } };
    this.isRunning = function() { return !!rafId && !cancelled; };
  }

  function isTypingElement(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function simulateSmooth(deltaPerTotal, cx, cy, durationMs) {
    if (state.smoothController) state.smoothController.cancel();
    state.smoothController = new SmoothController();
    let prevApplied = 0;
    state.smoothController.start({
      duration: durationMs || state.cfg.smoothDurationMs,
      cx, cy,
      onFrame: (p, x, y) => {
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const targetApplied = deltaPerTotal * eased;
        const toApply = targetApplied - prevApplied;
        prevApplied = targetApplied;
        try {
          const tx = Math.round(x), ty = Math.round(y);
          const targetEl = document.elementFromPoint(tx, ty) || document.body;
          targetEl.dispatchEvent(makeWheel(tx, ty, 0, toApply));
          state.sent += 1;
        } catch (e) {}
      }
    });
  }

  function simulateZoomAtSmoothUsingMouse(totalSteps) {
    const base = state.cfg.deltaPerEvent || -300;
    const sign = Math.sign(base || -1);
    const perStep = Math.abs(base) * (state.cfg.zoomDeltaPerEventMultiplier || 1);
    const totalDelta = sign * perStep * (Number(totalSteps) || Number(state.cfg.zoomCount || 8));
    const pos = getFocusPosOrCenter();
    simulateSmooth(totalDelta, pos.x, pos.y, state.cfg.smoothDurationMs);
  }
  function simulateShrinkAtSmoothUsingMouse(totalSteps) {
    const base = state.cfg.deltaPerEvent || -300;
    const sign = -Math.sign(base || -1);
    const perStep = Math.abs(base) * (state.cfg.shrinkDeltaPerEventMultiplier || 1);
    const totalDelta = sign * perStep * (Number(totalSteps) || Number(state.cfg.shrinkCount || 8));
    const pos = getFocusPosOrCenter();
    simulateSmooth(totalDelta, pos.x, pos.y, state.cfg.smoothDurationMs);
  }

  /* Continuous zoom with ramping */
  let _ramp = { rafId: null, startTime: 0, targetDir: 0 };

  function startContinuousZoom(direction) {
    // direction: +1 zoom-in, -1 zoom-out
    stopContinuousZoom();

    _ramp.startTime = performance.now();
    _ramp.targetDir = Math.sign(direction) || 1;

    const cfgPerSec = Math.abs(Number(state.cfg.controlZoomDeltaPerSecond || state.cfg.controlZoomDeltaPerSecond_fallback));
    const targetPerSec = Math.min(Number(state.cfg.controlZoomMaxDeltaPerSecond || cfgPerSec), cfgPerSec);
    const rampUpMs = Number(state.cfg.rampUpMs || 300);

    state.continuousZoom.running = true;
    state.continuousZoom.direction = _ramp.targetDir;
    state.continuousZoom.lastTime = performance.now();

    function step(now) {
      if (!state.continuousZoom.running) { _ramp.rafId = null; return; }
      const elapsedSinceStart = now - _ramp.startTime;
      const rampProgress = rampUpMs > 0 ? Math.min(1, elapsedSinceStart / rampUpMs) : 1;
      const perSec = targetPerSec * rampProgress * _ramp.targetDir;
      const elapsed = now - state.continuousZoom.lastTime;
      state.continuousZoom.lastTime = now;
      const deltaToApply = perSec * (elapsed / 1000);
      try {
        const pos = getFocusPosOrCenter();
        const tx = Math.round(pos.x), ty = Math.round(pos.y);
        const targetEl = document.elementFromPoint(tx, ty) || document.body;
        targetEl.dispatchEvent(makeWheel(tx, ty, 0, deltaToApply));
        state.sent += 1;
      } catch (e) {}
      _ramp.rafId = requestAnimationFrame(step);
    }
    _ramp.rafId = requestAnimationFrame(step);
  }

  function stopContinuousZoom() {
    if (!state.continuousZoom.running && !_ramp.rafId) return;
    const rampDownMs = Number(state.cfg.rampDownMs || 150);
    const endAt = performance.now() + rampDownMs;
    const dir = state.continuousZoom.direction || _ramp.targetDir || 0;
    if (_ramp.rafId) { try { cancelAnimationFrame(_ramp.rafId); } catch (e) {} _ramp.rafId = null; }

    (function decay(prev) {
      const now = performance.now();
      const remain = Math.max(0, endAt - now);
      const t = rampDownMs > 0 ? (remain / rampDownMs) : 0;
      const decayFactor = t;
      if (decayFactor > 0) {
        try {
          const perSec = Math.abs(Number(state.cfg.controlZoomDeltaPerSecond || state.cfg.controlZoomDeltaPerSecond_fallback));
          const deltaToApply = dir * perSec * decayFactor * ((now - (prev || now)) / 1000);
          const pos = getFocusPosOrCenter();
          const tx = Math.round(pos.x), ty = Math.round(pos.y);
          const targetEl = document.elementFromPoint(tx, ty) || document.body;
          targetEl.dispatchEvent(makeWheel(tx, ty, 0, deltaToApply));
          state.sent += 1;
        } catch (e) {}
        requestAnimationFrame(() => decay(now));
      } else {
        state.continuousZoom.running = false;
        state.continuousZoom.direction = 0;
        _ramp.targetDir = 0;
      }
    })();
  }

  /* Key handlers */
  function onKeyDownHandler(e) {
    try {
      if (!e || !e.key) return;
      const key = e.key.toLowerCase();
      const active = document.activeElement;
      if (isTypingElement(active)) return;
      if (key === (state.cfg.zoomKey || 'q')) {
        if (!state.continuousZoom.running) startContinuousZoom(+1);
        e.preventDefault();
        return;
      }
      if (key === (state.cfg.shrinkKey || 'e')) {
        if (!state.continuousZoom.running) startContinuousZoom(-1);
        e.preventDefault();
        return;
      }
    } catch (err) {}
  }
  function onKeyUpHandler(e) {
    try {
      if (!e || !e.key) return;
      const key = e.key.toLowerCase();
      if (key === (state.cfg.zoomKey || 'q') || key === (state.cfg.shrinkKey || 'e')) {
        stopContinuousZoom();
        e.preventDefault();
        return;
      }
    } catch (err) {}
  }
  function attachKeyListener() {
    try {
      window.__slowWheelUntilButtonGoneOnKeyDown = onKeyDownHandler;
      window.__slowWheelUntilButtonGoneOnKeyUp = onKeyUpHandler;
      window.addEventListener('keydown', window.__slowWheelUntilButtonGoneOnKeyDown, true);
      window.addEventListener('keyup', window.__slowWheelUntilButtonGoneOnKeyUp, true);
    } catch (e) {}
  }
  function detachKeyListener() {
    try {
      window.removeEventListener('keydown', window.__slowWheelUntilButtonGoneOnKeyDown || onKeyDownHandler, true);
      window.removeEventListener('keyup', window.__slowWheelUntilButtonGoneOnKeyUp || onKeyUpHandler, true);
    } catch (e) {}
  }

  /* Observers */
  function startObservingButtonPresence() {
    if (state.buttonObserver) return;
    if (isVisible(qButton())) attachClickListener();
    state.buttonObserver = new MutationObserver(() => {
      const btn = qButton();
      if (btn && isVisible(btn)) attachClickListener();
    });
    try { state.buttonObserver.observe(document.documentElement || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) {}
  }

  /* Public API */
  window.__slowWheelUntilButtonGone = {
    config: state.cfg,
    isRunning() { return state.running || (state.continuousZoom && state.continuousZoom.running) || (state.smoothController && state.smoothController.isRunning()); },
    stop() { stop('manual'); },
    cancel() { stop('cancel'); },
    simulateAt(x, y, overrides = {}) {
      Object.assign(state.cfg, overrides);
      if (state.running) { console.warn('already running'); return; }
      if (!isVisible(qButton())) { console.log('target not visible'); return; }
      startAt(Number(x) || 0, Number(y) || 0);
    },
    simulateShrink(count, x, y) {
      const px = (typeof x === 'number') ? x : getFocusPosOrCenter().x;
      const py = (typeof y === 'number') ? y : getFocusPosOrCenter().y;
      const c = Number(count || state.cfg.shrinkCount);
      const base = state.cfg.deltaPerEvent || -300;
      const sign = -Math.sign(base || -1);
      const perStep = Math.abs(base) * (state.cfg.shrinkDeltaPerEventMultiplier || 1);
      const totalDelta = sign * perStep * c;
      simulateSmooth(totalDelta, px, py, state.cfg.smoothDurationMs);
    },
    simulateZoom(count, x, y) {
      const px = (typeof x === 'number') ? x : getFocusPosOrCenter().x;
      const py = (typeof y === 'number') ? y : getFocusPosOrCenter().y;
      const c = Number(count || state.cfg.zoomCount);
      const base = state.cfg.deltaPerEvent || -300;
      const sign = Math.sign(base || -1);
      const perStep = Math.abs(base) * (state.cfg.zoomDeltaPerEventMultiplier || 1);
      const totalDelta = sign * perStep * c;
      simulateSmooth(totalDelta, px, py, state.cfg.smoothDurationMs);
    },
    startListening() { attachClickListener(); attachKeyListener(); attachPointerTracker(); startNotifObserver(); startObservingButtonPresence(); },
    destroy() {
      stop('destroy');
      detachClickListener();
      detachKeyListener();
      detachPointerTracker();
      try { if (state.buttonObserver) { state.buttonObserver.disconnect(); state.buttonObserver = null; } } catch(e){}
      try { if (state.notifObserver) { state.notifObserver.disconnect(); state.notifObserver = null; } } catch(e){}
      try { delete window.__slowWheelUntilButtonGone; } catch(e){}
      window.__wplace_click_center_zoom_installed = false;
    },
    info() { return { running: state.running, continuousZoom: state.continuousZoom.running, lastMousePos: state.lastMousePos, sent: state.sent, config: state.cfg }; }
  };

  /* initialize */
  startNotifObserver();
  startObservingButtonPresence();
  try { if (isVisible(qButton())) attachClickListener(); } catch (e) {}
  attachKeyListener();
  attachPointerTracker();

  /* Right-button long-press acts like pressing Q (with smoother tuning) */
  (function installRightHoldAsQ() {
    const HOLD_MS = Number(state.cfg.rightHoldMs || 500);
    const MOVE_THRESHOLD = Number(state.cfg.rightHoldMoveThreshold || 10);
    let rightState = { pressed: false, timer: null, active: false, startX: 0, startY: 0, moved: false, suppressHandler: null };

    function popupExists() {
      try {
        return !!document.querySelector('.rounded-t-box.bg-base-100.border-base-300.w-full.border-t.py-3');
      } catch (e) { return false; }
    }

    function onRightDown(e) {
      if (e.button !== 2) return;
      if (popupExists()) return;
      if (isTypingElement(document.activeElement)) return;

      rightState.pressed = true;
      rightState.moved = false;
      rightState.startX = e.clientX;
      rightState.startY = e.clientY;

      rightState.timer = setTimeout(() => {
        if (!rightState.pressed) return;
        // small movement still considered hold
        rightState.active = true;
        try { attachPointerTracker(); attachKeyListener(); } catch (_) {}
        try { startContinuousZoom(+1); } catch (_) {}
        try {
          rightState.suppressHandler = function(ev) { if (rightState.active) { ev.preventDefault(); ev.stopImmediatePropagation(); } };
          window.addEventListener('contextmenu', rightState.suppressHandler, true);
        } catch (_) { rightState.suppressHandler = null; }
      }, HOLD_MS);
    }

    function onRightMove(e) {
      if (!rightState.pressed) return;
      const dx = e.clientX - rightState.startX;
      const dy = e.clientY - rightState.startY;
      if (Math.hypot(dx, dy) > MOVE_THRESHOLD) rightState.moved = true;
    }

    function onRightUp(e) {
      if (e.button !== 2) return;
      if (rightState.timer) { clearTimeout(rightState.timer); rightState.timer = null; }
      const wasActive = rightState.active;
      rightState.pressed = false;
      rightState.active = false;

      try { stopContinuousZoom(); } catch (_) {}

      try {
        if (rightState.suppressHandler) {
          window.removeEventListener('contextmenu', rightState.suppressHandler, true);
          rightState.suppressHandler = null;
        }
      } catch (_) {}

      if (wasActive) {
        const once = function(ev){ ev.preventDefault(); ev.stopImmediatePropagation(); window.removeEventListener('contextmenu', once, true); };
        try { window.addEventListener('contextmenu', once, true); } catch (_) {}
      }
    }

    try {
      window.addEventListener('mousedown', onRightDown, true);
      window.addEventListener('pointermove', onRightMove, true);
      window.addEventListener('mouseup', onRightUp, true);

      if (!window.__wplace_right_hold_q_installed) {
        window.__wplace_right_hold_q_installed = true;
        window.__wplace_uninstall_right_hold_q = function() {
          try {
            window.removeEventListener('mousedown', onRightDown, true);
            window.removeEventListener('pointermove', onRightMove, true);
            window.removeEventListener('mouseup', onRightUp, true);
          } catch (e) {}
          window.__wplace_right_hold_q_installed = false;
        };
      }
    } catch (e) {}
  })();

})();

// --------- final small checks ----------
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(()=>{}).catch(()=>{});
  }
} catch (e){}
})();
