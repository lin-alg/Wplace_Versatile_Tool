// injected_style_patch.js
(function(){
  if (window.__WPLACE_STYLE_PATCH_INJECTED) return;
  window.__WPLACE_STYLE_PATCH_INJECTED = true;

  // 默认配置（page-context 可读）
  window.__WPLACE_STYLE_PATCH_CONFIG = {
    stripRoads: true,
    stripNames: true,
    // 支持多个目标前缀。既保留字符串也支持数组。
    targetPrefixes: [
      'https://maps.wplace.live/styles/liberty',
      'https://maps.wplace.live/styles/fiord'
    ]
  };

  // 安全读写助手
  function getCfg() { return window.__WPLACE_STYLE_PATCH_CONFIG || { stripRoads:true, stripNames:true, targetPrefixes:['https://maps.wplace.live/styles/liberty','https://maps.wplace.live/styles/fiord'] }; }
  function setCfg(partial) {
    try {
      const cur = getCfg();
      // 允许部分更新：如果传入 targetPrefix（旧名）则兼容地合并到 targetPrefixes
      const out = Object.assign({}, cur, partial || {});
      if (partial && typeof partial.targetPrefix === 'string' && (!out.targetPrefixes || !Array.isArray(out.targetPrefixes))) {
        out.targetPrefixes = [partial.targetPrefix];
      } else if (partial && typeof partial.targetPrefix === 'string' && Array.isArray(out.targetPrefixes) && out.targetPrefixes.indexOf(partial.targetPrefix) === -1) {
        out.targetPrefixes = out.targetPrefixes.concat([partial.targetPrefix]);
      }
      window.__WPLACE_STYLE_PATCH_CONFIG = out;
    } catch (e) {}
  }

  // 监听外部消息以动态开关（content script -> page postMessage）
  window.addEventListener('message', (ev) => {
    try {
      const m = ev && ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.__wplace_style_patch === 'SET_CONFIG') {
        const update = {};
        if ('stripRoads' in m) update.stripRoads = !!m.stripRoads;
        if ('stripNames' in m) update.stripNames = !!m.stripNames;
        if ('targetPrefix' in m && typeof m.targetPrefix === 'string') {
          // 兼容旧键：合并到数组
          const cur = getCfg();
          const arr = Array.isArray(cur.targetPrefixes) ? cur.targetPrefixes.slice() : [];
          if (arr.indexOf(m.targetPrefix) === -1) arr.push(m.targetPrefix);
          update.targetPrefixes = arr;
        }
        if ('targetPrefixes' in m && Array.isArray(m.targetPrefixes)) {
          update.targetPrefixes = m.targetPrefixes.slice();
        }
        setCfg(update);
        try { window.postMessage({ __wplace_style_patch: 'CONFIG_UPDATED', config: getCfg() }, '*'); } catch(e){}
      }
    } catch (e) {}
  });

  // ---------- layer classifiers ----------
  function isRoadLayer(layer) {
    if (!layer || typeof layer !== 'object') return false;
    const srcLayer = layer['source-layer'];
    if (typeof srcLayer === 'string') {
      const s = srcLayer.toLowerCase();
      if (s === 'transportation' || s === 'transportation_name' || s.startsWith('transportation')) return true;
    }
    const id = (layer.id || '').toLowerCase();
    if (/\b(road|road_|road-|roadarea|highway|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|link|ramp|path|pedestrian|track|service|rail|transit|one_way|one-way|oneway|road_shield|shield|highway-name|highway-shield)\b/i.test(id)) {
      return true;
    }
    if (layer.type === 'symbol' && layer['source-layer'] && /transportation_name|transportation/.test(layer['source-layer'])) return true;
    if (layer.type === 'symbol' && layer.layout) {
      const lp = layer.layout['symbol-placement'];
      if (lp === 'line') return true;
      const icon = layer.layout['icon-image'];
      if (typeof icon === 'string' && /arrow|shield|road_|motorway|oneway|one_way/.test(icon)) return true;
    }
    if (layer.source && typeof layer.source === 'string' && layer.source.toLowerCase().includes('openmaptiles') && id.includes('transportation')) return true;
    return false;
  }

  function isNameLayer(layer) {
    if (!layer || typeof layer !== 'object') return false;
    const nameSourceLayers = new Set(['place','transportation_name','water_name','waterway','poi','aerodrome_label','aeroway']);
    if (layer['source-layer'] && nameSourceLayers.has(layer['source-layer'])) return true;
    const id = (layer.id || '').toLowerCase();
    if (/\b(label|name|poi|water_name|water_name_line|water_name_point|airport|aerodrome|highway-name|highway-shield|road_shield|shield)\b/i.test(id)) {
      return true;
    }
    if (layer.type === 'symbol' && layer.layout && ('text-field' in layer.layout)) return true;
    return false;
  }

  function stripLayersByConfig(styleJson) {
    if (!styleJson || !Array.isArray(styleJson.layers)) return styleJson;
    const cfg = getCfg();
    let kept = styleJson.layers;
    if (cfg.stripRoads) kept = kept.filter(layer => !isRoadLayer(layer));
    if (cfg.stripNames) kept = kept.filter(layer => !isNameLayer(layer));
    return Object.assign({}, styleJson, { layers: kept });
  }

  function cloneHeaders(h) {
    try {
      const nh = new Headers();
      for (const [k, v] of h.entries()) nh.set(k, v);
      return nh;
    } catch (e) {
      return new Headers({ 'content-type': 'application/json' });
    }
  }

  // helper: 判断 URL 是否命中配置的任一前缀
  function urlMatchesTarget(url) {
    try {
      if (!url || typeof url !== 'string') return false;
      const cfg = getCfg();
      const prefixes = Array.isArray(cfg.targetPrefixes) ? cfg.targetPrefixes : (cfg.targetPrefixes ? [cfg.targetPrefixes] : []);
      // 允许旧的 targetPrefix 字段兼容
      if (cfg.targetPrefix && typeof cfg.targetPrefix === 'string' && prefixes.indexOf(cfg.targetPrefix) === -1) prefixes.push(cfg.targetPrefix);
      for (const p of prefixes) {
        try {
          if (!p) continue;
          if (url.indexOf(p) === 0) return true;
        } catch(_) {}
      }
      return false;
    } catch (e) { return false; }
  }

  // ---------- fetch override ----------
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const url = (typeof input === 'string') ? input : input && input.url;
        if (urlMatchesTarget(typeof url === 'string' ? url : '')) {
        const resp = await originalFetch.apply(this, arguments);
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json') || contentType.includes('application/vnd.mapbox.style+json') || contentType.includes('text/json')) {
          const cloned = resp.clone();
          let json;
          try { json = await cloned.json(); } catch (e) { return resp; }
          const modified = stripLayersByConfig(json);
          const body = JSON.stringify(modified);
          const headers = cloneHeaders(resp.headers);
          return new Response(body, { status: resp.status, statusText: resp.statusText, headers: headers });
        }
        return resp;
      }
    } catch (e) {
      return originalFetch.apply(this, arguments);
    }
    return originalFetch.apply(this, arguments);
  };

  // ---------- XHR override ----------
  (function(){
    const XHRProto = XMLHttpRequest.prototype;
    const origOpen = XHRProto.open;
    const origSend = XHRProto.send;

    XHRProto.open = function(method, url) {
      this.__intercept_url = (typeof url === 'string') ? url : (url && url.toString && url.toString());
      this.__intercept_method = (method || 'GET').toUpperCase();
      return origOpen.apply(this, arguments);
    };

    XHRProto.send = function(body) {
      try {
        const url = this.__intercept_url || '';
        const method = this.__intercept_method || 'GET';
        if (urlMatchesTarget(url) && method === 'GET') {
          const xhr = this;
          (async () => {
            try {
              const resp = await window.fetch(url, { method: 'GET', credentials: 'same-origin' });
              const contentType = resp.headers.get('content-type') || '';
              if (contentType.includes('application/json') || contentType.includes('application/vnd.mapbox.style+json') || contentType.includes('text/json')) {
                const json = await resp.json();
                const modified = stripLayersByConfig(json);
                const text = JSON.stringify(modified);

                Object.defineProperty(xhr, 'responseText', { writable: true });
                Object.defineProperty(xhr, 'response', { writable: true });
                xhr.status = resp.status;
                xhr.statusText = resp.statusText || '';
                xhr.readyState = 4;
                xhr.responseText = text;
                xhr.response = text;
                if (typeof xhr.onreadystatechange === 'function') try { xhr.onreadystatechange(); } catch(e){}
                try { xhr.dispatchEvent(new Event('load')); } catch(e){}
                try { xhr.dispatchEvent(new Event('loadend')); } catch(e){}
                return;
              } else {
                const text = await resp.text();
                Object.defineProperty(xhr, 'responseText', { writable: true });
                Object.defineProperty(xhr, 'response', { writable: true });
                xhr.status = resp.status;
                xhr.statusText = resp.statusText || '';
                xhr.readyState = 4;
                xhr.responseText = text;
                xhr.response = text;
                if (typeof xhr.onreadystatechange === 'function') try { xhr.onreadystatechange(); } catch(e){}
                try { xhr.dispatchEvent(new Event('load')); } catch(e){}
                try { xhr.dispatchEvent(new Event('loadend')); } catch(e){}
                return;
              }
            } catch (err) {
              xhr.readyState = 4;
              xhr.status = 0;
              if (typeof xhr.onerror === 'function') try { xhr.onerror(err); } catch(e){}
              try { xhr.dispatchEvent(new Event('error')); } catch(e){}
              try { xhr.dispatchEvent(new Event('loadend')); } catch(e){}
              return;
            }
          })();
          return;
        }
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  })();

})();

