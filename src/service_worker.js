// service_worker.js
// 注意：确保 manifest.json 声明 host_permissions: ["https://backend.wplace.live/*"]

let latestMatchingUrl = null;
let latestFourCoords = null;

// 捕获后端 pixel 请求，更新 latest 状态（保留你原来的逻辑，稍微稳健化）
chrome.webRequest.onCompleted.addListener(
  details => {
    try {
      const url = new URL(details.url);
      if (url.hostname === "backend.wplace.live" && url.pathname.includes("/s0/pixel/")) {
        // 典型路径格式： /files/s0/pixel/{tlx}/{tly}?x={x}&y={y}  或者 /s0/pixel/{tlx}/{tly}?x={x}&y={y}
        const parts = url.pathname.split("/").filter(Boolean);
        // 搜索可能的位置：找 "pixel" 后两段
        const pixelIdx = parts.indexOf("pixel");
        if (pixelIdx >= 0 && parts.length > pixelIdx + 2) {
          const tlx = parts[pixelIdx + 1];
          const tly = parts[pixelIdx + 2];
          const x = url.searchParams.get("x");
          const y = url.searchParams.get("y");
          if (tlx && tly && x && y) {
            latestMatchingUrl = details.url;
            latestFourCoords = `${tlx}, ${tly}, ${x}, ${y}`;
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  },
  { urls: ["https://backend.wplace.live/*"] }
);

// 小帮助函数：fetch with timeout -> returns Response or throws
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, Object.assign({}, opts, { signal: controller.signal }));
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// 将 ArrayBuffer 转 base64 字符串
function arrayBufferToBase64(ab) {
  const u8 = new Uint8Array(ab);
  let CHUNK_SIZE = 0x8000;
  let index = 0;
  let binary = '';
  while (index < u8.length) {
    const slice = u8.subarray(index, Math.min(index + CHUNK_SIZE, u8.length));
    binary += String.fromCharCode.apply(null, slice);
    index += CHUNK_SIZE;
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) {
    // 不处理空消息（仍保留异步签名）
    return true;
  }

  // 同步查询最新已捕获坐标
  if (msg.type === "WPLACE_GET_LATEST") {
    sendResponse({ coords: latestFourCoords, url: latestMatchingUrl });
    return true;
  }

  // 触发后台去主动 fetch 一次已知的 latestMatchingUrl（用于唤醒/刷新）
  if (msg.type === "WPLACE_TRIGGER_FETCH") {
    (async () => {
      try {
        if (latestMatchingUrl) {
          try {
            // 我们不关心返回体，只做触发；加超时以防阻塞
            await fetchWithTimeout(latestMatchingUrl, { method: 'GET', cache: 'no-store', credentials: 'omit' }, 5000).catch(()=>null);
          } catch (e) {}
        }
      } catch (e) {}
      sendResponse({ coords: latestFourCoords, url: latestMatchingUrl });
    })();
    return true;
  }

  // 后台代理 /me 请求：返回 JSON 或文本
  if (msg.type === "WPLACE_FETCH_ME_PROXY") {
    (async () => {
      try {
        const url = 'https://backend.wplace.live/me';
        const res = await fetchWithTimeout(url, { method: 'GET', credentials: 'include', cache: 'no-store' }, 8000);
        if (!res) { sendResponse({ ok: false, error: 'no_response' }); return; }
        const status = res.status;
        const text = await res.text().catch(()=>null);
        if (status >= 200 && status < 300) {
          // 尝试解析 JSON，失败则返回 text
          try {
            const json = text ? JSON.parse(text) : null;
            sendResponse({ ok: true, json: json, text });
          } catch (e) {
            sendResponse({ ok: true, text });
          }
          return;
        } else {
          sendResponse({ ok: false, status, statusText: res.statusText, text });
          return;
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  // 后台代理瓦片请求：返回 base64 字符串与 mime
  if (msg.type === "WPLACE_FETCH_TILE") {
    const tx = Number(msg.tx);
    const ty = Number(msg.ty);
    (async () => {
      try {
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
          sendResponse({ ok: false, error: 'invalid_tx_ty' });
          return;
        }
        const url = `https://backend.wplace.live/files/s0/tiles/${tx}/${ty}.png`;
        let res;
        try {
          res = await fetchWithTimeout(url, { method: 'GET', credentials: 'omit', cache: 'no-store' }, 10000);
        } catch (ferr) {
          sendResponse({ ok: false, error: 'fetch_failed', detail: String(ferr) });
          return;
        }
        if (!res) { sendResponse({ ok: false, error: 'no_response' }); return; }

        if (res.status === 404) {
          sendResponse({ ok: false, status: 404, reason: 'not_found' });
          return;
        }

        if (!res.ok) {
          sendResponse({ ok: false, status: res.status, statusText: res.statusText });
          return;
        }

        // 读取为 ArrayBuffer -> base64
        const ab = await res.arrayBuffer().catch(e => { throw e; });
        const b64 = arrayBufferToBase64(ab);
        const mime = res.headers.get('content-type') || 'image/png';
        sendResponse({ ok: true, base64: b64, mime });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  // 未知类型：回复失败
  sendResponse({ ok: false, reason: 'unknown_type' });
  return true;
});

// ===== DNR 动态重定向配置（合并到你的 service_worker.js） =====
const DNR_RULE_ID = 2001;
// 可接受的匹配写法：尽量写成通用 pattern 去掉可变 query 部分
// 示例：匹配 https://wplace.live/static/original.js 和带 query 的变体
const TARGET_URL_PATTERN = "||wplace.live/_app/immutable/nodes/4.NP8fl6fK.js"; // 使用 urlFilter 风格（或改为更宽松的子串）
const EXT_PATH = "/replacements/4.NP8fl6fK.js"; // 必须在 web_accessible_resources 中声明

async function ensureDnrRule() {
  try {
    // 先尝试移除已存在的同 id 规则（幂等）
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DNR_RULE_ID],
      addRules: [{
        id: DNR_RULE_ID,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { extensionPath: EXT_PATH }
        },
        condition: {
          // urlFilter 支持多种写法；用通用前缀匹配避免 query 干扰
          urlFilter: TARGET_URL_PATTERN,
          resourceTypes: ["script"]
        }
      }]
    });
    console.log("DNR rule ensured:", TARGET_URL_PATTERN, "->", EXT_PATH);
  } catch (err) {
    console.error("Failed to ensure DNR rule", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDnrRule();
});

chrome.runtime.onStartup.addListener(() => {
  ensureDnrRule();
});
// 也可以在你的 onMessage 处理里暴露启/停开关，参照你已有的消息处理逻辑。
// ===== DNR 配置结束 =====