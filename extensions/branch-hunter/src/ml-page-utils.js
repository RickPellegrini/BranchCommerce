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

  function getCandidateListingIds() {
    const candidates = new Set();

    const addId = (value) => {
      const raw = String(value || "").toUpperCase().replace("-", "");
      if (/^MLB\d+$/.test(raw)) candidates.add(raw);
    };

    addId(getCurrentListingId());

    const url = new URL(location.href);
    const paramKeys = ["item_id", "itemId", "product_trigger_id", "item"];
    for (const key of paramKeys) {
      addId(url.searchParams.get(key));
    }

    const urlMatches = location.href.match(/MLB[-]?\d+/gi) || [];
    for (const match of urlMatches) addId(match);

    const domCandidates = Array.from(
      document.querySelectorAll("[data-item-id], [data-testid='item-id'], [id*='item-id']"),
    );
    for (const node of domCandidates) {
      addId(node.getAttribute("data-item-id"));
      addId(node.getAttribute("data-testid"));
      addId(node.getAttribute("id"));
      addId(node.textContent);
    }

    const scriptNodes = Array.from(document.querySelectorAll("script"));
    for (const script of scriptNodes.slice(0, 25)) {
      const text = script.textContent || "";
      if (!text.includes("MLB")) continue;
      const matches = text.match(/MLB\d{6,}/g) || [];
      for (const match of matches) addId(match);
    }

    return Array.from(candidates).slice(0, 12);
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
    const buyColumnRoot =
      document.querySelector("[data-testid='buy-box-container']") ||
      document.querySelector(".ui-pdp-container__col.col-2") ||
      document.querySelector(".ui-pdp-right-column");

    // Priority 0: right below payment area, but only inside buy column.
    if (buyColumnRoot) {
      const paymentTextAnchors = Array.from(
        buyColumnRoot.querySelectorAll("a, button, [data-testid*='payment'], [class*='payment']"),
      ).filter((node) => {
        const text = (node.textContent || "").trim().toLowerCase();
        return text.includes("meios de pagamento");
      });

      for (const textNode of paymentTextAnchors) {
        const paymentContainer =
          textNode.closest(".ui-pdp-container__row") ||
          textNode.closest(".ui-pdp-description") ||
          textNode.closest(".ui-pdp-media__body") ||
          textNode.closest("section") ||
          textNode.parentElement;
        if (paymentContainer) return { node: paymentContainer, mode: "after" };
      }
    }

    // Priority 1: below product price/summary in the buy column.
    const purchaseColumnAnchors = [
      "[data-testid='buy-box-container'] .ui-pdp-price",
      "[data-testid='buy-box-container'] .ui-pdp-price__second-line",
      ".ui-pdp-container__col.col-2 .ui-pdp-price",
      ".ui-pdp-container__col.col-2 .ui-pdp-price__second-line",
      "[data-testid='buy-box-container']",
      ".ui-pdp-container__col.col-2",
      ".ui-pdp-right-column",
    ];

    for (const selector of purchaseColumnAnchors) {
      const node = document.querySelector(selector);
      if (node) return { node, mode: "after" };
    }

    // Priority 0: exactly below "Opcoes de compra" section.
    const optionsTextNodes = Array.from(
      document.querySelectorAll("h2, h3, h4, [data-testid*='buy'], [class*='buy']"),
    ).filter((node) => {
      const text = node.textContent?.trim().toLowerCase() || "";
      return text.includes("opcoes de compra") || text.includes("opções de compra");
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

    return null;
  }

  function isMlSearchPage() {
    const host = location.hostname;
    const isMlDomain =
      host.endsWith("mercadolivre.com.br") || host.endsWith("mercadolivre.com");
    if (!isMlDomain) return false;
    if (host.startsWith("lista.")) return true;
    if (document.querySelector("ol.ui-search-layout")) return true;
    if (document.querySelector(".ui-search-results")) return true;
    return false;
  }

  function extractSearchQuery() {
    const url = new URL(location.href);
    const qParam = url.searchParams.get("q");
    if (qParam) return qParam.trim();
    const path = url.pathname.replace(/^\//, "").split("#")[0].split("?")[0];
    const firstSegment = path.split("/")[0] || "";
    if (firstSegment) return decodeURIComponent(firstSegment.replace(/-/g, " ")).trim();
    return null;
  }

  function extractCardItemIds() {
    const seen = new Set();
    const results = [];

    const allLinks = document.querySelectorAll("a[href]");
    for (const link of allLinks) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/MLB[-]?\d+/i);
      if (!match) continue;
      const itemId = match[0].toUpperCase().replace("-", "");
      if (seen.has(itemId)) continue;

      const card =
        link.closest("li.ui-search-layout__item") ||
        link.closest("li[class*='ui-search']") ||
        link.closest("[class*='ui-search-result']") ||
        link.closest("[class*='layout__item']") ||
        link.closest(".andes-card") ||
        link.closest("li") ||
        link.closest("div[class*='result']") ||
        link.closest("div[class*='card']");

      if (!card || card.dataset.bhProcessed) continue;

      const isCatalog = /\/p\/MLB/i.test(href);

      seen.add(itemId);
      results.push({ card, itemId, isCatalog });
    }
    return results;
  }

  globalThis.BranchHunterPageUtils = {
    parseBrazilianCurrency,
    getCurrentListingId,
    getCandidateListingIds,
    getCurrentListingTitle,
    extractPriceFromPage,
    findBestAnchor,
    isMlSearchPage,
    extractSearchQuery,
    extractCardItemIds,
  };
})();
