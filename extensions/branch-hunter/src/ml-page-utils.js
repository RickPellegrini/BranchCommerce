(() => {
  function parseBrazilianCurrency(text) {
    if (!text) return null;
    const onlyCurrencyChars = text.replace(/[^\d.,-]/g, "").trim();
    if (!onlyCurrencyChars) return null;
    const normalized = onlyCurrencyChars.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function getCurrentListingId() {
    const url = location.href;
    const itemMatch = url.match(/MLB[-]?\d+/i);
    if (itemMatch) return itemMatch[0].toUpperCase().replace("-", "");
    return "unknown-item";
  }

  function getCurrentListingTitle() {
    const candidates = [
      document.querySelector("h1.ui-pdp-title"),
      document.querySelector("[data-testid='product-title']"),
      document.querySelector("h1"),
    ];
    for (const candidate of candidates) {
      const text = candidate?.textContent?.trim();
      if (text) return text;
    }
    return document.title || "Anuncio Mercado Livre";
  }

  function extractPriceFromPage() {
    const metaPrice = document.querySelector('meta[itemprop="price"]');
    if (metaPrice) {
      const value = Number(metaPrice.getAttribute("content"));
      if (Number.isFinite(value)) return value;
    }

    const candidates = [
      "[data-testid='price-part']",
      ".ui-pdp-price__second-line",
      ".andes-money-amount__fraction",
      ".price-tag-fraction",
      "[data-testid='price']",
      ".ui-pdp-price__part",
    ];

    for (const selector of candidates) {
      const element = document.querySelector(selector);
      const value = parseBrazilianCurrency(element?.textContent || "");
      if (value !== null) return value;
    }
    return null;
  }

  function findBestAnchor() {
    // Priority 0: exactly below "Opcoes de compra" section.
    const optionsTextNodes = Array.from(
      document.querySelectorAll("h2, h3, h4, p, span, div"),
    ).filter((node) => {
      const text = node.textContent?.trim().toLowerCase() || "";
      return text === "opcoes de compra:" || text === "opções de compra:";
    });

    for (const textNode of optionsTextNodes) {
      const sectionNode =
        textNode.closest(".ui-pdp-container__row") ||
        textNode.closest("section") ||
        textNode.closest("article") ||
        textNode.parentElement;
      if (sectionNode) return { node: sectionNode, mode: "after" };
    }

    // Priority 1: render just above product description.
    const descriptionAnchors = [
      ".ui-pdp-container__row--description",
      "[data-testid='description']",
      ".ui-pdp-description",
      "#description",
    ];

    for (const selector of descriptionAnchors) {
      const node = document.querySelector(selector);
      if (node) return { node, mode: "before" };
    }

    // Priority 2: near main content blocks of the listing.
    const nearMainContentAnchors = [
      ".ui-pdp-container__row--main-actions",
      ".ui-pdp-container__row--main-display",
      ".ui-pdp-container__row",
    ];

    for (const selector of nearMainContentAnchors) {
      const node = document.querySelector(selector);
      if (node) return { node, mode: "after" };
    }

    // Priority 3: right column fallback still inside product context.
    const sideColumnAnchors = [
      "[data-testid='buy-box-container']",
      ".ui-pdp-right-column",
      ".ui-pdp-container__col.col-2",
      ".ui-pdp-actions",
    ];

    for (const selector of sideColumnAnchors) {
      const node = document.querySelector(selector);
      if (node) return { node, mode: "prepend" };
    }

    return null;
  }

  globalThis.BranchHunterPageUtils = {
    parseBrazilianCurrency,
    getCurrentListingId,
    getCurrentListingTitle,
    extractPriceFromPage,
    findBestAnchor,
  };
})();
