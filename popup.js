const toggle = document.getElementById("proxyToggle");
const toggleCard = document.getElementById("toggleCard");
const subLabel = document.getElementById("subLabel");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const configInput = document.getElementById("configInput");
const parseBtn = document.getElementById("parseBtn");
const errorMsg = document.getElementById("errorMsg");
const tipBox = document.getElementById("tipBox");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const helpLink = document.getElementById("helpLink");
const toast = document.getElementById("toast");

window.currentPort = 10808;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
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
  const port = window.currentPort;

  if (isChecked) {
    toggleCard.classList.add("active");
    subLabel.textContent = "Фикс YouTube включён";
    statusBadge.className = "status-badge on";
    statusText.textContent = "Фикс YouTube включён";
  } else {
    toggleCard.classList.remove("active");
    subLabel.textContent = "Нажмите переключатель";
    statusBadge.className = "status-badge off";
    statusText.textContent = "Фикс YouTube выключен";
  }
}

async function refresh() {
  try {
    const st = await chrome.runtime.sendMessage({ action: "getState" });
    if (st) {
      window.currentPort = Number(st.port) || 10808;
      toggle.checked = !!st.isProxyEnabled;
    }
    updateUI();
  } catch (e) {
    console.error("Ошибка при загрузке состояния:", e);
    updateUI();
  }
}

toggle.addEventListener("change", async () => {
  hideError();
  try {
    const res = await chrome.runtime.sendMessage({
      action: "toggleProxy",
      enabled: toggle.checked,
      port: window.currentPort
    });
    if (res && res.error) {
      showError("Ошибка подключения: " + res.error);
    }
    updateUI();
  } catch (e) {
    showError("Не удалось изменить состояние прокси: " + e.message);
    toggle.checked = !toggle.checked; // откатываем
    updateUI();
  }
});

parseBtn.addEventListener("click", () => {
  hideError();
  tipBox.classList.remove("show");

  let cfg;
  try {
    cfg = JSON.parse(configInput.value);
  } catch (e) {
    showError("Это не похоже на правильные настройки. Скопируйте их целиком из вашей программы и вставьте сюда.");
    return;
  }

  const inb = Array.isArray(cfg.inbounds) ? cfg.inbounds : [];
  const found = inb.find(i => i && (i.protocol === "socks" || i.protocol === "http") && i.port);

  if (found) {
    window.currentPort = Number(found.port);
    chrome.storage.local.set({ port: window.currentPort });
    showToast("✅ Настройки найдены! Включите переключатель.");
    setTimeout(() => modalOverlay.classList.remove("show"), 800);
    updateUI();
  } else {
    showError("Не удалось найти нужные настройки. Возможно, ваша программа работает другим способом. Попробуйте Happ или INCY.");
    tipBox.classList.add("show");
  }
});

helpLink.addEventListener("click", () => {
  modalOverlay.classList.add("show");
  hideError();
  tipBox.classList.remove("show");
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