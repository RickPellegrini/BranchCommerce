(() => {
  function normalizeText(value) {
    return (value || "").trim().toLowerCase();
  }

  function detectListingTypeFromPage() {
    const candidates = [
      document.querySelector("[data-testid='listing-type']"),
      ...Array.from(document.querySelectorAll(".ui-pdp-container__row *")),
    ];

    for (const node of candidates) {
      const text = normalizeText(node?.textContent);
      if (!text) continue;
      if (text.includes("premium")) return "premium";
      if (text.includes("classico") || text.includes("clássico")) return "classico";
    }
    return null;
  }

  function extractCategoryFromBreadcrumb() {
    const breadcrumbLinks = Array.from(
      document.querySelectorAll("a[href*='/categoria/'], .andes-breadcrumb__link, nav a"),
    );
    if (breadcrumbLinks.length === 0) return { categoryId: null, categoryName: null };

    const last = breadcrumbLinks[breadcrumbLinks.length - 1];
    const text = last?.textContent?.trim() || null;
    const href = last?.getAttribute("href") || "";
    const categoryMatch = href.match(/(?:MLB|MCO|MLA)\d+/i);
    return {
      categoryId: categoryMatch ? categoryMatch[0].toUpperCase() : null,
      categoryName: text,
    };
  }

  function extractShippingModeFromPage() {
    const blocks = Array.from(document.querySelectorAll("span, div, p"));
    for (const node of blocks) {
      const text = normalizeText(node.textContent);
      if (!text) continue;
      if (text.includes("full")) return "full";
      if (text.includes("flex")) return "flex";
      if (text.includes("mercado envios")) return "mercado_envios";
      if (text.includes("correios")) return "correios";
    }
    return null;
  }

  function extractShippingEstimatedCostFromPage() {
    const shippingCandidates = [
      "[data-testid='shipping-price']",
      ".ui-pdp-shipping__content",
      ".ui-pdp-color--GREEN",
      ".ui-pdp-media__body",
    ];

    for (const selector of shippingCandidates) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = normalizeText(element.textContent);
        if (!text) continue;
        if (text.includes("gratis") || text.includes("grátis")) return 0;
        const money = globalThis.BranchHunterPageUtils.parseBrazilianCurrency(text);
        if (money !== null) return money;
      }
    }
    return null;
  }

  function deriveSaleFeePercent({ listingType, salePrice }) {
    if (!Number.isFinite(Number(salePrice))) return null;
    if (listingType === "premium") return 16;
    if (listingType === "classico") return 12;
    return null;
  }

  async function loadApiDynamicCache(listingId) {
    const key = `branchHunter:mlDynamicCache:${listingId}`;
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (data) => resolve(data[key] || null));
    });
  }

  /**
   * Integration point for real ML API data:
   * this currently reads optional cached data populated elsewhere.
   */
  async function getMarketplaceDynamicData({ listingId, manualFallback = {} }) {
    const empty = globalThis.BranchHunterTypes.createEmptyMarketplaceData();
    const pageUtils = globalThis.BranchHunterPageUtils;

    const pageSalePrice = pageUtils.extractPriceFromPage();
    const pageListingType = detectListingTypeFromPage();
    const pageShippingEstimatedCost = extractShippingEstimatedCostFromPage();
    const category = extractCategoryFromBreadcrumb();
    const shippingMode = extractShippingModeFromPage();

    const apiCache = await loadApiDynamicCache(listingId);

    const salePrice = apiCache?.salePrice ?? pageSalePrice ?? manualFallback.salePrice ?? null;
    const salePriceSource = apiCache?.salePrice
      ? "api"
      : pageSalePrice !== null
        ? "page"
        : manualFallback.salePrice !== null && manualFallback.salePrice !== undefined
          ? "manual"
          : null;

    const listingType = apiCache?.listingType ?? pageListingType ?? manualFallback.listingType ?? null;
    const listingTypeSource = apiCache?.listingType
      ? "api"
      : pageListingType
        ? "page"
        : manualFallback.listingType
          ? "manual"
          : null;

    const saleFeePercentFromApi = apiCache?.saleFeePercent ?? null;
    const saleFeePercentFromDerivation = deriveSaleFeePercent({ listingType, salePrice });
    const saleFeePercent =
      saleFeePercentFromApi ??
      saleFeePercentFromDerivation ??
      manualFallback.saleFeePercent ??
      null;
    const saleFeePercentSource = saleFeePercentFromApi
      ? "api"
      : saleFeePercentFromDerivation !== null
        ? "derived"
        : manualFallback.saleFeePercent !== null && manualFallback.saleFeePercent !== undefined
          ? "manual"
          : null;

    const shippingEstimatedCost =
      apiCache?.shippingEstimatedCost ?? pageShippingEstimatedCost ?? null;
    const shippingEstimatedCostSource = apiCache?.shippingEstimatedCost
      ? "api"
      : pageShippingEstimatedCost !== null
        ? "page"
        : null;

    const shippingRealCost = apiCache?.shippingRealCost ?? null;
    const shippingRealCostSource = apiCache?.shippingRealCost ? "api" : null;

    const reviewRating = apiCache?.reviewRating ?? null;
    const reviewRatingSource =
      typeof apiCache?.reviewRating === "number"
        ? "api"
        : null;

    return {
      ...empty,
      salePrice,
      listingType,
      saleFeePercent,
      saleFeeAmount: apiCache?.saleFeeAmount ?? null,
      reviewRating,
      categoryId: apiCache?.categoryId ?? category.categoryId,
      categoryName: apiCache?.categoryName ?? category.categoryName,
      shippingMode: apiCache?.shippingMode ?? shippingMode,
      shippingEstimatedCost,
      shippingRealCost,
      source: {
        salePrice: salePriceSource,
        listingType: listingTypeSource,
        saleFeePercent: saleFeePercentSource,
        reviewRating: reviewRatingSource,
        shippingEstimatedCost: shippingEstimatedCostSource,
        shippingRealCost: shippingRealCostSource,
      },
    };
  }

  globalThis.BranchHunterMarketplaceService = {
    getMarketplaceDynamicData,
  };
})();
