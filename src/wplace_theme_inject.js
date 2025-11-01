// wplace_theme_inject.js
(function(){
  try {
    const THEME_KEY = 'theme';
    const RESTORE_INTERVAL_MS = 3000;
    const VISIBILITY_CHECK = true;

    // keep originals
    const __orig_set = Storage.prototype.setItem;
    const __orig_remove = Storage.prototype.removeItem;
    const __orig_clear = Storage.prototype.clear;

    // internal short-lived token used to allow controlled writes
    let lastAllowedToken = null;

    function allowWriteForToken(token) {
      lastAllowedToken = String(token);
      // clear token soon after to reduce window of acceptance
      setTimeout(() => { lastAllowedToken = null; }, 120);
    }

    function tokenMatches(provided){
      try { return provided && lastAllowedToken && String(provided) === String(lastAllowedToken); } catch(e){ return false; }
    }

    // override setItem: only allow writes to THEME_KEY when token matches; others pass through
    Storage.prototype.setItem = function(key, value){
      try {
        if (String(key) === THEME_KEY) {
          const provided = window.__wplace_inbound_token;
          if (tokenMatches(provided)) {
            // consume token immediately
            try { window.__wplace_inbound_token = null; lastAllowedToken = null; } catch(e){}
            return __orig_set.call(this, key, String(value));
          }
          // block un-authorized writes to theme
          return;
        }
      } catch(e){}
      return __orig_set.apply(this, arguments);
    };

    // override removeItem: block removal of THEME_KEY
    Storage.prototype.removeItem = function(key){
      try {
        if (String(key) === THEME_KEY) return;
      } catch(e){}
      return __orig_remove.apply(this, arguments);
    };

    // override clear: preserve theme
    Storage.prototype.clear = function(){
      try {
        const saved = this.getItem(THEME_KEY);
        __orig_clear.apply(this, arguments);
        if (saved !== null) {
          try { __orig_set.call(this, THEME_KEY, saved); } catch(e){}
        }
        return;
      } catch(e){}
      return __orig_clear.apply(this, arguments);
    };

    // define property accessor on window.localStorage.theme for parity
    try {
      Object.defineProperty(window.localStorage, 'theme', {
        configurable: true,
        enumerable: true,
        get: function(){ return this.getItem(THEME_KEY); },
        set: function(v){
          try {
            const provided = window.__wplace_inbound_token;
            if (tokenMatches(provided)) {
              window.__wplace_inbound_token = null;
              lastAllowedToken = null;
              return __orig_set.call(this, THEME_KEY, String(v));
            }
          } catch(e){}
        }
      });
    } catch(e){}

    // periodic restore when visible (defensive)
    setInterval(() => {
      try {
        if (VISIBILITY_CHECK && document.visibilityState !== 'visible') return;
        const desired = window.__wplace_desired_theme; // content script may set this for desired value
        if (typeof desired === 'string') {
          const cur = localStorage.getItem(THEME_KEY);
          if (cur !== desired) {
            // write using token flow
            const tok = Math.random().toString(36).slice(2);
            allowWriteForToken(tok);
            try {
              // expose inbound token for the overridden setItem to validate
              window.__wplace_inbound_token = tok;
              localStorage.setItem(THEME_KEY, desired);
              window.__wplace_inbound_token = null;
              lastAllowedToken = null;
            } catch(e) { window.__wplace_inbound_token = null; lastAllowedToken = null; }
          }
        }
      } catch(e){}
    }, RESTORE_INTERVAL_MS);

    // handle postMessage from content script: SET_THEME requests
    window.addEventListener('message', (ev) => {
      try {
        const m = ev && ev.data;
        if (!m || typeof m !== 'object') return;
        if (m.__wplace_msg === 'SET_THEME' && 'value' in m && 'token' in m) {
          // content script sets window.__wplace_outbound_token then posts the message with token
          // validate token equality with that outbound token
          try {
            const outbound = window.__wplace_outbound_token || null;
            if (m.token && outbound && String(m.token) === String(outbound)) {
              // accept: set desired theme, and perform tokened write
              window.__wplace_desired_theme = String(m.value);
              // allow a short token
              allowWriteForToken(m.token);
              try { window.__wplace_inbound_token = m.token; localStorage.setItem(THEME_KEY, String(m.value)); } catch(e){}
              window.__wplace_inbound_token = null;
              lastAllowedToken = null;
              // respond to content script that op done
              try { window.postMessage({ __wplace_resp: 'SET_THEME_DONE', token: m.token }, '*'); } catch(e){}
              // remove outbound token marker
              try { delete window.__wplace_outbound_token; } catch(e){}
            } else {
              // token mismatch: ignore
            }
          } catch(e){}
        }
      } catch(e){}
    }, false);

    // initial enforcement: if no desired value set, read current theme and set as desired
    try {
      const cur = localStorage.getItem(THEME_KEY);
      if (typeof cur === 'string' && cur.length > 0) window.__wplace_desired_theme = cur;
    } catch(e){}

    // make a small helper flag so content script can check readiness
    try { window.__wplace_theme_lock_ready = true; } catch(e){}

  } catch(err){
    // fail silently
  }
})();
