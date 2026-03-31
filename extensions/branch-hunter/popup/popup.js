const SETTINGS_KEY = "branchHunter:settings";

const defaultSettings = {
  autoInjectEnabled: true,
  manualSaleFeePercentFallback: 16,
  defaults: {
    productCost: 0,
    taxPercent: 0,
    adsPercent: 0,
    packagingCost: 0,
    otherFixedCosts: 0,
    riskPercent: 0,
    shippingFallback: 0,
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
    defaults: {
      productCost: parseNumber(document.getElementById("default-product-cost").value),
      taxPercent: parseNumber(document.getElementById("default-tax-percent").value),
      adsPercent: parseNumber(document.getElementById("default-ads-percent").value),
      packagingCost: parseNumber(document.getElementById("default-packaging-cost").value),
      otherFixedCosts: parseNumber(document.getElementById("default-other-fixed-costs").value),
      riskPercent: parseNumber(document.getElementById("default-risk-percent").value),
      shippingFallback: parseNumber(document.getElementById("default-shipping-fallback").value),
    },
  };
}

function writeForm(values) {
  document.getElementById("auto-inject-enabled").value = String(values.autoInjectEnabled);
  document.getElementById("manual-sale-fee-percent-fallback").value = String(
    values.manualSaleFeePercentFallback,
  );
  document.getElementById("default-product-cost").value = String(values.defaults.productCost);
  document.getElementById("default-tax-percent").value = String(values.defaults.taxPercent);
  document.getElementById("default-ads-percent").value = String(values.defaults.adsPercent);
  document.getElementById("default-packaging-cost").value = String(values.defaults.packagingCost);
  document.getElementById("default-other-fixed-costs").value = String(
    values.defaults.otherFixedCosts,
  );
  document.getElementById("default-risk-percent").value = String(values.defaults.riskPercent);
  document.getElementById("default-shipping-fallback").value = String(
    values.defaults.shippingFallback,
  );
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
    writeForm({
      ...defaultSettings,
      ...persisted,
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
