// content_boot.js  -- runs at document_start
(function(){
  try {
    const rootTarget = document.documentElement || document.head || document;

    // inject theme script (existing behavior, id-based dedupe)
    try {
      if (!document.getElementById('__wplace_theme_inject_script')) {
        const sTheme = document.createElement('script');
        sTheme.id = '__wplace_theme_inject_script';
        sTheme.src = chrome.runtime.getURL('wplace_theme_inject.js');
        // insert near the front so it runs early
        try { rootTarget.insertBefore(sTheme, rootTarget.firstChild); } catch (e) { (document.head||document.documentElement||document).appendChild(sTheme); }
      }
    } catch (e) { /* keep silent */ }

    // inject style patch script into page context (to override fetch/XHR)
    try {
      if (!document.getElementById('__wplace_style_patch_inject')) {
        const sPatch = document.createElement('script');
        sPatch.id = '__wplace_style_patch_inject';
        sPatch.src = chrome.runtime.getURL('injected_style_patch.js');
        sPatch.type = 'text/javascript';
        sPatch.async = false;
        // place the patch script after theme script where possible
        try {
          const themeEl = document.getElementById('__wplace_theme_inject_script');
          if (themeEl && themeEl.parentNode) themeEl.parentNode.insertBefore(sPatch, themeEl.nextSibling);
          else rootTarget.insertBefore(sPatch, rootTarget.firstChild);
        } catch (e) {
          try { (document.head||document.documentElement||document).appendChild(sPatch); } catch (e2) {}
        }
      }
    } catch (e) { /* keep silent */ }

  } catch(e){}
})();
