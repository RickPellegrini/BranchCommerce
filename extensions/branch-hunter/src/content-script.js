function parseBrazilianCurrency(text) {
  if (!text) return null;
  const onlyCurrencyChars = text.replace(/[^\d.,-]/g, "").trim();
  if (!onlyCurrencyChars) return null;

  const normalized = onlyCurrencyChars.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractPrice() {
  const metaPrice = document.querySelector('meta[itemprop="price"]');
  if (metaPrice) {
    const value = Number(metaPrice.getAttribute("content"));
    if (Number.isFinite(value)) return value;
  }

  const candidates = [
    document.querySelector("[data-testid='price-part']"),
    document.querySelector(".ui-pdp-price__second-line"),
    document.querySelector(".andes-money-amount__fraction"),
    document.querySelector(".price-tag-fraction"),
  ];

  for (const element of candidates) {
    const value = parseBrazilianCurrency(element?.textContent || "");
    if (value !== null) return value;
  }

  return null;
}

function extractListingData() {
  return {
    url: window.location.href,
    title: document.title,
    price: extractPrice(),
  };
}

function publishListingData() {
  if (!chrome?.runtime?.id) return;

  const payload = extractListingData();
  chrome.runtime.sendMessage(
    {
      type: "BRANCH_HUNTER_LISTING",
      payload,
    },
    () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        // Ignore errors caused by popup/background lifecycle.
      }
    },
  );
}

let debounceTimer = null;
function schedulePublish() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(publishListingData, 800);
}

publishListingData();

const observer = new MutationObserver(() => schedulePublish());
observer.observe(document.documentElement, { childList: true, subtree: true });
