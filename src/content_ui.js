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
      choose_map: "Map style",
      fav_add: "☆",
      fav_added: "Saved to favorites",
      fav_no_input: "No valid coords to save",
      fav_manager: "Favorites",
      fav_empty: "No favorites yet",
      fav_rename: "Rename",
      fav_delete: "Delete",
      fav_copy: "Copy",
      fav_jump: "Jump",
      fav_name_placeholder: "Name (optional)",
      fav_saved_label: "Saved",
      fav_load: "Load",
      ruler: "Ruler",
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
      fav_added: "已加入收藏",
      fav_no_input: "没有可保存的有效坐标",
      fav_manager: "收藏夹",
      fav_empty: "尚无收藏",
      fav_rename: "重命名",
      fav_delete: "删除",
      fav_copy: "复制",
      fav_jump: "跳转",
      fav_name_placeholder: "名称（可选）",
      fav_saved_label: "已保存",
      fav_load: "加载",
       ruler: "标尺",
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
      theme_dark: "深色"
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
        <button id="wplace_share" class="wplace_btn">${t("share")}</button>
        <button id="wplace_jump_btn" class="wplace_btn secondary">${t("jump")}</button>
        <button id="wplace_fav_btn" title="${t("fav_add")}" class="wplace_btn star">${t("fav_add")}</button>
        <button id="wplace_fav_manager_btn" class="wplace_btn">${t("fav_manager")}</button>
        <button id="wplace_ruler_btn" class="wplace_btn">${t("ruler")}</button>
      </div>
      <input id="wplace_input" type="text" placeholder="${t("placeholder")}" />
    </div>
    <div id="wplace_toast"></div>
  `;
  document.body.appendChild(root);
  try {
    root.style.minWidth = '420px';
    root.style.maxWidth = '92vw';
  } catch (e) {}

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

  langSel.value = lang;
// 更全面且稳健的语言切换处理器（替换原有的 change handler）
langSel.addEventListener("change", () => {
  lang = langSel.value;
  try { localStorage.setItem("wplace_lang", lang); } catch (e) {}

  // 更新主面板静态文本
  try {
    const titleEl = root.querySelector("#wplace_title");
    if (titleEl) titleEl.textContent = t("title");

    const shareBtnEl = root.querySelector("#wplace_share");
    if (shareBtnEl) shareBtnEl.textContent = t("share");

    const jumpBtnEl = root.querySelector("#wplace_jump_btn");
    if (jumpBtnEl) jumpBtnEl.textContent = t("jump");

    const inputElLocal = root.querySelector("#wplace_input");
    if (inputElLocal) inputElLocal.placeholder = t("placeholder");

    const minBtnLocal = root.querySelector("#wplace_min_btn");
    if (minBtnLocal) minBtnLocal.title = t("minimized_tip");

    const favBtnLocal = root.querySelector("#wplace_fav_btn");
    if (favBtnLocal) favBtnLocal.title = t("fav_add");

    const favMgrBtnLocal = root.querySelector("#wplace_fav_manager_btn");
    if (favMgrBtnLocal) favMgrBtnLocal.textContent = t("fav_manager");

    const rulerBtnLocal = root.querySelector("#wplace_ruler_btn");
    if (rulerBtnLocal) rulerBtnLocal.textContent = t("ruler");
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
    const handle = rootEl.querySelector(' .drag-handle') || rootEl;

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
      sel.title = '切换主题';
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
      <div class="drag-handle" style="font-weight:600;">${t("fav_manager")}</div>
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
  // 全局 click 委托：点击落在地图容器或其子元素时触发（延迟 1 秒再去拉取并填充）
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

    if (pathHasMapElement(path) || pathHasMapElementFallback(path)) {
      setTimeout(() => {
        try { requestFetchAndFill(); } catch(e){}
      }, 700);
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
    // click-based slow wheel settings (single-click behavior unchanged)
    deltaPerEvent: -300,
    intervalMs: 100,
    maxEvents: 5000,
    buttonSelector: 'button.btn.sm\\:btn-lg.duration.text-nowrap.text-xs.transition-opacity.sm\\:text-base',
    buttonTextMustContain: 'Zoom in to see the pixels',
    useCapture: true,
    clickMoveThreshold: 6,
    clickMaxDurationMs: 500,
    // notification selector variants (including exact element you pasted)
    removeNotificationSelector:
      'section[aria-label="Notifications alt+T"][aria-live="polite"][aria-relevant="additions text"][aria-atomic="false"].svelte-tppj9g[tabindex="-1"],' +
      'section[aria-label="Notifications alt+T"][aria-live="polite"][aria-relevant="additions text"][aria-atomic="false"][tabindex="-1"],' +
      'section[aria-label="Notifications alt+T"][tabindex="-1"].svelte-tppj9g,' +
      'section[aria-label="Notifications alt+T"],' +
      'section.svelte-tppj9g[aria-label="Notifications alt+T"]',
    // keys: Q/E for continuous zoom
    zoomKey: 'q',
    shrinkKey: 'e',
    // single-shot smooth settings (simulateZoom/simulateShrink)
    smoothDurationMs: 800,
    zoomCount: 8,
    shrinkCount: 8,
    zoomDeltaPerEventMultiplier: 0.45,
    shrinkDeltaPerEventMultiplier: 0.45,
    // continuous fixed-rate control: wheel-delta applied per second while holding Q/E
    // 调整此值来增减按住时的放缩速度（单位：wheel delta / second）
    controlZoomDeltaPerSecond: 2400
  };

  const state = {
    cfg: Object.assign({}, DEFAULT),
    // click-slow-wheel
    running: false,
    sent: 0,
    timerId: null,
    observer: null,
    buttonObserver: null,
    notifObserver: null,
    lastMousePos: null,
    lastPoint: { x: 0, y: 0 },

    // click detection
    mouseDownPos: null,
    mouseDownTime: 0,
    moved: false,
    listenersAttached: false,

    // pointer tracking
    pointerListenerAttached: false,

    // single-shot smooth controller
    smoothController: null,

    // continuous zoom state for Q/E (RAF-driven)
    continuousZoom: { rafId: null, running: false, direction: 0, lastTime: 0 }
  };

  /* ---------- helpers ---------- */
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

  /* ---------- click-slow-wheel logic (unchanged speed) ---------- */
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
    console.log('slowWheelUntilButtonGone started at', x, y);
  }

  function stop(reason = 'stopped') {
    state.running = false;
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    if (state.observer) { try { state.observer.disconnect(); } catch (e) {} state.observer = null; }
    stopContinuousZoom();
    if (state.smoothController) { state.smoothController.cancel(); state.smoothController = null; }
    console.log('slowWheelUntilButtonGone stopped:', reason, 'eventsSent:', state.sent);
  }

  /* ---------- click detection: 在单击前立即删除指定通知 section ---------- */
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
    // --- 新增：如果点击发生在需要忽略的元素上，则不做任何动作 ---
    try {
      // marker 的完整类选择器（基于你给出的 HTML）
      const markerSelector = '.text-yellow-400.cursor-pointer.z-10.maplibregl-marker.maplibregl-marker-anchor-center';
      // 弹窗内的圆形小按钮（关闭按钮）位于 .rounded-t-box 内
      const popupCloseBtnSelector = '.rounded-t-box button.btn.btn-circle.btn-sm';
      if (e.target && (e.target.closest && (
            e.target.closest(markerSelector) ||
            e.target.closest(popupCloseBtnSelector)
          ))) {
        // 点击在需要忽略的元素上：直接返回，不移除通知、不触发慢速滚轮
        return;
      }
    } catch (innerErr) {}

    // 1) 先立即移除你指定的通知 section（有多种变体，removeNotificationSectionsFrom 会处理）
    try { removeNotificationSectionsFrom(document); } catch (err) {}
    // 2) 再启动单击触发的慢速派发（速度保持原样）
    startAt(e.clientX, e.clientY);
  } catch (err) {}
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
      console.log('listening for single clicks (drag ignored)');
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

  /* ---------- pointer tracking for focus pos ---------- */
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

  /* ---------- remove notification section (robust) ---------- */
  function removeNotificationSectionsFrom(root) {
    try {
      const sel = state.cfg.removeNotificationSelector;
      if (!sel) return 0;
      const rootNode = root || document;
      let list = [];
      try {
        list = Array.from(rootNode.querySelectorAll(sel));
      } catch (e) {
        // fallback: manual matching for the exact attribute set you provided
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
      if (removed) console.log('removed notification section(s):', removed);
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

  /* ---------- Smooth single-shot controller (keeps simulateZoom/ simulateShrink) ---------- */
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

  /* ---------- Continuous fixed-rate zoom (RAF time-driven) ---------- */
  function startContinuousZoom(direction) {
    // direction: +1 zoom-in, -1 zoom-out
    stopContinuousZoom();
    state.continuousZoom.running = true;
    state.continuousZoom.direction = direction;
    state.continuousZoom.lastTime = performance.now();

    const cfgPerSec = Number(state.cfg.controlZoomDeltaPerSecond) || 2400;
    // signed per-second wheel-delta depending on direction
    const signedPerSec = (direction > 0) ? Math.abs(cfgPerSec) : -Math.abs(cfgPerSec);

    function step(now) {
      if (!state.continuousZoom.running) { state.continuousZoom.rafId = null; return; }
      const elapsed = now - state.continuousZoom.lastTime;
      state.continuousZoom.lastTime = now;
      const deltaToApply = signedPerSec * (elapsed / 1000);
      const pos = getFocusPosOrCenter();
      try {
        const tx = Math.round(pos.x), ty = Math.round(pos.y);
        const targetEl = document.elementFromPoint(tx, ty) || document.body;
        targetEl.dispatchEvent(makeWheel(tx, ty, 0, deltaToApply));
        state.sent += 1;
      } catch (e) {}
      state.continuousZoom.rafId = requestAnimationFrame(step);
    }
    state.continuousZoom.rafId = requestAnimationFrame(step);
  }

  function stopContinuousZoom() {
    if (state.continuousZoom.rafId) {
      try { cancelAnimationFrame(state.continuousZoom.rafId); } catch (e) {}
      state.continuousZoom.rafId = null;
    }
    state.continuousZoom.running = false;
    state.continuousZoom.direction = 0;
  }

  /* ---------- Key handlers (only Q/E for continuous fixed-rate zoom) ---------- */
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

  /* ---------- Observers for button presence and notification removal ---------- */
  function startObservingButtonPresence() {
    if (state.buttonObserver) return;
    if (isVisible(qButton())) attachClickListener();
    state.buttonObserver = new MutationObserver(() => {
      const btn = qButton();
      if (btn && isVisible(btn)) attachClickListener();
    });
    try { state.buttonObserver.observe(document.documentElement || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) {}
  }

  /* ---------- Public API ---------- */
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
      console.log('slowWheelUntilButtonGone destroyed');
    },
    info() { return { running: state.running, continuousZoom: state.continuousZoom.running, lastMousePos: state.lastMousePos, sent: state.sent, config: state.cfg }; }
  };

  /* ---------- initialize ---------- */
  startNotifObserver();
  startObservingButtonPresence();
  try { if (isVisible(qButton())) attachClickListener(); } catch (e) {}
  attachKeyListener();
  attachPointerTracker();

  console.log('ready: specified notification section removed on click; hold Q/E for fixed-rate zoom (config.controlZoomDeltaPerSecond); single-click slow-zoom unchanged.');
})();

// --------- final small checks ----------
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(()=>{}).catch(()=>{});
  }
} catch (e){}
})();
