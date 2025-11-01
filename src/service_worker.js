// service_worker.js
let latestMatchingUrl = null;
let latestFourCoords = null;

chrome.webRequest.onCompleted.addListener(
  details => {
    try {
      const url = new URL(details.url);
      if (url.hostname === "backend.wplace.live" && url.pathname.includes("/s0/pixel/")) {
        const parts = url.pathname.split("/");
        if (parts.length >= 5) {
          const tlx = parts[3];
          const tly = parts[4];
          const x = url.searchParams.get("x");
          const y = url.searchParams.get("y");
          if (tlx && tly && x && y) {
            latestMatchingUrl = details.url;
            latestFourCoords = `${tlx}, ${tly}, ${x}, ${y}`;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  },
  { urls: ["https://backend.wplace.live/*"] }
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "WPLACE_GET_LATEST") {
    sendResponse({ coords: latestFourCoords, url: latestMatchingUrl });
  }
  return true;
});