(async function applyConfigOnLoad() {
  try {
    // 读取配置（优先 chrome.storage.local 回退到 window 全局）
    async function readConfig() {
      const def = { stripRoads: true, stripNames: true, targetPrefixes: ['https://maps.wplace.live/styles/liberty','https://maps.wplace.live/styles/fiord'] };
      try {
        if (window.chrome && chrome.storage && chrome.storage.local) {
          const res = await new Promise(resolve => chrome.storage.local.get(['wplace_map_style_cfg_v2','__WPLACE_STYLE_PATCH_CONFIG','wplace_style_patch_cfg'], resolve)).catch(()=>null);
          // 支持多种 key 名
          const keys = res || {};
          let cfg = keys.wplace_map_style_cfg_v2 || keys.__WPLACE_STYLE_PATCH_CONFIG || keys.wplace_style_patch_cfg || null;
          if (cfg) return Object.assign({}, def, cfg);
        }
      } catch (e) {}
      try {
        if (window.__WPLACE_STYLE_PATCH_CONFIG) return Object.assign({}, def, window.__WPLACE_STYLE_PATCH_CONFIG);
      } catch (e) {}
      return def;
    }

    const cfg = await readConfig();

    // helper: 构造 style.json URL（从 prefix 推断）
    function styleJsonUrlFromPrefix(p) {
      try {
        if (!p) return null;
        if (/\/style\.json($|\?)/i.test(p)) return p;
        if (p.endsWith('/')) return p + 'style.json';
        return p + (p.includes('?') ? '&' : '/') + 'style.json';
      } catch (e) { return null; }
    }

    // cache-bust
    function bust(u) {
      try { const U = new URL(u, location.href); U.searchParams.set('_wplace_bust', Date.now().toString(36)); return U.toString(); } catch (e) {
        return u + (u.indexOf('?') === -1 ? '?' : '&') + '_wplace_bust=' + Date.now().toString(36);
      }
    }

    // safe fetch JSON
    async function fetchJson(u) {
      try {
        const r = await fetch(u, { cache: 'no-store', credentials: 'same-origin' });
        if (!r || !r.ok) return null;
        return await r.json().catch(()=>null);
      } catch (e) { return null; }
    }

    // 尝试找到 maplibre/mapbox 实例集合
    function findMapInstances() {
      const maps = new Set();
      try {
        if (window.map && typeof window.map.setStyle === 'function') maps.add(window.map);
        if (window.mapboxMap && typeof window.mapboxMap.setStyle === 'function') maps.add(window.mapboxMap);
      } catch (e) {}
      try {
        for (const k in window) {
          try {
            const v = window[k];
            if (v && typeof v === 'object' && typeof v.setStyle === 'function' && typeof v.getStyle === 'function') maps.add(v);
          } catch (e) {}
        }
      } catch (e) {}
      // DOM 搜索候选 canvas 元素并从其父节点尝试读取引用字段
      try {
        const canv = Array.from(document.querySelectorAll('.mapboxgl-canvas, .maplibregl-canvas, canvas')).slice(0, 30);
        for (const c of canv) {
          let root = c;
          for (let i=0;i<6 && root;i++) {
            root = root.parentElement;
            if (!root) break;
            for (const prop of ['__map','__mapbox','__maplibregl_map','__mapbox_map','map','_map']) {
              try {
                const maybe = root[prop];
                if (maybe && typeof maybe.setStyle === 'function') maps.add(maybe);
              } catch(e){}
            }
          }
        }
      } catch(e){}
      return Array.from(maps);
    }

    // 用已存在的 stripLayersByConfig（assume 在脚本中定义）处理 style 对象
    function applyStripToStyle(styleObj, conf) {
      try {
        // 如果原脚本内定义 stripLayersByConfig，则直接调用；否则做最小过滤（保守返回原样）
        if (typeof window.__WPLACE_INTERNAL_stripLayersByConfig === 'function') {
          return window.__WPLACE_INTERNAL_stripLayersByConfig(styleObj, conf);
        }
        // 可能本脚本中有 stripLayersByConfig 函数（同一文件内），尝试调用
        if (typeof stripLayersByConfig === 'function') {
          // 由于 stripLayersByConfig 读取 window config，本处临时替换全局 config 再执行以确保按传入 conf 处理
          const prev = window.__WPLACE_STYLE_PATCH_CONFIG;
          try { window.__WPLACE_STYLE_PATCH_CONFIG = Object.assign({}, window.__WPLACE_STYLE_PATCH_CONFIG || {}, conf || {}); return stripLayersByConfig(styleObj); } finally { window.__WPLACE_STYLE_PATCH_CONFIG = prev; }
        }
      } catch (e) {}
      return styleObj;
    }

    // 如果没有内部暴露的 stripLayersByConfig，那么直接使用同文件中的实现（重用）
    // 为兼容性，将内部函数引用赋给窗口（仅当存在时）
    try { if (typeof stripLayersByConfig === 'function' && !window.__WPLACE_INTERNAL_stripLayersByConfig) window.__WPLACE_INTERNAL_stripLayersByConfig = function(s, c){ const prev=window.__WPLACE_STYLE_PATCH_CONFIG; try{ window.__WPLACE_STYLE_PATCH_CONFIG = Object.assign({}, prev||{}, c||{}); return stripLayersByConfig(s);}finally{ window.__WPLACE_STYLE_PATCH_CONFIG = prev; }}; } catch(e){}

    // 主流程：对每个 prefix fetch style.json（带 bust），将处理后的 style 应用于每个 map 实例
    const prefixes = Array.isArray(cfg.targetPrefixes) && cfg.targetPrefixes.length ? cfg.targetPrefixes.slice() : (cfg.targetPrefix ? [cfg.targetPrefix] : []);
    if (!prefixes.length) prefixes.push('https://maps.wplace.live/styles/liberty','https://maps.wplace.live/styles/fiord');

    const mapInstances = findMapInstances();

    for (const p of prefixes) {
      try {
        const sx = styleJsonUrlFromPrefix(p);
        if (!sx) continue;
        const json = await fetchJson(bust(sx));
        if (!json) continue;
        // 以当前 cfg 处理一次（以便被篡改过的 fetch override 也能返回正确结果）
        const processed = applyStripToStyle(json, { stripRoads: !!cfg.stripRoads, stripNames: !!cfg.stripNames, targetPrefixes: cfg.targetPrefixes });
        // 先尝试用 url 重新 setStyle（某些 map 实例更喜欢 URL -> 会重新走 fetch/XHR 掉入你的拦截器）
        for (const m of mapInstances) {
          try {
            // 如果 map 支持 setStyle(object) 则优先直接传入对象（可避免二次网络请求）
            if (typeof m.setStyle === 'function') {
              try {
                m.setStyle(processed);
              } catch (e) {
                // fallback: try setStyle with busted url so map triggers its own fetch
                try { m.setStyle(bust(sx)); } catch(e2){}
              }
            }
          } catch (e) {}
        }
        // 如果没有 map 实例，至少做一次 fetch（已完成）以更新浏览器缓存 / service worker 缓存
      } catch (e) {}
    }

    // 最后：向 page-context 广播已应用（可被其他脚本监听）
    try { window.postMessage({ __wplace_style_patch: 'APPLIED_ON_LOAD', config: cfg }, '*'); } catch(e){}
  } catch (err) {
    try { console.warn('WPLACE applyConfigOnLoad failed', err); } catch(e){}
  }
})();