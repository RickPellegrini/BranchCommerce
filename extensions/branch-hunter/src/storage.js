(() => {
  const SETTINGS_KEY = "branchHunter:settings";
  const LISTING_STATE_PREFIX = "branchHunter:listingState:";

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

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([SETTINGS_KEY], (data) => {
        resolve({ ...defaultSettings, ...(data[SETTINGS_KEY] || {}) });
      });
    });
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => resolve(true));
    });
  }

  function getListingState(listingId) {
    const key = `${LISTING_STATE_PREFIX}${listingId}`;
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (data) => resolve(data[key] || null));
    });
  }

  function saveListingState(listingId, payload) {
    const key = `${LISTING_STATE_PREFIX}${listingId}`;
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: payload }, () => resolve(true));
    });
  }

  globalThis.BranchHunterStorage = {
    SETTINGS_KEY,
    LISTING_STATE_PREFIX,
    defaultSettings,
    getSettings,
    saveSettings,
    getListingState,
    saveListingState,
  };
})();
