const CONFIG = {
  DEFAULT_HOST: "127.0.0.1",
  DEFAULT_PORT: 10808,
  PORT_MIN: 1,
  PORT_MAX: 65535,
  STORAGE_KEYS: {
    IS_ENABLED: "isProxyEnabled",
    HOST: "host",
    PORT: "port"
  },
  ACTIONS: {
    TOGGLE_PROXY: "toggleProxy",
    GET_STATE: "getState"
  }
};

const YT_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "yt.be",
  "googlevideo.com",
  "ytimg.com",
  "ggpht.com",
  "youtube-nocookie.com",
  "youtubekids.com",
  "youtubeeducation.com",
  "youtubego.com",
  "withyoutube.com",
  "gvt1.com"
];

const YT_EXACT_DOMAINS = [
  "youtubei.googleapis.com",
  "youtube.googleapis.com",
  "youtubeembeddedplayer.googleapis.com",
  "ytimg.l.google.com",
  "youtube-ui.l.google.com",
  "wide-youtube.l.google.com"
];

function setProxy(value) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value: value, scope: "regular" }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function buildPacScript(host, port) {
  const h = (typeof host === "string" && host.trim()) ? host.trim() : CONFIG.DEFAULT_HOST;
  const p = Number(port) || CONFIG.DEFAULT_PORT;
  const domainPattern = YT_DOMAINS.map((d) => d.replace(/\./g, "\\.")).join("|");
  const exactPattern = YT_EXACT_DOMAINS.map((d) => d.replace(/\./g, "\\.")).join("|");

  return "function FindProxyForURL(url, host) {\n" +
    "  try {\n" +
    "    if (!host) return \"DIRECT\";\n" +
    "    if (\n" +
    "      /(^|\\.)(" + domainPattern + ")$/i.test(host) ||\n" +
    "      /(^|\\.)(" + exactPattern + ")$/i.test(host) ||\n" +
    "      /^yt[0-9]*\\.googleusercontent\\.com$/i.test(host)\n" +
    "    ) {\n" +
    "      return \"SOCKS5 " + h + ":" + p + "; SOCKS " + h + ":" + p + "; DIRECT\";\n" +
    "    }\n" +
    "  } catch (e) {}\n" +
    "  return \"DIRECT\";\n" +
    "}";
}

async function enableProxy(host, port) {
  const h = (typeof host === "string" && host.trim()) ? host.trim() : CONFIG.DEFAULT_HOST;
  const p = Number(port);
  if (!Number.isInteger(p) || p < CONFIG.PORT_MIN || p > CONFIG.PORT_MAX) {
    console.error("Некорректный порт:", port);
    return false;
  }
  const value = {
    mode: "pac_script",
    pacScript: {
      data: buildPacScript(h, p),
      mandatory: false
    }
  };
  try {
    await setProxy({ mode: "system" });
    await setProxy(value);
    await chrome.storage.local.set({
      [CONFIG.STORAGE_KEYS.IS_ENABLED]: true,
      [CONFIG.STORAGE_KEYS.HOST]: h,
      [CONFIG.STORAGE_KEYS.PORT]: p
    });
    return true;
  } catch (err) {
    console.error("Ошибка активации прокси, аварийный возврат в system:", err);
    await setProxy({ mode: "system" });
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.IS_ENABLED]: false });
    return false;
  }
}

async function disableProxy() {
  try {
    await setProxy({ mode: "system" });
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.IS_ENABLED]: false });
    return true;
  } catch (err) {
    console.error("Ошибка деактивации прокси:", err);
    return false;
  }
}

chrome.runtime.onStartup.addListener(async () => {
  try {
    const st = await chrome.storage.local.get([
      CONFIG.STORAGE_KEYS.IS_ENABLED,
      CONFIG.STORAGE_KEYS.HOST,
      CONFIG.STORAGE_KEYS.PORT
    ]);
    if (st[CONFIG.STORAGE_KEYS.IS_ENABLED]) {
      await enableProxy(st[CONFIG.STORAGE_KEYS.HOST], st[CONFIG.STORAGE_KEYS.PORT]);
    } else {
      await disableProxy();
    }
  } catch (e) {
    console.error("Ошибка при стартовой синхронизации прокси:", e);
    await disableProxy();
  }
});

if (chrome.proxy && chrome.proxy.onProxyError) {
  chrome.proxy.onProxyError.addListener((details) => {
    console.warn("Chrome Proxy Warning:", details);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === CONFIG.ACTIONS.TOGGLE_PROXY) {
        const ok = request.enabled ? await enableProxy(request.host, request.port) : await disableProxy();
        sendResponse({ success: ok });
      } else if (request.action === CONFIG.ACTIONS.GET_STATE) {
        const st = await chrome.storage.local.get([
          CONFIG.STORAGE_KEYS.IS_ENABLED,
          CONFIG.STORAGE_KEYS.HOST,
          CONFIG.STORAGE_KEYS.PORT
        ]);
        sendResponse({
          isProxyEnabled: !!st[CONFIG.STORAGE_KEYS.IS_ENABLED],
          host: st[CONFIG.STORAGE_KEYS.HOST] || CONFIG.DEFAULT_HOST,
          port: st[CONFIG.STORAGE_KEYS.PORT] || CONFIG.DEFAULT_PORT
        });
      }
    } catch (e) {
      console.error(e);
      sendResponse({ success: false, error: String(e) });
    }
  })();
  return true;
});