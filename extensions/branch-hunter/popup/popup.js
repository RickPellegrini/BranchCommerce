const SETTINGS_KEY = "branchHunter:settings"

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
    centralizeEnabled: true,
    freeShippingEnabled: true,
    freeShippingMinPrice: 79,
    freeShippingSubsidyPercent: 50,
    defaultShippingCost: 12,
    shippingFallback: 12,
    forceManualShipping: false,
  },
}

function parseNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function setStatus(message, success = true) {
  const status = document.getElementById("status-message")
  status.textContent = message
  status.style.color = success ? "#065f46" : "#b91c1c"
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
      centralizeEnabled: document.getElementById("default-centralize-enabled").value === "true",
      freeShippingEnabled:
        document.getElementById("default-free-shipping-enabled").value === "true",
      freeShippingMinPrice: parseNumber(
        document.getElementById("default-free-shipping-min-price").value,
      ),
      freeShippingSubsidyPercent: parseNumber(
        document.getElementById("default-free-shipping-subsidy-percent").value,
      ),
      defaultShippingCost: parseNumber(document.getElementById("default-shipping-cost").value),
      shippingFallback: parseNumber(document.getElementById("default-manual-shipping").value),
      forceManualShipping:
        document.getElementById("default-force-manual-shipping").value === "true",
    },
  }
}

function writeForm(values) {
  document.getElementById("auto-inject-enabled").value = String(values.autoInjectEnabled)
  document.getElementById("manual-sale-fee-percent-fallback").value = String(
    values.manualSaleFeePercentFallback,
  )
  document.getElementById("sync-enabled").value = String(values.sync.enabled)
  document.getElementById("sync-api-base-url").value = values.sync.apiBaseUrl
  document.getElementById("sync-api-key").value = values.sync.apiKey
  document.getElementById("default-product-cost").value = String(values.defaults.productCost)
  document.getElementById("default-centralize-enabled").value = String(
    values.defaults.centralizeEnabled ?? true,
  )
  document.getElementById("default-free-shipping-enabled").value = String(
    values.defaults.freeShippingEnabled ?? true,
  )
  document.getElementById("default-free-shipping-min-price").value = String(
    values.defaults.freeShippingMinPrice ?? 79,
  )
  document.getElementById("default-free-shipping-subsidy-percent").value = String(
    values.defaults.freeShippingSubsidyPercent ?? 50,
  )
  document.getElementById("default-shipping-cost").value = String(
    values.defaults.defaultShippingCost ?? 12,
  )
  document.getElementById("default-manual-shipping").value = String(
    values.defaults.shippingFallback ?? 12,
  )
  document.getElementById("default-force-manual-shipping").value = String(
    values.defaults.forceManualShipping ?? false,
  )
}

function saveSettings() {
  const payload = readForm()
  chrome.storage.local.set({ [SETTINGS_KEY]: payload }, () => {
    setStatus("Configuracoes salvas. Recarregue o anuncio para aplicar.")
  })
}

function resetSettings() {
  writeForm(defaultSettings)
  chrome.storage.local.set({ [SETTINGS_KEY]: defaultSettings }, () => {
    setStatus("Padrao restaurado.", true)
  })
}

function boot() {
  chrome.storage.local.get([SETTINGS_KEY], (data) => {
    const persisted = data[SETTINGS_KEY] || {}
    const mergedSync = {
      ...defaultSettings.sync,
      ...(persisted.sync || {}),
      apiKey: String(persisted?.sync?.apiKey || "").trim() || defaultSettings.sync.apiKey,
    }
    writeForm({
      ...defaultSettings,
      ...persisted,
      sync: mergedSync,
      defaults: {
        ...defaultSettings.defaults,
        ...(persisted.defaults || {}),
      },
    })
  })

  document.getElementById("save-settings").addEventListener("click", saveSettings)
  document.getElementById("reset-settings").addEventListener("click", resetSettings)
}

boot()
