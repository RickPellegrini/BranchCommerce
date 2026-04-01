const SETTINGS_KEY = "branchHunter:settings";

const defaultSettings = {
  autoInjectEnabled: true,
  manualSaleFeePercentFallback: 16,
  sync: {
    enabled: false,
    apiBaseUrl: "https://branch-commerce.vercel.app",
    apiKey: "bh_sync_2026_Z7x9P4mN2qL8vR5tK1wD3cH6sJ0f",
  },
  defaults: {
    productCost: 0,
    taxPercent: 0,
  },
};

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function setStatus(message, success = true) {
  const status = document.getElementById("status-message");
  status.textContent = message;
  status.style.color = success ? "#065f46" : "#b91c1c";
}

function readForm() {
  return {
    autoInjectEnabled: document.getElementById("auto-inject-enabled").value === "true",
    manualSaleFeePercentFallback: parseNumber(
      document.getElementById("manual-sale-fee-percent-fallback").value,
    ),
    sync: {
      enabled: document.getElementById("sync-enabled").value === "true",
      apiBaseUrl: document.getElementById("sync-api-base-url").value.trim(),
      apiKey: document.getElementById("sync-api-key").value.trim(),
    },
    defaults: {
      productCost: parseNumber(document.getElementById("default-product-cost").value),
      taxPercent: parseNumber(document.getElementById("default-tax-percent").value),
    },
  };
}

function writeForm(values) {
  document.getElementById("auto-inject-enabled").value = String(values.autoInjectEnabled);
  document.getElementById("manual-sale-fee-percent-fallback").value = String(
    values.manualSaleFeePercentFallback,
  );
  document.getElementById("sync-enabled").value = String(values.sync.enabled);
  document.getElementById("sync-api-base-url").value = values.sync.apiBaseUrl;
  document.getElementById("sync-api-key").value = values.sync.apiKey;
  document.getElementById("default-product-cost").value = String(values.defaults.productCost);
  document.getElementById("default-tax-percent").value = String(values.defaults.taxPercent);
}

function saveSettings() {
  const payload = readForm();
  chrome.storage.local.set({ [SETTINGS_KEY]: payload }, () => {
    setStatus("Configuracoes salvas. Recarregue o anuncio para aplicar.");
  });
}

function resetSettings() {
  writeForm(defaultSettings);
  chrome.storage.local.set({ [SETTINGS_KEY]: defaultSettings }, () => {
    setStatus("Padrao restaurado.", true);
  });
}

function boot() {
  chrome.storage.local.get([SETTINGS_KEY], (data) => {
    const persisted = data[SETTINGS_KEY] || {};
    const mergedSync = {
      ...defaultSettings.sync,
      ...(persisted.sync || {}),
      apiKey: String(persisted?.sync?.apiKey || "").trim() || defaultSettings.sync.apiKey,
    };
    writeForm({
      ...defaultSettings,
      ...persisted,
      sync: mergedSync,
      defaults: {
        ...defaultSettings.defaults,
        ...(persisted.defaults || {}),
      },
    });
  });

  document.getElementById("save-settings").addEventListener("click", saveSettings);
  document.getElementById("reset-settings").addEventListener("click", resetSettings);
}

boot();
