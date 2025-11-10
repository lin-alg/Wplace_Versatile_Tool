// ==UserScript==
// @name         Pixel Dropper Injected (Press C + Precise Offline Suppress) - Auto-read coords (bm-j) + bm-D support
// @namespace    http://tampermonkey.net/
// @version      1.9.3
// @description  按 C 时模拟点击 paint 并在检测窗口内拦截上报。支持自动读取已存在的坐标输入（旧 id 与 bm-D 内的新 id），兼容多种 file input 包装形式，优化 observer debounce 与透明颜色处理。
// @match        https://*.wplace.live/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  function injectedPixelDropper() {
  try {
    // ---------- Config ----------
    const URL_MATCH = new RegExp('/s0/pixel/' + '\\d+' + '/' + '\\d+', 'i');
    const TILE_SIZE = 1000;
    const PENDING_WINDOW_MS = 3500;
    let allowedColorIds = new Set([7]);
    let enforceDrop = true;

    // ---------- Color name map ----------
    const COLOR_NAMES = new Map([
      [0, 'Transparent'], [1, 'Black'], [2, 'Dark Gray'], [3, 'Gray'], [4, 'Light Gray'], [5, 'White'],
      [6, 'Deep Red'], [7, 'Red'], [8, 'Orange'], [9, 'Gold'], [10, 'Yellow'], [11, 'Light Yellow'],
      [12, 'Dark Green'], [13, 'Green'], [14, 'Light Green'], [15, 'Dark Teal'], [16, 'Teal'], [17, 'Light Teal'],
      [18, 'Dark Blue'], [19, 'Blue'], [20, 'Cyan'], [21, 'Indigo'], [22, 'Light Indigo'], [23, 'Dark Purple'],
      [24, 'Purple'], [25, 'Light Purple'], [26, 'Dark Pink'], [27, 'Pink'], [28, 'Light Pink'], [29, 'Dark Brown'],
      [30, 'Brown'], [31, 'Beige'], [32, 'Medium Gray'], [33, 'Dark Red (alt)'], [34, 'Light Red'], [35, 'Dark Orange'],
      [36, 'Light Tan'], [37, 'Dark Goldenrod'], [38, 'Goldenrod'], [39, 'Light Goldenrod'], [40, 'Dark Olive'], [41, 'Olive'],
      [42, 'Light Olive'], [43, 'Dark Cyan'], [44, 'Light Cyan'], [45, 'Light Blue'], [46, 'Dark Indigo'], [47, 'Dark Slate Blue'],
      [48, 'Slate Blue'], [49, 'Light Slate Blue'], [50, 'Light Brown'], [51, 'Dark Beige'], [52, 'Light Beige'], [53, 'Dark Peach'],
      [54, 'Peach'], [55, 'Light Peach'], [56, 'Dark Tan'], [57, 'Tan'], [58, 'Dark Slate'], [59, 'Slate'],
      [60, 'Light Slate'], [61, 'Dark Stone'], [62, 'Stone'], [63, 'Light Stone'],
    ]);
    function colorNameForId(id) {
      if (COLOR_NAMES.has(id)) return COLOR_NAMES.get(id);
      if (typeof id === 'number') return 'id:' + id;
      return String(id);
    }

    // ---------- State & Utils ----------
    let LOG = [];
    let RECENT_BLOCKS = [];
    function pushLog(item) { LOG.push(Object.assign({ ts: Date.now() }, item)); if (LOG.length > 1000) LOG.shift(); }
    function isPixelUrl(url) { try { return URL_MATCH.test(String(url)); } catch (e) { return false; } }
    function looksLikeJson(s) { if (typeof s !== 'string') return false; const t = s.trim(); return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')); }

    // ---------- UI helpers ----------
    let toastTimer = null;
    function showTopToast(text, ttl = 2500) {
      try {
        let t = document.getElementById('__pixel_dropper_toast');
        if (!t) {
          t = document.createElement('div');
          t.id = '__pixel_dropper_toast';
          t.style.position = 'fixed';
          t.style.left = '50%';
          t.style.top = '12px';
          t.style.transform = 'translateX(-50%)';
          t.style.zIndex = String(2147483646);
          t.style.background = 'rgba(15,23,42,0.95)';
          t.style.color = '#fff';
          t.style.padding = '10px 14px';
          t.style.borderRadius = '8px';
          t.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
          t.style.fontSize = '13px';
          t.style.boxShadow = '0 6px 24px rgba(2,6,23,0.35)';
          document.documentElement.appendChild(t);
        }
        t.textContent = text;
        t.style.opacity = '1';
        if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
        toastTimer = setTimeout(() => {
          try { t.style.transition = 'opacity 240ms ease'; t.style.opacity = '0'; } catch (e) {}
        }, ttl);
      } catch (e) {}
    }

    // ---------- Panel (non-blocking draggable list) ----------
    let currentPanel = null;
    const PANEL_ID = '__pixel_dropper_panel';

    // helper: convert global gx,gy -> four coords [tileX, tileY, pxX, pxY]
    function globalToFour(gx, gy, TILE_SIZE_LOCAL = TILE_SIZE) {
      const tileX = Math.floor(Number(gx) / TILE_SIZE_LOCAL);
      const tileY = Math.floor(Number(gy) / TILE_SIZE_LOCAL);
      const pxX = Number(gx) - tileX * TILE_SIZE_LOCAL;
      const pxY = Number(gy) - tileY * TILE_SIZE_LOCAL;
      return [tileX, tileY, pxX, pxY];
    }

    // helper: try to fly using page's quick flyer logic, but only when Skirk Marble exists.
    // returns a promise resolving { ok: boolean, msg: string, used: string? }
    function tryFlyToFour(fourCoords, zoom = 22) {
      return new Promise((resolve) => {
        try {
          // require Skirk Marble present
          const skirk = document.getElementById('bm-v');
          if (!skirk) {
            return resolve({ ok: false, msg: '请安装skirk marble以使用跳转功能！' });
          }

          // convert four -> latlng using same math as quick flyer constants
          const A1 = 1023999.50188499956857413054;
          const B1 = 325949.32345220289425924420;
          const A2 = 1023999.50188501563388854265;
          const B2 = 325949.32345236750552430749;
          const TlX = Number(fourCoords[0]), TlY = Number(fourCoords[1]), PxX = Number(fourCoords[2]), PxY = Number(fourCoords[3]);
          const X = TlX * 1000 + PxX;
          const Y = TlY * 1000 + PxY;
          const lng = (180 / Math.PI) * ((X - A1) / B1);
          const t = Math.exp((A2 - Y) / B2);
          const lat = (360 / Math.PI) * (Math.atan(t) - Math.PI / 4);

          // try page-exposed __bm_quick_fly
          try {
            if (typeof window.__bm_quick_fly === 'function') {
              const r = window.__bm_quick_fly(lat, lng, zoom) || {};
              if (r.ok !== false) return resolve({ ok: true, used: r.used || '__bm_quick_fly' });
            }
          } catch (e) {}

          // try unsafeWindow.__bm_quick_fly
          try {
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.__bm_quick_fly && typeof unsafeWindow.__bm_quick_fly === 'function') {
              const r = unsafeWindow.__bm_quick_fly(lat, lng, zoom) || {};
              if (r.ok !== false) return resolve({ ok: true, used: 'unsafeWindow.__bm_quick_fly' });
            }
          } catch (e) {}

          // try direct bmmap.flyTo or map.flyTo
          try {
            if (window.bmmap && typeof window.bmmap.flyTo === 'function') {
              window.bmmap.flyTo({ center: [lng, lat], zoom: zoom });
              return resolve({ ok: true, used: 'bmmap.flyTo' });
            }
            if (window.map && typeof window.map.flyTo === 'function') {
              window.map.flyTo({ center: [lng, lat], zoom: zoom });
              return resolve({ ok: true, used: 'map.flyTo' });
            }
          } catch (e) {}

          // skirk exists but no usable API found
          return resolve({ ok: false, msg: '未能找到跳转API' });
        } catch (err) {
          return resolve({ ok: false, msg: String(err) });
        }
      });
    }

    // create or update panel
    function createOrUpdatePanel(blockedInfo) {
      try {
        if (currentPanel && currentPanel.parentElement) {
          populatePanel(currentPanel, blockedInfo);
          currentPanel.style.display = 'block';
          return;
        }

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.position = 'fixed';
        panel.style.right = '18px';
        panel.style.top = '18px';
        panel.style.width = '420px';
        panel.style.maxWidth = '92vw';
        panel.style.background = '#0b1220';
        panel.style.color = '#e6eef8';
        panel.style.border = '1px solid rgba(255,255,255,0.06)';
        panel.style.borderRadius = '10px';
        panel.style.padding = '10px';
        panel.style.zIndex = String(2147483647);
        panel.style.boxShadow = '0 8px 30px rgba(0,0,0,0.5)';
        panel.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
        panel.style.fontSize = '13px';
        panel.style.pointerEvents = 'auto';
        panel.style.userSelect = 'none';

        const hdr = document.createElement('div');
        hdr.style.display = 'flex';
        hdr.style.alignItems = 'center';
        hdr.style.justifyContent = 'space-between';
        hdr.style.gap = '8px';
        hdr.style.marginBottom = '8px';
        hdr.style.cursor = 'grab';

        const title = document.createElement('strong');
        title.textContent = '错误像素位置';
        title.style.fontSize = '14px';

        const btnsRight = document.createElement('div');
        btnsRight.style.display = 'flex';
        btnsRight.style.gap = '6px';
        btnsRight.style.alignItems = 'center';

        const clearAllBtn = document.createElement('button');
        clearAllBtn.textContent = '清空';
        clearAllBtn.title = '清空所有条目';
        clearAllBtn.style.background = '#334155';
        clearAllBtn.style.color = '#dbeafe';
        clearAllBtn.style.border = 'none';
        clearAllBtn.style.borderRadius = '6px';
        clearAllBtn.style.padding = '4px 8px';
        clearAllBtn.style.cursor = 'pointer';
        clearAllBtn.addEventListener('click', () => {
          try { clearPanelItems(); } catch (e) {}
        });

        const closeAll = document.createElement('button');
        closeAll.textContent = '×';
        closeAll.title = '关闭面板';
        closeAll.style.background = '#21314a';
        closeAll.style.color = '#dbeafe';
        closeAll.style.border = 'none';
        closeAll.style.borderRadius = '6px';
        closeAll.style.padding = '4px 8px';
        closeAll.style.cursor = 'pointer';
        closeAll.addEventListener('click', () => {
          try { panel.remove(); currentPanel = null; } catch (e) {}
        });

        btnsRight.appendChild(clearAllBtn);
        btnsRight.appendChild(closeAll);
        hdr.appendChild(title);
        hdr.appendChild(btnsRight);
        panel.appendChild(hdr);

        const list = document.createElement('div');
        list.id = PANEL_ID + '-list';
        list.style.maxHeight = '56vh';
        list.style.overflow = 'auto';
        list.style.padding = '4px';
        list.style.display = 'grid';
        list.style.rowGap = '6px';
        panel.appendChild(list);

        const foot = document.createElement('div');
        foot.style.marginTop = '8px';
        foot.style.display = 'flex';
        foot.style.justifyContent = 'space-between';
        foot.style.alignItems = 'center';
        const hint = document.createElement('div');
        hint.style.fontSize = '12px';
        hint.style.color = '#9fb0d8';
        hint.textContent = '点“跳转”需安装 Skirk Marble 且页面支持跳转 API';
        foot.appendChild(hint);
        panel.appendChild(foot);

        document.body.appendChild(panel);
        currentPanel = panel;

        // drag logic
        (function makeDraggable(target, handle) {
          let dragging = false, sx = 0, sy = 0, startRight = 0, startTop = 0;
          handle.addEventListener('mousedown', (ev) => {
            dragging = true;
            sx = ev.clientX; sy = ev.clientY;
            const rect = target.getBoundingClientRect();
            startRight = window.innerWidth - rect.right;
            startTop = rect.top;
            handle.style.cursor = 'grabbing';
            ev.preventDefault();
          });
          window.addEventListener('mousemove', (ev) => {
            if (!dragging) return;
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            let newRight = (startRight - dx);
            let newTop = (startTop + dy);
            newRight = Math.max(8, Math.min(window.innerWidth - 80, newRight));
            newTop = Math.max(8, Math.min(window.innerHeight - 40, newTop));
            target.style.right = newRight + 'px';
            target.style.top = newTop + 'px';
          });
          window.addEventListener('mouseup', () => {
            dragging = false;
            handle.style.cursor = 'grab';
          });
        })(panel, hdr);

        populatePanel(panel, blockedInfo);
      } catch (e) {
        console.error('create panel error', e);
      }
    }

    function clearPanelItems() {
      try {
        RECENT_BLOCKS.length = 0;
        if (currentPanel && currentPanel.parentElement) {
          const list = currentPanel.querySelector('#' + PANEL_ID + '-list');
          if (list) list.innerHTML = '';
        }
        pushLog({ type: 'panel_cleared' });
      } catch (e) {}
    }

    function populatePanel(panel, blockedInfo) {
      try {
        const list = panel.querySelector('#' + PANEL_ID + '-list');
        if (!list) return;
        list.innerHTML = '';

        if (!blockedInfo || !Array.isArray(blockedInfo.mismatches) || blockedInfo.mismatches.length === 0) {
          const empty = document.createElement('div');
          empty.style.color = '#9fb0d8';
          empty.textContent = '未提供不匹配细节';
          list.appendChild(empty);
          return;
        }

        blockedInfo.mismatches.slice(0, 200).forEach((m) => {
          const gx = Number(m.coord[0]);
          const gy = Number(m.coord[1]);
          const tileX = Math.floor(gx / TILE_SIZE);
          const tileY = Math.floor(gy / TILE_SIZE);
          const localX = gx - tileX * TILE_SIZE;
          const localY = gy - tileY * TILE_SIZE;
          const payloadName = colorNameForId(Number(m.payloadColorId));
          const expectedName = colorNameForId(Number(m.expectedColorId));

          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.justifyContent = 'space-between';
          row.style.padding = '8px';
          row.style.borderRadius = '8px';
          row.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';
          row.style.border = '1px solid rgba(255,255,255,0.03)';

          const info = document.createElement('div');
          info.style.flex = '1';
          info.style.fontSize = '13px';
          info.style.color = '#e6eef8';
          info.style.display = 'flex';
          info.style.flexDirection = 'column';

          const topLine = document.createElement('div');
          topLine.style.display = 'flex';
          topLine.style.justifyContent = 'space-between';
          topLine.style.gap = '8px';
          const lbl = document.createElement('div');
          lbl.textContent = `#${m.index} Coordinate:${tileX},${tileY},${localX},${localY}`;
          lbl.style.color = '#dbeafe';
          lbl.style.fontWeight = '600';
          lbl.style.fontSize = '13px';
          topLine.appendChild(lbl);

          const colorLabel = document.createElement('div');
          colorLabel.textContent = `${payloadName} → ${expectedName}`;
          colorLabel.style.color = '#9fb0d8';
          colorLabel.style.fontSize = '12px';
          topLine.appendChild(colorLabel);

          info.appendChild(topLine);

          const sub = document.createElement('div');
          sub.style.color = '#9fb0d8';
          sub.style.fontSize = '12px';
          sub.textContent = `global: ${gx}, ${gy}`;
          info.appendChild(sub);

          row.appendChild(info);

          const actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.gap = '6px';
          actions.style.marginLeft = '8px';

          const btnJump = document.createElement('button');
          btnJump.textContent = '跳转';
          btnJump.title = '跳转到该四坐标位置';
          btnJump.style.background = '#2b6df6';
          btnJump.style.color = '#fff';
          btnJump.style.border = 'none';
          btnJump.style.padding = '6px 8px';
          btnJump.style.borderRadius = '6px';
          btnJump.style.cursor = 'pointer';
          btnJump.addEventListener('click', async (ev) => {
            try {
              const four = globalToFour(gx, gy);
              const res = await tryFlyToFour(four, 22);
              if (res.ok) {
                showTopToast(`跳转成功（${res.used || 'api'}）`, 1600);
              } else {
                showTopToast(res.msg || '跳转失败', 2400);
              }
            } catch (e) {
              showTopToast('跳转异常', 1600);
            }
          });

          const btnClose = document.createElement('button');
          btnClose.textContent = '✕';
          btnClose.title = '关闭此条目';
          btnClose.style.background = '#21314a';
          btnClose.style.color = '#dbeafe';
          btnClose.style.border = 'none';
          btnClose.style.padding = '6px 8px';
          btnClose.style.borderRadius = '6px';
          btnClose.style.cursor = 'pointer';
          btnClose.addEventListener('click', () => {
            try { row.remove(); } catch (e) {}
          });

          actions.appendChild(btnJump);
          actions.appendChild(btnClose);
          row.appendChild(actions);

          list.appendChild(row);
        });
      } catch (e) {
        console.error('populatePanel err', e);
      }
    }

    function showErrorModal(blockedInfo) {
      try {
        createOrUpdatePanel(blockedInfo);
        try { RECENT_BLOCKS.unshift(blockedInfo); if (RECENT_BLOCKS.length > 50) RECENT_BLOCKS.pop(); } catch (e) {}
      } catch (e) {
        console.error('showErrorPanel error', e);
      }
    }

    function hideCustomModal() {
      try {
        if (currentPanel && currentPanel.parentElement) {
          currentPanel.remove();
          currentPanel = null;
        }
      } catch (e) {}
    }

    // ---------- Image + inputs ----------
    let importedImage = { width: 0, height: 0, data: null, originGlobalX: null, originGlobalY: null, filename: null, source: null, loading: false };
    function $id(id) { try { return document.getElementById(id); } catch (e) { return null; } }
    const fileInputIds = ['bm-a', 'bm-j'];

    function parseIntOr0(v) { const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : 0; }

    // ---------- compute origin supporting multiple selectors ----------
    function computeOriginFromInputs() {
      const tryGet = (id) => {
        try {
          const el = document.getElementById(id);
          if (!el) return null;
          const v = el.value != null ? el.value : el.getAttribute && el.getAttribute('value');
          return v !== undefined && v !== null ? v : null;
        } catch (e) { return null; }
      };

      let tx = tryGet('bm-v'), ty = tryGet('bm-w'), pxX = tryGet('bm-x'), pxY = tryGet('bm-y');

      if (tx == null || ty == null || pxX == null || pxY == null) {
        const altTx = tryGet('bm-W'), altTy = tryGet('bm-X'), altPxX = tryGet('bm-Y'), altPxY = tryGet('bm-Z');
        if (altTx != null && altTy != null && altPxX != null && altPxY != null) {
          tx = altTx; ty = altTy; pxX = altPxX; pxY = altPxY;
        }
      }

      if (tx == null || ty == null || pxX == null || pxY == null) {
        try {
          const container = document.getElementById('bm-D');
          if (container) {
            const nums = Array.from(container.querySelectorAll('input[type="number"]')).slice(0,4);
            if (nums.length === 4) {
              tx = nums[0].value; ty = nums[1].value; pxX = nums[2].value; pxY = nums[3].value;
            }
          }
        } catch (e) {}
      }

      if (tx == null || ty == null || pxX == null || pxY == null) return null;

      function parseIntOr0Local(v) { const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : 0; }

      const tileX = parseIntOr0Local(tx || 0);
      const tileY = parseIntOr0Local(ty || 0);
      const pxx = parseIntOr0Local(pxX || 0);
      const pxy = parseIntOr0Local(pxY || 0);

      const carryX = Math.floor(pxx / TILE_SIZE);
      const carryY = Math.floor(pxy / TILE_SIZE);
      const originTileX = tileX + carryX;
      const originTileY = tileY + carryY;
      const originPxX = pxx - carryX * TILE_SIZE;
      const originPxY = pxy - carryY * TILE_SIZE;
      const globalX = originTileX * TILE_SIZE + originPxX;
      const globalY = originTileY * TILE_SIZE + originPxY;
      return { tileX: originTileX, tileY: originTileY, pxX: originPxX, pxY: originPxY, globalX, globalY };
    }

    function clearImportedImage() { importedImage = { width: 0, height: 0, data: null, originGlobalX: null, originGlobalY: null, filename: null, source: null, loading: false }; }

    // createImageBitmap + OffscreenCanvas image loader
    async function handleFileFile(file) {
      if (!file) return;
      importedImage.loading = true;
      try {
        const blob = file;
        let bitmap = null;
        try {
          bitmap = await createImageBitmap(blob);
        } catch (e) {
          bitmap = null;
        }
        let cw, ch, imd;
        if (bitmap) {
          cw = bitmap.width; ch = bitmap.height;
          if (typeof OffscreenCanvas !== 'undefined') {
            try {
              const oc = new OffscreenCanvas(cw, ch);
              const ctx = oc.getContext('2d');
              ctx.drawImage(bitmap, 0, 0);
              imd = ctx.getImageData(0, 0, cw, ch);
            } catch (e) {
              await new Promise(r => setTimeout(r, 0));
            }
          }
          if (!imd) {
            await new Promise(r => setTimeout(r, 0));
            const c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            const ctx = c.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            imd = ctx.getImageData(0, 0, cw, ch);
          }
        } else {
          const blobUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = blobUrl; });
          cw = img.naturalWidth || img.width;
          ch = img.naturalHeight || img.height;
          const c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          imd = ctx.getImageData(0, 0, cw, ch);
          URL.revokeObjectURL(blobUrl);
        }

        const origin = computeOriginFromInputs();

        importedImage.width = cw;
        importedImage.height = ch;
        importedImage.data = imd && imd.data ? imd.data : null;
        if (origin) {
          importedImage.originGlobalX = origin.globalX;
          importedImage.originGlobalY = origin.globalY;
        } else {
          importedImage.originGlobalX = null;
          importedImage.originGlobalY = null;
        }
        try { importedImage.filename = file.name || importedImage.filename || null; } catch (e) {}
        importedImage.source = 'input-file';
        pushLog({ type: 'imageLoaded', width: cw, height: ch, origin: { gx: importedImage.originGlobalX, gy: importedImage.originGlobalY }, filename: importedImage.filename, src: importedImage.source });
        showTopToast(importedImage.filename ? `已载入本地图片 ${importedImage.filename}` : '已载入本地图片', 1800);
      } catch (e) {
        clearImportedImage();
      } finally {
        importedImage.loading = false;
      }
    }

    async function fetchAndLoadUrl(url, fallbackName) {
      try {
        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) return false;
        const blob = await resp.blob();
        if (!blob || blob.size === 0) return false;
        const ext = (blob.type && blob.type.split('/')[1]) || 'png';
        const file = new File([blob], fallbackName || ('fetch.' + ext), { type: blob.type });
        await handleFileFile(file);
        return true;
      } catch (e) {
        return false;
      }
    }

    // tryExtractFileFromHiddenWrapper
    const _processedWrappers = new WeakSet();
    async function tryExtractFileFromHiddenWrapper(wrapper) {
      try {
        if (!wrapper || _processedWrappers.has(wrapper)) return;
        _processedWrappers.add(wrapper);

        const input = (wrapper.querySelector && wrapper.querySelector('input[type="file"]')) || null;
        if (input && input.files && input.files.length) {
          handleFileFile(input.files[0]);
          return;
        }

        const btn = wrapper.querySelector && wrapper.querySelector('button');
        const span = btn ? (btn.querySelector('span') || btn) : null;
        const txt = (span && (span.textContent || span.innerText) || '').trim();

        if (txt && /^[\w\-. ]+\.(png|jpe?g|webp|bmp|gif)$/i.test(txt)) {
          const filename = txt;
          const selectors = [
            `img[src*="${filename}"]`,
            `img[data-src*="${filename}"]`,
            `source[srcset*="${filename}"]`,
            `a[href*="${filename}"]`,
            `div[style*="${filename}"]`
          ];
          for (const s of selectors) {
            try {
              const el = document.querySelector(s);
              if (el) {
                let url = el.src || el.getAttribute('data-src') || el.getAttribute('href') || null;
                if (!url && el.style && el.style.backgroundImage) {
                  const m = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
                  if (m) url = m[1];
                }
                if (url) {
                  const ok = await fetchAndLoadUrl(url, filename);
                  if (ok) return;
                }
              }
            } catch (e) {}
          }

          setTimeout(async () => {
            try {
              const imgs = Array.from(document.querySelectorAll('img, source, a')).slice(0, 400);
              for (const el of imgs) {
                try {
                  const url = el.src || el.getAttribute('data-src') || el.getAttribute('href') || '';
                  if (url && url.indexOf(filename) !== -1) {
                    const ok = await fetchAndLoadUrl(url, filename);
                    if (ok) return;
                  }
                } catch (e) {}
              }
            } catch (e) {}
          }, 0);

          importedImage.filename = filename;
          importedImage.source = 'button-filename';
          pushLog({ type: 'filenameDetected', filename: filename, container: true });
          showTopToast(`检测到已选择文件 ${filename}(无法直接读取内容)`, 2600);
          return;
        }

        const previewImg = wrapper.querySelector && wrapper.querySelector('img');
        if (previewImg && previewImg.src) {
          const ok = await fetchAndLoadUrl(previewImg.src, 'preview.png');
          if (ok) return;
        }
      } catch (e) {}
    }

    // attach input listeners
    function attachInputListeners() {
      try {
        for (const fid of fileInputIds) {
          const file = $id(fid);
          if (file && file._pixelDropperListened !== true) {
            file.addEventListener('change', (ev) => {
              const f = file.files && file.files[0];
              if (f) handleFileFile(f);
            }, { passive: true });
            file._pixelDropperListened = true;
          }
        }

        try {
          const candidates = Array.from(document.querySelectorAll('input[type="file"]'));
          for (const input of candidates) {
            const idName = (input.id || '').toLowerCase();
            const nm = (input.name || '').toLowerCase();
            const cls = (input.className || '').toLowerCase();
            const parentText = (input.closest && input.closest('div') && (input.closest('div').textContent || '') || '').toLowerCase();
            const likelyBmj = idName === 'bm-j' || nm === 'bm-j' || cls.indexOf('bm-j') !== -1 || parentText.indexOf('bm-j') !== -1;
            if (likelyBmj || input._pixelDropperListened !== true) {
              if (!input._pixelDropperListened) {
                input.addEventListener('change', (ev) => {
                  const f = input.files && input.files[0];
                  if (f) handleFileFile(f);
                }, { passive: true });
                input._pixelDropperListened = true;
              }
              const wrapper = input.closest('div') || input.parentElement;
              if (wrapper) tryExtractFileFromHiddenWrapper(wrapper);
            }
          }
        } catch (e) {}

        const coordIds = ['bm-v','bm-w','bm-x','bm-y','bm-W','bm-X','bm-Y','bm-Z'];
        coordIds.forEach(id => {
          const el = $id(id);
          if (el && el._pixelDropperListened !== true) {
            el.addEventListener('input', () => {
              const origin = computeOriginFromInputs();
              if (origin && importedImage.data) {
                importedImage.originGlobalX = origin.globalX;
                importedImage.originGlobalY = origin.globalY;
                pushLog({ type: 'originUpdated', origin: { gx: importedImage.originGlobalX, gy: importedImage.originGlobalY } });
              }
            }, { passive: true });
            el._pixelDropperListened = true;
          }
        });

        try {
          const bmD = document.getElementById('bm-D');
          if (bmD) {
            const nums = Array.from(bmD.querySelectorAll('input[type="number"]')).slice(0,4);
            nums.forEach(el => {
              if (el && el._pixelDropperListened !== true) {
                el.addEventListener('input', () => {
                  const origin = computeOriginFromInputs();
                  if (origin && importedImage.data) {
                    importedImage.originGlobalX = origin.globalX;
                    importedImage.originGlobalY = origin.globalY;
                    pushLog({ type: 'originUpdated', origin: { gx: importedImage.originGlobalX, gy: importedImage.originGlobalY } });
                  }
                }, { passive: true });
                el._pixelDropperListened = true;
              }
            });
          }
        } catch (e) {}

        try {
          const originNow = computeOriginFromInputs();
          if (originNow && importedImage.data) {
            importedImage.originGlobalX = originNow.globalX;
            importedImage.originGlobalY = originNow.globalY;
            pushLog({ type: 'originAutoFilled', origin: { gx: importedImage.originGlobalX, gy: importedImage.originGlobalY } });
          }
        } catch (e) {}
      } catch (e) {}
    }

    // input mutation observer: debounce and limited scan
    let _inputObsTimer = null;
    const inputObserver = new MutationObserver((muts) => {
      try {
        if (_inputObsTimer) clearTimeout(_inputObsTimer);
        _inputObsTimer = setTimeout(() => {
          attachInputListeners();
          for (const m of muts) {
            if (m.addedNodes && m.addedNodes.length) {
              for (const n of m.addedNodes) {
                try {
                  if (n.nodeType === 1) {
                    if (n.matches && n.matches('input[type="file"]')) {
                      const wrapper = n.closest('div') || n.parentElement;
                      if (wrapper) tryExtractFileFromHiddenWrapper(wrapper);
                    } else {
                      const inputEl = n.querySelector && n.querySelector('input[type="file"]');
                      if (inputEl) {
                        const wrapper = inputEl.closest('div') || inputEl.parentElement;
                        if (wrapper) tryExtractFileFromHiddenWrapper(wrapper);
                      }
                    }
                  }
                } catch (e) {}
              }
            }
          }
        }, 120);
      } catch (e) {}
    });
    try { inputObserver.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch (e) {}
    attachInputListeners();

    // ---------- Hardcoded palette ----------
    const palette = new Map([
      [0, null],
      [1, [0,0,0]],[2, [60,60,60]],[3, [120,120,120]],[4, [210,210,210]],[5, [255,255,255]],[6, [96,0,24]],[7, [237,28,36]],[8, [255,127,39]],[9, [246,170,9]],[10, [249,221,59]],[11, [255,250,188]],[12, [14,185,104]],[13, [19,230,123]],[14, [135,255,94]],[15, [12,129,110]],[16, [16,174,166]],[17, [19,225,190]],[18, [40,80,158]],[19, [64,147,228]],[20, [96,247,242]],[21, [107,80,246]],[22, [153,177,251]],[23, [120,12,153]],[24, [170,56,185]],[25, [224,159,249]],[26, [203,0,122]],[27, [236,31,128]],[28, [243,141,169]],[29, [104,70,52]],[30, [149,104,42]],[31, [248,178,119]],[32, [170,170,170]],[33, [165,14,30]],[34, [250,128,114]],[35, [228,92,26]],[36, [214,181,148]],[37, [156,132,49]],[38, [197,173,49]],[39, [232,212,95]],[40, [74,107,58]],[41, [90,148,74]],[42, [132,197,115]],[43, [15,121,159]],[44, [187,250,242]],[45, [125,199,255]],[46, [77,49,184]],[47, [74,66,132]],[48, [122,113,196]],[49, [181,174,241]],[50, [219,164,99]],[51, [209,128,81]],[52, [255,197,165]],[53, [155,82,73]],[54, [209,128,120]],[55, [250,182,164]],[56, [123,99,82]],[57, [156,132,107]],[58, [51,57,65]],[59, [109,117,141]],[60, [179,185,209]],[61, [109,100,63]],[62, [148,140,107]],[63, [205,197,158]]
    ]);
    function rgbDistanceSq(a, b) { const dr = a[0]-b[0], dg = a[1]-b[1], db = a[2]-b[2]; return dr*dr + dg*dg + db*db; }
    function rgbToNearestColorId(rgba) {
      if (!palette.size) return null;
      const rgb = Array.isArray(rgba) ? rgba : [rgba[0], rgba[1], rgba[2]];
      let bestId = null, bestDist = Infinity;
      for (const [cid, crgb] of palette.entries()) {
        if (crgb === null) continue;
        const d = rgbDistanceSq(rgb, crgb);
        if (d < bestDist) { bestDist = d; bestId = cid; }
      }
      return bestId;
    }

    // ---------- image pixel read ----------
    function getImagePixelAtGlobalXY(gx, gy) {
      if (!importedImage.data) return null;
      if (importedImage.originGlobalX == null || importedImage.originGlobalY == null) return null;
      const relX = gx - importedImage.originGlobalX;
      const relY = gy - importedImage.originGlobalY;
      if (relX < 0 || relY < 0 || relX >= importedImage.width || relY >= importedImage.height) return null;
      const x = Math.floor(relX), y = Math.floor(relY);
      const idx = (y * importedImage.width + x) * 4;
      const data = importedImage.data;
      return [data[idx], data[idx+1], data[idx+2]];
    }

    // ---------- Robust parse & analyze ----------
    async function robustParseRequestBody({ input, init, maybeBody }) {
      try {
        let raw = null;
        if (maybeBody !== undefined) {
          try {
            if (typeof maybeBody === 'string') raw = maybeBody;
            else if (maybeBody instanceof FormData) {
              for (const e of maybeBody.entries()) { if (typeof e[1] === 'string') { raw = e[1]; break; } }
              if (!raw) {
                const pairs = [];
                for (const e of maybeBody.entries()) pairs.push(`${e[0]}=${String(e[1])}`);
                raw = pairs.slice(0,20).join('&');
              }
            } else if (maybeBody instanceof URLSearchParams) raw = maybeBody.toString();
            else if (maybeBody instanceof Blob || maybeBody instanceof ArrayBuffer || ArrayBuffer.isView(maybeBody)) {
              try { raw = await new Response(maybeBody).text(); } catch(e){ raw = null; }
            } else {
              try { raw = JSON.stringify(maybeBody); } catch(e){ raw = String(maybeBody); }
            }
          } catch (e) { raw = null; }
        } else {
          if (init && init.body != null) {
            const b = init.body;
            if (typeof b === 'string') raw = b;
            else if (b instanceof URLSearchParams) raw = b.toString();
            else if (b instanceof FormData) {
              for (const e of b.entries()) { if (typeof e[1] === 'string') { raw = e[1]; break; } }
              if (!raw) {
                const pairs = [];
                for (const e of b.entries()) pairs.push(`${e[0]}=${String(e[1])}`);
                raw = pairs.slice(0,20).join('&');
              }
            } else if (b instanceof Blob || b instanceof ArrayBuffer || ArrayBuffer.isView(b)) {
              try { raw = await new Response(b).text(); } catch(e){ raw = null; }
            } else { try { raw = JSON.stringify(b); } catch(e){ raw = null; } }
          } else if (typeof Request !== 'undefined' && input instanceof Request) {
            try { raw = await input.clone().text(); } catch(e){ raw = null; }
          }
        }
        let parsed = null;
        if (typeof raw === 'string') {
          const t = raw.trim();
          if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
            try { parsed = JSON.parse(t); } catch (e) { parsed = null; }
          }
        }
        if (!parsed && typeof raw === 'string') {
          const embedPattern = '(?:payload|data|json|body)=\\s*(\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\])';
          const embedMatch = raw.match(new RegExp(embedPattern, 'i'));
          if (embedMatch) {
            try { parsed = JSON.parse(embedMatch[1]); } catch(e){ parsed = null; }
          }
        }
        return { parsed, rawText: raw };
      } catch (e) {
        return { parsed: null, rawText: null };
      }
    }

    function parseTileFromUrl(url) {
      try {
        const pattern = '/s0/pixel/' + '(\\d+)' + '/' + '(\\d+)';
        const m = String(url).match(new RegExp(pattern, 'i'));
        if (m) return { tileX: Number(m[1]), tileY: Number(m[2]) };
      } catch (e) {}
      return null;
    }

    function normalizeCoordsToGlobal(coords, reqUrl) {
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const maxVal = coords.reduce((a,v)=>Math.max(a, Math.abs(Number(v)||0)), 0);
      if (maxVal < TILE_SIZE) {
        const tile = parseTileFromUrl(reqUrl);
        if (tile) {
          const out = [];
          for (let i = 0; i < Math.floor(coords.length/2); i++) {
            const rx = Number(coords[i*2]);
            const ry = Number(coords[i*2+1]);
            out.push(tile.tileX * TILE_SIZE + rx, tile.tileY * TILE_SIZE + ry);
          }
          return out;
        }
      }
      return coords.map(x=>Number(x));
    }

    function extractColorsCoordsFromParsed(parsed, rawText) {
      let colors = null, coords = null;
      if (parsed && typeof parsed === 'object') {
        const colorKeys = ['colors','c','color','cols','colorIds','palette','color_id','colorsList'];
        const coordKeys = ['coords','coordinates','points','pixels','coords_xy','p','pts','coordsArr','pixelsList','coordsList','xy'];
        for (const k of colorKeys) if (k in parsed) { colors = parsed[k]; break; }
        for (const k of coordKeys) if (k in parsed) { coords = parsed[k]; break; }
        if ((!coords || !colors) && Array.isArray(parsed.pixels) && parsed.pixels.length && typeof parsed.pixels[0] === 'object') {
          const arr = [], cols = [];
          for (const pt of parsed.pixels) {
            if (pt.x != null && pt.y != null) { arr.push(Number(pt.x), Number(pt.y)); if (pt.c!=null) cols.push(pt.c); else if (pt.color!=null) cols.push(pt.color); }
          }
          if (arr.length) coords = arr;
          if (cols.length && !colors) colors = cols;
        }
        if (!coords && Array.isArray(parsed.xs) && Array.isArray(parsed.ys) && parsed.xs.length === parsed.ys.length) {
          coords = [];
          for (let i=0;i<parsed.xs.length;i++) coords.push(Number(parsed.xs[i]), Number(parsed.ys[i]));
        }
      }
      if ((!coords || !colors) && typeof rawText === 'string') {
        try {
          const coordsPattern = 'coords\\s*[:=]\\s*(\\[[^\\]]+\\])';
          const coordsMatch = rawText.match(new RegExp(coordsPattern, 'i'));
          if (coordsMatch && !coords) { try { const tmp = JSON.parse(coordsMatch[1]); if (Array.isArray(tmp)) coords = tmp; } catch(e){} }
          const colorsPattern = 'colors\\s*[:=]\\s*(\\[[^\\]]+\\])';
          const colorsMatch = rawText.match(new RegExp(colorsPattern, 'i'));
          if (colorsMatch && !colors) { try { const tmp = JSON.parse(colorsMatch[1]); if (Array.isArray(tmp)) colors = tmp; } catch(e){} }
          if (!coords) {
            const nums = rawText.match(/-?\d{1,7}/g);
            if (nums && nums.length >= 2) {
              const numsN = nums.map(n=>Number(n));
              if (numsN.length % 2 === 0 && numsN.length <= 20000) coords = numsN;
            }
          }
          if (!colors) {
            const colMatch = rawText.match(new RegExp('colors\\s*[:=]\\s*([0-9,\\s\\[\\]]{1,200})', 'i'));
            if (colMatch) {
              const ns = (colMatch[1].match(/\d+/g) || []).map(Number);
              if (ns.length) colors = ns;
            }
          }
        } catch (e) {}
      }
      if (colors && !Array.isArray(colors)) {
        if (typeof colors === 'number') colors = [colors];
        else if (typeof colors === 'string') {
          const nums = colors.match(/\d+/g);
          colors = nums ? nums.map(Number) : null;
        } else try { colors = Array.from(colors); } catch(e){ colors = null; }
      }
      if (coords && !Array.isArray(coords)) {
        if (typeof coords === 'string') {
          const nums = coords.match(/-?\d+/g);
          coords = nums ? nums.map(Number) : null;
        } else try { coords = Array.from(coords); } catch(e){ coords = null; }
      }
      return { colors: Array.isArray(colors) ? colors : null, coords: Array.isArray(coords) ? coords : null };
    }

    function analyzePayloadWithRaw(parsed, rawText, reqUrl) {
      const { colors, coords } = extractColorsCoordsFromParsed(parsed, rawText);
      pushLog({ type: 'parsed_extract', url: reqUrl, foundColors: Array.isArray(colors)?colors:null, foundCoords: Array.isArray(coords)?(coords.length>40?coords.slice(0,40):coords):null });
      if (!coords || !colors) {
        return { matches: true, reason: 'no_data', payloadColors: colors, payloadCoords: coords };
      }
      const normCoords = normalizeCoordsToGlobal(coords, reqUrl);
      if (!normCoords) return { matches: true, reason: 'coords_normalize_failed', payloadColors: colors, payloadCoords: coords };
      if (!importedImage.data || importedImage.originGlobalX == null || importedImage.originGlobalY == null) {
        return { matches: true, reason: 'no_local_image', payloadColors: colors, payloadCoords: normCoords };
      }
      const result = { matches: true, mismatches: [], payloadColors: colors, payloadCoords: normCoords };
      const numPoints = Math.floor(normCoords.length / 2);
      for (let i = 0; i < numPoints; i++) {
        const gx = Number(normCoords[i*2]);
        const gy = Number(normCoords[i*2 + 1]);
        const payloadColorId = Number(colors[i] !== undefined ? colors[i] : colors[i % colors.length]);
        const imgRgb = getImagePixelAtGlobalXY(gx, gy);
        if (!imgRgb) continue;
        const expectedColorId = rgbToNearestColorId(imgRgb);
        const ok = (expectedColorId !== null && expectedColorId === payloadColorId);
        if (!ok) {
          result.matches = false;
          result.mismatches.push({ index: i, coord: [gx, gy], payloadColorId, expectedColorId, imgRgb });
        }
      }
      return result;
    }

    // ---------- Precise Offline suppression ----------
    let pendingEnforce = false;
    let pendingTimer = null;
    const TARGET_CLASS_STRING = 'btn btn-sm btn-error w-max cursor-auto text-nowrap text-xs sm:text-base';
    const TARGET_CLASSES = TARGET_CLASS_STRING.split(/\s+/).filter(Boolean);

    function nodeLooksLikeOffline(el) {
      try {
        if (!el || el.nodeType !== 1) return false;
        const cls = (el.className || '').toString().trim();
        if (!cls) return false;
        const elClasses = cls.split(/\s+/).filter(Boolean);
        const allPresent = TARGET_CLASSES.every(c => elClasses.indexOf(c) !== -1);
        if (!allPresent) return false;
        const txt = (el.textContent || '').trim();
        if (!txt) return false;
        if (!/\bOffline\b/i.test(txt)) return false;
        const hasSvg = !!el.querySelector('svg');
        if (!hasSvg) return false;
        return true;
      } catch (e) {
        return false;
      }
    }

    function removeMatchingOfflineNodes(root) {
      try {
        const searchRoot = root && root.querySelectorAll ? root : document;
        const nodes = searchRoot.querySelectorAll ? Array.from(searchRoot.querySelectorAll('*')) : [];
        for (const n of nodes) {
          try {
            if (nodeLooksLikeOffline(n)) {
              try { n.remove(); } catch (e) {}
              pushLog({ type: 'suppressed_offline_node', tag: n.tagName, class: n.className || null, text: (n.textContent || '').slice(0,200) });
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    const offlineObserver = new MutationObserver((muts) => {
      try {
        if (!pendingEnforce) return;
        for (const m of muts) {
          if (m.addedNodes && m.addedNodes.length) {
            for (const n of m.addedNodes) {
              try {
                if (n.nodeType === 1) {
                  if (nodeLooksLikeOffline(n)) {
                    try { n.remove(); } catch (e) {}
                  } else if (n.querySelectorAll) {
                    const found = n.querySelectorAll('*');
                    for (const c of found) {
                      if (nodeLooksLikeOffline(c)) try { c.remove(); } catch(e){}
                    }
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    });

    // ---------- temporary UI removal ----------
    let __pd_tempRemoved = []; // store { parent, nextSibling, node }

    function nodeMatchesTopFloating(el) {
      try {
        if (!el || el.nodeType !== 1) return false;
        const tag = el.tagName.toLowerCase();

        if (tag === 'div') {
          const cls = (el.className || '').toString().split(/\s+/).filter(Boolean);
          if (cls.length === 0) return false;
          const want = ['absolute','left-1/2','top-2','z-30','flex','-translate-x-1/2','flex-col','items-center','justify-center','gap-2'];
          if (want.every(c => cls.indexOf(c) !== -1)) return true;
        }

        if (tag === 'section') {
          const ariaLive = (el.getAttribute && el.getAttribute('aria-live')) || '';
          const cls = (el.className || '').toString().split(/\s+/).filter(Boolean);
          if (/polite/i.test(ariaLive) && cls.some(c => c.indexOf('svelte-') === 0)) return true;
        }

        return false;
      } catch (e) {
        return false;
      }
    }

    function removeTempUi() {
      try {
        if (!document || !document.body) return;

        const candidates = Array.from(document.querySelectorAll('div, section')).slice(0, 800);
        for (const n of candidates) {
          try {
            if (nodeMatchesTopFloating(n) && n.parentNode) {
              __pd_tempRemoved.push({ parent: n.parentNode, nextSibling: n.nextSibling, node: n.cloneNode(true) });
              n.remove();
              pushLog && pushLog({ type: 'temp_ui_removed', tag: n.tagName, class: n.className || null, ts: Date.now(), deep: true });
            }
          } catch (e) {}
        }

        if (!window.__pd_tempUiObserver) {
          const obs = new MutationObserver((muts) => {
            try {
              for (const m of muts) {
                if (!m.addedNodes || !m.addedNodes.length) continue;
                for (const node of m.addedNodes) {
                  try {
                    if (node.nodeType !== 1) continue;
                    if (nodeMatchesTopFloating(node) && node.parentNode) {
                      __pd_tempRemoved.push({ parent: node.parentNode, nextSibling: node.nextSibling, node: node.cloneNode(true) });
                      node.remove();
                      pushLog && pushLog({ type: 'temp_ui_removed', tag: node.tagName, class: node.className || null, ts: Date.now(), newly: true });
                    } else {
                      const found = node.querySelectorAll && node.querySelectorAll('div,section');
                      if (found && found.length) {
                        for (const f of found) {
                          try {
                            if (nodeMatchesTopFloating(f) && f.parentNode) {
                              __pd_tempRemoved.push({ parent: f.parentNode, nextSibling: f.nextSibling, node: f.cloneNode(true) });
                              f.remove();
                              pushLog && pushLog({ type: 'temp_ui_removed', tag: f.tagName, class: f.className || null, ts: Date.now(), newly: true });
                            }
                          } catch (e) {}
                        }
                      }
                    }
                  } catch (e) {}
                }
              }
            } catch (e) {}
          });
          try {
            obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
            window.__pd_tempUiObserver = obs;
            setTimeout(() => {
              try { window.__pd_tempUiObserver && window.__pd_tempUiObserver.disconnect(); window.__pd_tempUiObserver = null; } catch(e){}
            }, Math.max(PENDING_WINDOW_MS || 3500, 3500));
          } catch (e) {}
        }
      } catch (e) {}
    }

    function restoreTempUi() {
      try {
        if (!__pd_tempRemoved || !__pd_tempRemoved.length) return;
        for (const info of __pd_tempRemoved) {
          try {
            const { parent, nextSibling, node } = info;
            if (!parent) continue;
            if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(node, nextSibling);
            else parent.appendChild(node);
            pushLog && pushLog({ type: 'temp_ui_restored', tag: node.tagName, class: node.className || null, ts: Date.now() });
          } catch (e) {}
        }
      } catch (e) {}
      __pd_tempRemoved.length = 0;
    }

    function startOfflineSuppression() {
      try {
        pendingEnforce = true;
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
        pendingTimer = setTimeout(() => { pendingEnforce = false; pendingTimer = null; offlineObserver.disconnect(); restoreTempUi(); }, PENDING_WINDOW_MS);
        removeMatchingOfflineNodes(document);
        try {
          const root = document.documentElement || document.body;
          if (root) offlineObserver.observe(root, { childList: true, subtree: true });
        } catch (e) {}
      } catch (e) {}
    }

    function stopOfflineSuppression() {
      try {
        pendingEnforce = false;
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
        try { offlineObserver.disconnect(); } catch (e) {}
      } catch (e) {}
      try { restoreTempUi(); } catch (e) {}
    }

    // simulate click utility
    function realClick(selectorOrElement) {
      const el = typeof selectorOrElement === 'string' ? document.querySelector(selectorOrElement) : selectorOrElement;
      if (!el) return console.warn('未找到元素', selectorOrElement);
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
      ['mousemove','mouseover','mouseenter'].forEach(type => el.dispatchEvent(new MouseEvent(type, opts)));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      setTimeout(() => {
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
        console.log('PixelDropper: 已发送完整鼠标事件序列', el);
      }, 50);
    }

    // ---------- Intercept logic (interactive) ----------
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      let usedPending = false;
      try {
        const reqUrl = (typeof input === 'string') ? input : (input && input.url) || '';
        const method = (init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET';
        const shouldCheck = method.toUpperCase() === 'POST' && isPixelUrl(reqUrl);
        if (shouldCheck && pendingEnforce) usedPending = true;
        if (shouldCheck && usedPending) {
          const { parsed, rawText } = await robustParseRequestBody({ input, init, maybeBody: undefined });
          const analysis = analyzePayloadWithRaw(parsed, rawText, reqUrl);
          pushLog({ type: 'interactive_fetch', url: reqUrl, analysis });

          try { removeMatchingOfflineNodes(document); } catch (e) {}
          stopOfflineSuppression();

          if (analysis.matches) {
            // clear panel entries when matched
            clearPanelItems();
            showTopToast('PixelDropper: 本地图像与上报一致（未发送），已清空条目', 2200);
            console.info('pixelDropper: request matched local image — suppressed (toast).', reqUrl);
            return Promise.reject(new TypeError('Request suppressed by PixelDropper (all matched - toast)'));
          } else {
            const blocked = { url: reqUrl, payloadColors: analysis.payloadColors, payloadCoords: analysis.payloadCoords, mismatches: analysis.mismatches };
            RECENT_BLOCKS.unshift(blocked); if (RECENT_BLOCKS.length > 50) RECENT_BLOCKS.pop();
            showErrorModal(blocked);
            return Promise.reject(new TypeError('Request dropped by PixelDropper (interactive mismatch)'));
          }
        }
      } catch (e) {
        try { stopOfflineSuppression(); } catch (_) {}
      }
      return nativeFetch.apply(this, arguments);
    };

    if (navigator && typeof navigator.sendBeacon === 'function') {
      try {
        const nativeSendBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url, data) {
          try {
            if (isPixelUrl(url) && pendingEnforce) {
              (async () => {
                let parsed = null, rawText = null;
                try {
                  if (typeof data === 'string') rawText = data;
                  else if (data instanceof Blob || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) rawText = await new Response(data).text();
                  else if (data instanceof FormData) {
                    for (const pair of data.entries()) if (typeof pair[1] === 'string') { rawText = pair[1]; break; }
                    if (!rawText) {
                      const pairs = [];
                      for (const e of data.entries()) pairs.push(`${e[0]}=${String(e[1])}`);
                      rawText = pairs.slice(0,20).join('&');
                    }
                  } else {
                    try { rawText = JSON.stringify(data); } catch (e) { rawText = String(data); }
                  }
                } catch (e) { rawText = null; }
                if (rawText && looksLikeJson(rawText)) {
                  try { parsed = JSON.parse(rawText); } catch (e) { parsed = null; }
                }
                const analysis = analyzePayloadWithRaw(parsed, rawText, url);
                pushLog({ type: 'interactive_beacon', url, analysis });

                try { removeMatchingOfflineNodes(document); } catch (e) {}
                stopOfflineSuppression();
                if (analysis.matches) {
                  clearPanelItems();
                  showTopToast('PixelDropper: 本地图像与上报一致（未发送），已清空条目', 2200);
                  console.info('pixelDropper: beacon matched local image — suppressed (toast).', url);
                  return;
                } else {
                  const blocked = { url, payloadColors: analysis.payloadColors, payloadCoords: analysis.payloadCoords, mismatches: analysis.mismatches };
                  RECENT_BLOCKS.unshift(blocked); if (RECENT_BLOCKS.length > 50) RECENT_BLOCKS.pop();
                  showErrorModal(blocked);
                  return;
                }
              })();
              return false;
            }
          } catch (e) {}
          return nativeSendBeacon(url, data);
        };
      } catch (e) {}
    }

    const NativeXHR = window.XMLHttpRequest;
    function GuardedXHR() {
      const xhr = new NativeXHR();
      let _method = null, _url = null, _shouldCheck = false, _sendArgs = null;
      const origOpen = xhr.open;
      xhr.open = function (method, url) {
        try {
          _method = method ? method.toUpperCase() : 'GET';
          _url = url || '';
          _shouldCheck = _method === 'POST' && isPixelUrl(_url);
        } catch (e) {}
        return origOpen.apply(xhr, arguments);
      };
      const origSend = xhr.send;
      xhr.send = function (body) {
        _sendArgs = arguments;
        try {
          if (!_shouldCheck || !pendingEnforce) return origSend.apply(xhr, arguments);
          (async () => {
            const { parsed, rawText } = await robustParseRequestBody({ maybeBody: body });
            const analysis = analyzePayloadWithRaw(parsed, rawText, _url);
            pushLog({ type: 'interactive_xhr', url: _url, analysis });

            try { removeMatchingOfflineNodes(document); } catch (e) {}
            stopOfflineSuppression();
            if (!analysis.matches && analysis.mismatches && analysis.mismatches.length) {
              const blocked = { url: _url, payloadColors: analysis.payloadColors, payloadCoords: analysis.payloadCoords, mismatches: analysis.mismatches };
              RECENT_BLOCKS.unshift(blocked); if (RECENT_BLOCKS.length > 50) RECENT_BLOCKS.pop();
              showErrorModal(blocked);
              try {
                if (typeof xhr.onerror === 'function') xhr.onerror(new ProgressEvent('error'));
                if (typeof xhr.onloadend === 'function') xhr.onloadend(new ProgressEvent('loadend'));
                if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
              } catch (e) {}
              return;
            } else {
              // matched: clear panel entries
              clearPanelItems();
              showTopToast('PixelDropper: 本地图像与上报一致（未发送），已清空条目', 2200);
              console.info('pixelDropper: xhr matched local image — suppressed (toast).', _url);
              try {
                if (typeof xhr.onloadend === 'function') xhr.onloadend(new ProgressEvent('loadend'));
                if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
              } catch (e) {}
              return;
            }
          })();
        } catch (e) {
          try { origSend.apply(xhr, _sendArgs); } catch (_) {}
        }
      };
      return xhr;
    }
    window.XMLHttpRequest = GuardedXHR;

    // ---------- helper: check required container presence ----------
    function requiredContainerExists() {
      try {
        const outer = document.querySelector('div.rounded-t-box.bg-base-100.border-base-300.w-full.border-t.py-3');
        if (!outer) return false;
        const inner = outer.querySelector('div.relative.px-3');
        return !!inner;
      } catch (e) {
        return false;
      }
    }

    // ---------- Key handler to trigger check ----------
    function setPendingEnforceAndStartSuppression() {
      removeTempUi();
      startOfflineSuppression();
    }

    function onKey(e) {
      try {
        if (e.key === 'c' || e.key === 'C') {
          if (!requiredContainerExists()) {
            showTopToast('PixelDropper: 当前不在可检测上下文，按 C 已忽略。', 2200);
            return;
          }
          if (importedImage && importedImage.filename && !importedImage.data && importedImage.source === 'button-filename') {
            showTopToast('尝试根据文件名查找并加载图片，请稍候...', 1800);
            (async () => {
              const ok = await (async function tryLoadImageByFilenameNow(filename, timeoutMs = 2000) {
                if (!filename) return false;
                const tryFetchOnce = async (urlCandidate) => {
                  try {
                    if (!urlCandidate) return false;
                    return await fetchAndLoadUrl(urlCandidate, filename);
                  } catch (e) { return false; }
                };
                const quickSelectors = [
                  `img[src*="${filename}"]`,
                  `img[data-src*="${filename}"]`,
                  `source[srcset*="${filename}"]`,
                  `a[href*="${filename}"]`,
                  `div[style*="${filename}"]`
                ];
                for (const s of quickSelectors) {
                  try {
                    const el = document.querySelector(s);
                    if (el) {
                      const url = el.src || el.getAttribute('data-src') || el.getAttribute('href') || null;
                      if (url) {
                        const ok = await tryFetchOnce(url);
                        if (ok) return true;
                      }
                    }
                  } catch (e) {}
                }
                let resolved = false, result = false;
                const worker = (async () => {
                  try {
                    const nodes = Array.from(document.querySelectorAll('img, source, a')).slice(0, 300);
                    for (const el of nodes) {
                      try {
                        const url = el.src || el.getAttribute('data-src') || el.getAttribute('href') || '';
                        if (url && url.indexOf(filename) !== -1) {
                          const ok = await tryFetchOnce(url);
                          if (ok) { resolved = true; result = true; return; }
                        }
                      } catch (e) {}
                    }
                  } catch (e) {}
                })();
                await Promise.race([ worker, new Promise(r => setTimeout(r, timeoutMs)) ]);
                return !!result;
              })(importedImage.filename, 2000);
              if (!ok) {
                showTopToast('未能读取图片内容，按 C 已取消。请使用文件输入上传或等待页面预览可用。', 2800);
                return;
              }
              if (importedImage.loading) {
                showTopToast('图片正在加载，请稍候再按 C。', 2000);
                return;
              }
              const btn = document.querySelector('button.btn.btn-primary') || document.querySelector('[data-paint]') || document.querySelector('.paint-button');
              if (btn) {
                setPendingEnforceAndStartSuppression();
                removeMatchingOfflineNodes(document);
                realClick(btn);
              } else {
                showTopToast('未找到 paint 按钮，无法执行检测。', 2200);
              }
            })();
            return;
          }

          if (importedImage && importedImage.loading) {
            showTopToast('图片正在加载，请稍候再按 C。', 2200);
            return;
          }

          const btn = document.querySelector('button.btn.btn-primary') || document.querySelector('[data-paint]') || document.querySelector('.paint-button');
          if (btn) {
            setPendingEnforceAndStartSuppression();
            removeMatchingOfflineNodes(document);
            realClick(btn);
          } else {
            showTopToast('未找到 paint 按钮，无法执行检测。', 2200);
          }
        }
      } catch (ex) {}
    }
    try { document.addEventListener('keydown', onKey, { passive: true }); } catch (e) {}

    // ---------- Monitor: file import handling ----------
    (function monitorBmJImport() {
      try {
        const seen = new WeakSet();

        function handleInputElement(input) {
          try {
            if (!input || seen.has(input)) return;
            seen.add(input);

            const onChange = (ev) => {
              try {
                const f = input.files && input.files[0];
                if (!f) return;
                try { if (typeof importedImage === 'object') importedImage.loading = true; } catch (e) {}
                try {
                  if (typeof handleFileFile === 'function') {
                    handleFileFile(f);
                  } else {
                    const reader = new FileReader();
                    reader.onload = () => {
                      try {
                        if (typeof importedImage === 'object') {
                          importedImage.filename = f.name || importedImage.filename || null;
                          importedImage.source = 'input-file';
                          importedImage.loading = false;
                        }
                        pushLog && pushLog({ type: 'bmj_change_recorded', filename: f.name });
                        showTopToast && showTopToast(importedImage.filename ? `已载入本地图片 ${importedImage.filename}` : '已载入本地图片', 1400);
                      } catch (e) {}
                    };
                    reader.readAsArrayBuffer(f);
                  }
                } catch (e) {
                  try { if (typeof importedImage === 'object') importedImage.loading = false; } catch(_) {}
                }
              } catch (e) {}
            };

            input.addEventListener('change', onChange, { passive: true });
            input.addEventListener('input', onChange, { passive: true });
          } catch (e) {}
        }

        try {
          const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
          for (const inp of inputs) handleInputElement(inp);
        } catch (e) {}

        const mo = new MutationObserver((muts) => {
          try {
            for (const m of muts) {
              if (!m.addedNodes || !m.addedNodes.length) continue;
              for (const node of m.addedNodes) {
                try {
                  if (node.nodeType !== 1) continue;
                  if (node.matches && node.matches('input[type="file"]')) {
                    handleInputElement(node);
                  } else {
                    const found = node.querySelector && node.querySelector('input[type="file"]');
                    if (found) handleInputElement(found);
                  }
                } catch (e) {}
              }
            }
          } catch (e) {}
        });
        try { mo.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch (e) {}
      } catch (e) {}
    })();

    // ---------- Public runtime API ----------
    try {
      Object.defineProperty(window, '__pixelDropper', {
        value: {
          setAllowedColorIds(arr) { allowedColorIds = new Set((arr || []).map(x => Number(x))); console.info('pixelDropper allowedColorIds=', Array.from(allowedColorIds)); },
          addAllowedColorId(id) { allowedColorIds.add(Number(id)); console.info('added', id); },
          removeAllowedColorId(id) { allowedColorIds.delete(Number(id)); console.info('removed', id); },
          enable() { enforceDrop = true; console.info('pixelDropper enabled'); },
          disable() { enforceDrop = false; console.info('pixelDropper disabled (only logs)'); },
          isEnabled() { return enforceDrop; },
          getLog() { return LOG.slice(); },
          getRecentBlocks() { return RECENT_BLOCKS.slice(); },
          clearLog() { LOG.length = 0; RECENT_BLOCKS.length = 0; },
          uninstall() {
            try { window.fetch = nativeFetch; } catch (e) {}
            try { window.XMLHttpRequest = NativeXHR; } catch (e) {}
            try { hideCustomModal(); } catch (e) {}
            try { offlineObserver.disconnect(); } catch(e){}
            console.info('pixelDropper uninstalled');
          },
          triggerCheckNow(selector) {
            try {
              if (!requiredContainerExists()) {
                showTopToast('PixelDropper: 当前不在可检测上下文，trigger 已忽略。', 2200);
                return;
              }
              const el = selector ? (typeof selector === 'string' ? document.querySelector(selector) : selector) : document.querySelector('button.btn.btn-primary');
              if (!el) return console.warn('未找到 paint 按钮');
              setPendingEnforceAndStartSuppression();
              realClick(el);
            } catch (e) {}
          },
          setImageClear() { clearImportedImage(); console.info('pixelDropper: image cleared'); },
          refreshPalette() { pushLog({ type: 'paletteRefreshed', size: palette.size }); },
          getImportedImageInfo() { return { width: importedImage.width, height: importedImage.height, originGlobalX: importedImage.originGlobalX, originGlobalY: importedImage.originGlobalY, filename: importedImage.filename, source: importedImage.source, loading: importedImage.loading }; },
          getPalette() { return Array.from(palette.entries()); }
        },
        writable: false, configurable: true, enumerable: false
      });
    } catch (e) {}

  } catch (e) {
    console.error('pixelDropper injection error', e);
  }
}

// end injected function

  function inject(fn) {
    try {
      const script = document.createElement('script');
      script.setAttribute('type', 'text/javascript');
      script.textContent = '(' + fn.toString() + ')();';
      const target = document.documentElement || document.head || document.body;
      if (target) {
        target.prepend(script);
        script.parentNode && script.parentNode.removeChild(script);
      }
    } catch (e) {
      console.error('inject error', e);
    }
  }

  inject(injectedPixelDropper);

  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('PixelDropper: Toggle enforcement', () => {
        try { window.__pixelDropper && (window.__pixelDropper.isEnabled() ? window.__pixelDropper.disable() : window.__pixelDropper.enable()); } catch(e){}
        alert('PixelDropper toggle requested; see console for status.');
      });
      GM_registerMenuCommand('PixelDropper: Add allowed color id', () => {
        const v = prompt('Enter color id to allow (number):');
        const n = Number(v);
        if (!Number.isNaN(n)) { try { window.__pixelDropper && window.__pixelDropper.addAllowedColorId(n); } catch(e){} alert('Requested add ' + n); }
      });
      GM_registerMenuCommand('PixelDropper: Show recent blocks', () => { try { console.log('Recent blocks:', window.__pixelDropper && window.__pixelDropper.getRecentBlocks()); } catch(e){} alert('Recent blocks logged to console'); });
    }
  } catch (e) { /* ignore */ }

})();
