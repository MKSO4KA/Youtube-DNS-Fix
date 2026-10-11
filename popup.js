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
  },
  TOAST_TIMEOUT_MS: 2500,
  MODAL_CLOSE_DELAY_MS: 800
};

const toggle = document.getElementById("proxyToggle");
const toggleCard = document.getElementById("toggleCard");
const subLabel = document.getElementById("subLabel");
const hostInput = document.getElementById("hostInput");
const portInput = document.getElementById("portInput");
const configInput = document.getElementById("configInput");
const parseBtn = document.getElementById("parseBtn");
const errorMsg = document.getElementById("errorMsg");
const tipBox = document.getElementById("tipBox");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const helpLink = document.getElementById("helpLink");
const toast = document.getElementById("toast");

window.currentHost = CONFIG.DEFAULT_HOST;
window.currentPort = CONFIG.DEFAULT_PORT;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), CONFIG.TOAST_TIMEOUT_MS);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add("show");
}

function hideError() {
  errorMsg.classList.remove("show");
}

function updateUI() {
  const isChecked = toggle.checked;
  const host = window.currentHost;
  const port = window.currentPort;

  if (hostInput && document.activeElement !== hostInput) hostInput.value = host;
  if (portInput && document.activeElement !== portInput) portInput.value = port;

  if (isChecked) {
    toggleCard.classList.add("active");
    subLabel.textContent = `YouTube через ${host}:${port}`;
  } else {
    toggleCard.classList.remove("active");
    subLabel.textContent = `${host}:${port} (нажмите для включения)`;
  }
}

async function refresh() {
  try {
    const st = await chrome.runtime.sendMessage({ action: CONFIG.ACTIONS.GET_STATE });
    if (st) {
      window.currentHost = st.host || CONFIG.DEFAULT_HOST;
      window.currentPort = Number(st.port) || CONFIG.DEFAULT_PORT;
      toggle.checked = !!st.isProxyEnabled;
    }
    updateUI();
  } catch (e) {
    console.error("Ошибка при загрузке состояния:", e);
    updateUI();
  }
}

async function saveSettings(silent = false) {
  const hostVal = (hostInput ? hostInput.value.trim() : "") || CONFIG.DEFAULT_HOST;
  const portVal = Number(portInput ? portInput.value.trim() : CONFIG.DEFAULT_PORT);

  if (!Number.isInteger(portVal) || portVal < CONFIG.PORT_MIN || portVal > CONFIG.PORT_MAX) {
    if (!silent) showToast(`⚠️ Укажите порт от ${CONFIG.PORT_MIN} до ${CONFIG.PORT_MAX}`);
    return false;
  }

  window.currentHost = hostVal;
  window.currentPort = portVal;
  await chrome.storage.local.set({
    [CONFIG.STORAGE_KEYS.HOST]: hostVal,
    [CONFIG.STORAGE_KEYS.PORT]: portVal
  });

  if (toggle.checked) {
    const res = await chrome.runtime.sendMessage({
      action: CONFIG.ACTIONS.TOGGLE_PROXY,
      enabled: true,
      host: hostVal,
      port: portVal
    });
    if (res && res.error) {
      showToast("Ошибка применения: " + res.error);
    } else if (!silent) {
      showToast(`✅ Настройки ${hostVal}:${portVal} применены на лету!`);
    }
  } else if (!silent) {
    showToast(`✅ Настройки ${hostVal}:${portVal} сохранены`);
  }

  updateUI();
  return true;
}

toggle.addEventListener("change", async () => {
  hideError();
  await saveSettings(true);
  try {
    const res = await chrome.runtime.sendMessage({
      action: CONFIG.ACTIONS.TOGGLE_PROXY,
      enabled: toggle.checked,
      host: window.currentHost,
      port: window.currentPort
    });
    if (res && res.error) {
      showToast("Ошибка подключения: " + res.error);
    }
    updateUI();
  } catch (e) {
    showToast("Не удалось изменить состояние: " + e.message);
    toggle.checked = !toggle.checked;
    updateUI();
  }
});

[hostInput, portInput].forEach((input) => {
  if (!input) return;
  input.addEventListener("change", () => saveSettings());
  input.addEventListener("blur", () => saveSettings());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
});

if (parseBtn) {
  parseBtn.addEventListener("click", async () => {
    hideError();
    if (tipBox) tipBox.classList.remove("show");

    let cfg;
    try {
      cfg = JSON.parse(configInput.value);
    } catch (e) {
      showError("Это не похоже на правильные настройки. Скопируйте их целиком из вашей программы и вставьте сюда.");
      return;
    }

    const inb = Array.isArray(cfg.inbounds) ? cfg.inbounds : [];
    const found = inb.find((i) => i && (i.protocol === "socks" || i.protocol === "http") && i.port);

    if (found) {
      const p = Number(found.port);
      const h = (found.listen && typeof found.listen === "string") ? found.listen : CONFIG.DEFAULT_HOST;
      window.currentHost = h;
      window.currentPort = p;
      if (hostInput) hostInput.value = h;
      if (portInput) portInput.value = p;
      await saveSettings(true);
      showToast("✅ Настройки найдены и сохранены!");
      setTimeout(() => modalOverlay.classList.remove("show"), CONFIG.MODAL_CLOSE_DELAY_MS);
    } else {
      showError("Не удалось найти нужные настройки. Возможно, ваша программа работает другим способом. Попробуйте Happ или INCY.");
      if (tipBox) tipBox.classList.add("show");
    }
  });
}

helpLink.addEventListener("click", () => {
  modalOverlay.classList.add("show");
  hideError();
  if (tipBox) tipBox.classList.remove("show");
});

modalClose.addEventListener("click", () => {
  modalOverlay.classList.remove("show");
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove("show");
  }
});

refresh();
