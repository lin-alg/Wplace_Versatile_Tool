// content_boot.js  -- runs at document_start
(function(){
  try {
    if (document.getElementById('__wplace_theme_inject_script')) return;
    const s = document.createElement('script');
    s.id = '__wplace_theme_inject_script';
    s.src = chrome.runtime.getURL('wplace_theme_inject.js');
    const target = document.documentElement || document.head || document;
    target.insertBefore(s, target.firstChild);
  } catch(e){}
})();
