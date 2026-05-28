;(() => {
  const SETTINGS_KEY = "branchHunter:settings"
  const LISTING_STATE_PREFIX = "branchHunter:listingState:"

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
      freeShippingEnabled: true,
      freeShippingMinPrice: 79,
      freeShippingSubsidyPercent: 50,
      defaultShippingCost: 12,
      shippingFallback: 12,
      forceManualShipping: false,
      centralizeEnabled: true,
      fullEnabled: false,
    },
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([SETTINGS_KEY], (data) => {
        const persisted = data[SETTINGS_KEY] || {}
        resolve({
          ...defaultSettings,
          ...persisted,
          sync: {
            ...defaultSettings.sync,
            ...(persisted.sync || {}),
            apiKey: String(persisted?.sync?.apiKey || "").trim() || defaultSettings.sync.apiKey,
          },
          defaults: {
            ...defaultSettings.defaults,
            ...(persisted.defaults || {}),
          },
        })
      })
    })
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => resolve(true))
    })
  }

  function getListingState(listingId) {
    const key = `${LISTING_STATE_PREFIX}${listingId}`
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (data) => resolve(data[key] || null))
    })
  }

  function saveListingState(listingId, payload) {
    const key = `${LISTING_STATE_PREFIX}${listingId}`
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: payload }, () => resolve(true))
    })
  }

  globalThis.BranchHunterStorage = {
    SETTINGS_KEY,
    LISTING_STATE_PREFIX,
    defaultSettings,
    getSettings,
    saveSettings,
    getListingState,
    saveListingState,
  }
})()
