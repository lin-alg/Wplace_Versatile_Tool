// injected_style_patch.js
(function(){
  if (window.__WPLACE_STYLE_PATCH_INJECTED) return;
  window.__WPLACE_STYLE_PATCH_INJECTED = true;

  // 默认配置（page-context 可读）
  window.__WPLACE_STYLE_PATCH_CONFIG = {
    stripRoads: true,
    stripNames: true,
    targetPrefix: 'https://maps.wplace.live/styles/liberty'
  };

  // 安全读写助手
  function getCfg() { return window.__WPLACE_STYLE_PATCH_CONFIG || { stripRoads:true, stripNames:true, targetPrefix:'https://maps.wplace.live/styles/liberty' }; }
  function setCfg(partial) {
    try {
      const cur = getCfg();
      window.__WPLACE_STYLE_PATCH_CONFIG = Object.assign({}, cur, partial || {});
    } catch (e) {}
  }

  // 监听外部消息以动态开关（content script -> page postMessage）
  window.addEventListener('message', (ev) => {
    try {
      const m = ev && ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.__wplace_style_patch === 'SET_CONFIG') {
        // 仅接受符合字段的更新
        const update = {};
        if ('stripRoads' in m) update.stripRoads = !!m.stripRoads;
        if ('stripNames' in m) update.stripNames = !!m.stripNames;
        if ('targetPrefix' in m && typeof m.targetPrefix === 'string') update.targetPrefix = m.targetPrefix;
        setCfg(update);
        // 回应以便 sender 知晓
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

  // strip 根据当前配置决定要删哪些图层
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

  // ---------- fetch override ----------
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const url = (typeof input === 'string') ? input : input && input.url;
      const cfg = getCfg();
      if (typeof url === 'string' && url.startsWith(cfg.targetPrefix) && (!init || (init.method || 'GET').toUpperCase() === 'GET')) {
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
        const cfg = getCfg();
        if (url.startsWith(cfg.targetPrefix) && method === 'GET') {
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
