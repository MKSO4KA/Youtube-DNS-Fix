function setProxy(value) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value: value, scope: "regular" }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

async function enableProxy(port) {
  const p = Number(port);
  if (!Number.isInteger(p) || p <= 0 || p > 65535) {
    console.error("Некорректный порт:", port);
    return false;
  }
  const value = {
    mode: "fixed_servers",
    rules: {
      singleProxy: { scheme: "socks5", host: "127.0.0.1", port: p }
    }
  };
  await setProxy(value);
  await chrome.storage.local.set({ isProxyEnabled: true, port: p });
  return true;
}

async function disableProxy() {
  await setProxy({ mode: "system" });
  await chrome.storage.local.set({ isProxyEnabled: false, port: null });
  return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === "toggleProxy") {
        const ok = request.enabled ? await enableProxy(request.port) : await disableProxy();
        sendResponse({ success: ok });
      } else if (request.action === "getState") {
        const st = await chrome.storage.local.get(["isProxyEnabled", "port"]);
        sendResponse({ isProxyEnabled: !!st.isProxyEnabled, port: st.port || 10808 });
      }
    } catch (e) {
      console.error(e);
      sendResponse({ success: false, error: String(e) });
    }
  })();
  return true;
});