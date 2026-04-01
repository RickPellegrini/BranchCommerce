(() => {
  const PANEL_HOST_ID = "branch-hunter-inline-host";
  const BRAND_LOGO_URL = "https://branch-commerce.vercel.app/branch_logo.jpeg";
  const DEBUG = false;

  const state = {
    listingId: "",
    listingTitle: "",
    listingUrl: "",
    detectedPrice: null,
    lastUrl: location.href,
    host: null,
    shadowRoot: null,
    observer: null,
    renderDebounce: null,
    isInitialized: false,
    manualSaleFeePercentFallback: 16,
    syncConfig: {
      enabled: false,
      apiBaseUrl: "",
      apiKey: "",
    },
    costSyncDebounce: null,
    marketplaceDataCache: null,
  };

  function logDebug(message, payload) {
    if (!DEBUG) return;
    console.log(`[BranchHunter] ${message}`, payload || "");
  }

  function isMlProductPage() {
    return /MLB[-]?\d+/i.test(location.href);
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function formatPercent(value) {
    return `${value.toFixed(2)}%`;
  }

  function formatSource(source) {
    if (!source) return "indisponivel";
    if (source === "api") return "api";
    if (source === "page") return "pagina";
    if (source === "manual") return "manual";
    return "derivado";
  }

  function formatNullableMoney(value) {
    return typeof value === "number" && Number.isFinite(value) ? formatMoney(value) : "--";
  }

  function formatNullableText(value) {
    return value && String(value).trim() ? String(value) : "--";
  }

  function buildPanelHTML() {
    return `
      <style>
        :host {
          all: initial;
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          color: #0f172a;
        }
        * { box-sizing: border-box; }
        .panel {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #dbe5f5;
          border-radius: 14px;
          padding: 12px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
          width: 100%;
          max-width: 360px;
          display: grid;
          gap: 10px;
        }
        .section {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .section-dynamic {
          border-color: #bfdbfe;
          background: #f8fbff;
        }
        .section-manual {
          border-color: #fde68a;
          background: #fffbeb;
        }
        .section-operation {
          border-color: #c7d2fe;
          background: #f8f9ff;
        }
        .section-result {
          border-color: #bbf7d0;
          background: #f0fdf4;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .header-main {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand-logo {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
          background: #fff;
        }
        .title {
          font-size: 15px;
          font-weight: 700;
          margin: 0;
        }
        .subtitle {
          margin: 0;
          font-size: 12px;
          color: #6b7280;
        }
        .chip {
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          color: #374151;
          background: #f9fafb;
        }
        .section-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .section-icon {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #0f172a;
          background: #e2e8f0;
        }
        .section-title {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }
        .listing-title,
        .subtle {
          font-size: 12px;
          color: #374151;
        }
        .listing-url {
          font-size: 11px;
          color: #6b7280;
          word-break: break-word;
        }
        .grid {
          display: grid;
          gap: 8px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: #374151;
        }
        input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 9px;
          font-size: 13px;
          background: #fff;
          color: #111827;
        }
        input:focus {
          outline: 2px solid #bfdbfe;
          border-color: #60a5fa;
        }
        select {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 9px;
          font-size: 13px;
          background: #fff;
          color: #111827;
        }
        select:focus {
          outline: 2px solid #bfdbfe;
          border-color: #60a5fa;
        }
        .dynamic-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
        }
        .row-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .row-icon {
          width: 12px;
          height: 12px;
          color: #64748b;
        }
        .dynamic-row strong {
          color: #111827;
          font-size: 12px;
        }
        .dynamic-row small {
          color: #6b7280;
          font-size: 11px;
        }
        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        button {
          border: 0;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-primary {
          background: #1d4ed8;
          color: #fff;
        }
        .btn-primary:hover {
          background: #1e40af;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }
        .btn-secondary:hover {
          background: #d1d5db;
        }
        .result-title {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }
        .result-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
        }
        .result-row strong {
          font-size: 13px;
          color: #111827;
        }
        .result-profit strong {
          color: #16a34a;
        }
        .result-profit.negative strong {
          color: #dc2626;
        }
      </style>
      <section class="panel">
        <header class="header">
          <div class="header-main">
            <img class="brand-logo" src="${BRAND_LOGO_URL}" alt="Branch Commerce logo" />
            <div>
            <p class="title">Branch Hunter</p>
            <p class="subtitle">Calculadora hibrida ML + operacao</p>
            </div>
          </div>
          <span class="chip">Auto</span>
        </header>

        <div class="section section-dynamic">
          <div class="section-title-row">
            <span class="section-icon" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <p class="section-title">Dados dinamicos Mercado Livre</p>
          </div>
          <div class="dynamic-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Preco anuncio</span><div><strong id="bh-dyn-sale-price">--</strong> <small id="bh-src-sale-price">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Tipo anuncio</span><div><strong id="bh-dyn-listing-type">--</strong> <small id="bh-src-listing-type">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M3 10h18M7 6h10M7 14h10M7 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Taxa ML</span><div><strong id="bh-dyn-fee">--</strong> <small id="bh-src-fee">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v14H4zM8 9h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Categoria</span><div><strong id="bh-dyn-category">--</strong></div></div>
          <div class="dynamic-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M3 16h18M5 16l2-6h10l2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Frete estimado</span><div><strong id="bh-dyn-shipping-estimated">--</strong> <small id="bh-src-shipping-estimated">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 17h16M7 17V7h10v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Frete real</span><div><strong id="bh-dyn-shipping-real">--</strong> <small id="bh-src-shipping-real">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M12 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Modo envio</span><div><strong id="bh-dyn-shipping-mode">--</strong></div></div>
        </div>

        <div class="section section-operation grid">
          <div class="section-title-row">
            <span class="section-icon" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18v12H3zM8 10h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <p class="section-title">Custos configuraveis do vendedor</p>
          </div>
          <div class="grid-2">
            <label>Custo produto (R$)<input id="bh-product-cost" type="number" step="0.01" min="0"></label>
            <label>Imposto (%)<input id="bh-tax-percent" type="number" step="0.01" min="0"></label>
          </div>
        </div>

        <div class="actions">
          <button id="bh-sync-dynamic" class="btn-primary" type="button">Atualizar dados ML</button>
          <button id="bh-reset" class="btn-secondary" type="button">Limpar</button>
        </div>

        <div class="section section-result">
          <div class="section-title-row">
            <span class="section-icon" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M4 20V10m6 10V4m6 16v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <p class="result-title">Resultado</p>
          </div>
          <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Receita bruta</span><strong id="bh-result-gross">R$ 0,00</strong></div>
          <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Taxa marketplace</span><strong id="bh-result-fee">R$ 0,00</strong></div>
          <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M8 7h8M8 12h8M8 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Impostos</span><strong id="bh-result-tax">R$ 0,00</strong></div>
          <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M3 17h18M5 17l2-6h10l2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Frete usado</span><strong id="bh-result-shipping">R$ 0,00</strong></div>
          <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Total custos</span><strong id="bh-result-total-costs">R$ 0,00</strong></div>
          <div id="bh-profit-row" class="result-row result-profit"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 17l6-6 4 4 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Lucro liquido</span><strong id="bh-result-profit">R$ 0,00</strong></div>
          <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Margem</span><strong id="bh-result-margin">0,00%</strong></div>
        </div>
      </section>
    `;
  }

  function getElements() {
    if (!state.shadowRoot) return null;
    const $ = (id) => state.shadowRoot.getElementById(id);
    return {
      dynSalePrice: $("bh-dyn-sale-price"),
      srcSalePrice: $("bh-src-sale-price"),
      dynListingType: $("bh-dyn-listing-type"),
      srcListingType: $("bh-src-listing-type"),
      dynFee: $("bh-dyn-fee"),
      srcFee: $("bh-src-fee"),
      dynCategory: $("bh-dyn-category"),
      dynShippingEstimated: $("bh-dyn-shipping-estimated"),
      srcShippingEstimated: $("bh-src-shipping-estimated"),
      dynShippingReal: $("bh-dyn-shipping-real"),
      srcShippingReal: $("bh-src-shipping-real"),
      dynShippingMode: $("bh-dyn-shipping-mode"),
      productCost: $("bh-product-cost"),
      taxPercent: $("bh-tax-percent"),
      syncDynamic: $("bh-sync-dynamic"),
      reset: $("bh-reset"),
      resultGross: $("bh-result-gross"),
      resultFee: $("bh-result-fee"),
      resultTax: $("bh-result-tax"),
      resultShipping: $("bh-result-shipping"),
      resultTotalCosts: $("bh-result-total-costs"),
      profitRow: $("bh-profit-row"),
      resultProfit: $("bh-result-profit"),
      resultMargin: $("bh-result-margin"),
    };
  }

  function readManualMarketplaceValues() {
    return {
      salePrice: null,
      listingType: null,
      saleFeePercent: state.manualSaleFeePercentFallback,
    };
  }

  function readOperationValues(elements) {
    return {
      productCost: toNumber(elements.productCost.value, 0),
      taxPercent: toNumber(elements.taxPercent.value, 0),
      adsPercent: 0,
      packagingCost: 0,
      otherFixedCosts: 0,
      riskPercent: 0,
      shippingFallback: 0,
    };
  }

  function writeMarketplaceDynamicSection(elements, marketplaceData) {
    elements.dynSalePrice.textContent = formatNullableMoney(marketplaceData.salePrice);
    elements.srcSalePrice.textContent = `(${formatSource(marketplaceData.source.salePrice)})`;
    elements.dynListingType.textContent = formatNullableText(marketplaceData.listingType);
    elements.srcListingType.textContent = `(${formatSource(marketplaceData.source.listingType)})`;
    const feeLabel =
      marketplaceData.saleFeePercent !== null
        ? `${formatPercent(marketplaceData.saleFeePercent)}`
        : "--";
    elements.dynFee.textContent = feeLabel;
    elements.srcFee.textContent = `(${formatSource(marketplaceData.source.saleFeePercent)})`;
    elements.dynCategory.textContent = formatNullableText(
      marketplaceData.categoryName || marketplaceData.categoryId,
    );
    elements.dynShippingEstimated.textContent = formatNullableMoney(
      marketplaceData.shippingEstimatedCost,
    );
    elements.srcShippingEstimated.textContent = `(${formatSource(
      marketplaceData.source.shippingEstimatedCost,
    )})`;
    elements.dynShippingReal.textContent = formatNullableMoney(marketplaceData.shippingRealCost);
    elements.srcShippingReal.textContent = `(${formatSource(
      marketplaceData.source.shippingRealCost,
    )})`;
    elements.dynShippingMode.textContent = formatNullableText(marketplaceData.shippingMode);

  }

  function updateResultUI(elements, calculationResult) {
    elements.resultGross.textContent = formatMoney(calculationResult.grossRevenue);
    elements.resultFee.textContent = formatMoney(calculationResult.marketplaceFeeAmount);
    elements.resultTax.textContent = formatMoney(calculationResult.taxAmount);
    elements.resultShipping.textContent = formatMoney(calculationResult.shippingCostUsed);
    elements.resultTotalCosts.textContent = formatMoney(calculationResult.totalCosts);
    elements.resultProfit.textContent = formatMoney(calculationResult.netProfit);
    elements.resultMargin.textContent = formatPercent(calculationResult.netMarginPercent);
    if (calculationResult.netProfit < 0) {
      elements.profitRow.classList.add("negative");
    } else {
      elements.profitRow.classList.remove("negative");
    }
  }

  async function syncListingContext() {
    const { getCurrentListingId, getCurrentListingTitle, extractPriceFromPage } =
      globalThis.BranchHunterPageUtils;
    state.listingId = getCurrentListingId();
    state.listingTitle = getCurrentListingTitle();
    state.listingUrl = location.href;
    state.detectedPrice = extractPriceFromPage();

    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(
      {
        type: "BRANCH_HUNTER_LISTING",
        payload: {
          id: state.listingId,
          title: state.listingTitle,
          url: state.listingUrl,
          price: state.detectedPrice,
        },
      },
      () => void chrome.runtime.lastError,
    );
  }

  async function buildCalculationContext(elements, options = {}) {
    const shouldRefreshMarketplace =
      options.refreshMarketplace === true || !state.marketplaceDataCache;
    const manualMarketplace = readManualMarketplaceValues();
    const operation = readOperationValues(elements);
    let marketplace = state.marketplaceDataCache;

    if (shouldRefreshMarketplace) {
      marketplace = await globalThis.BranchHunterMarketplaceService.getMarketplaceDynamicData({
        listingId: state.listingId,
        manualFallback: manualMarketplace,
      });
      state.marketplaceDataCache = marketplace;
    }

    return { marketplace, operation, manualMarketplace };
  }

  async function refreshAndCompute(elements, shouldPersist = true, options = {}) {
    const context = await buildCalculationContext(elements, options);
    writeMarketplaceDynamicSection(elements, context.marketplace);
    const result = globalThis.BranchHunterCalculator.calculateHybridResult({
      marketplace: context.marketplace,
      operation: context.operation,
    });
    updateResultUI(elements, result);

    if (shouldPersist) {
      await globalThis.BranchHunterStorage.saveListingState(state.listingId, {
        manualMarketplace: context.manualMarketplace,
        operation: context.operation,
      });
      scheduleRemoteCostSync(context.operation.productCost);
    }
  }

  function scheduleRemoteCostSync(productCost) {
    if (state.costSyncDebounce) clearTimeout(state.costSyncDebounce);
    state.costSyncDebounce = setTimeout(() => {
      void syncProductCostToPlatform(productCost);
    }, 700);
  }

  async function syncProductCostToPlatform(productCost) {
    if (!state.syncConfig.enabled) return;
    if (!state.syncConfig.apiBaseUrl || !state.syncConfig.apiKey) return;
    if (!state.listingId || state.listingId === "unknown-item") return;
    if (!Number.isFinite(productCost) || productCost <= 0) return;

    const endpoint = `${state.syncConfig.apiBaseUrl.replace(/\/+$/, "")}/api/branch-hunter/cost`;
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-branch-hunter-key": state.syncConfig.apiKey,
        },
        body: JSON.stringify({
          mlItemId: state.listingId,
          unitCost: productCost,
        }),
      });
    } catch {
      // Keep calculator smooth even if remote sync fails.
    }
  }

  function setOperationInputs(elements, values) {
    elements.productCost.value = String(values.productCost ?? 0);
    elements.taxPercent.value = String(values.taxPercent ?? 0);
  }

  async function hydrateInputs() {
    const elements = getElements();
    if (!elements) return;

    const { getSettings, getListingState } = globalThis.BranchHunterStorage;
    const settings = await getSettings();
    state.manualSaleFeePercentFallback = Number(settings.manualSaleFeePercentFallback ?? 16);
    state.syncConfig = {
      enabled: Boolean(settings.sync?.enabled),
      apiBaseUrl: String(settings.sync?.apiBaseUrl || ""),
      apiKey: String(settings.sync?.apiKey || ""),
    };
    const saved = await getListingState(state.listingId);

    setOperationInputs(elements, {
      ...settings.defaults,
      ...(saved?.operation || {}),
    });

    await refreshAndCompute(elements, false, { refreshMarketplace: true });
  }

  function bindEvents() {
    const elements = getElements();
    if (!elements) return;

    async function recalcAndPersist() {
      await refreshAndCompute(elements, true);
    }

    const inputFields = [
      elements.productCost,
      elements.taxPercent,
    ];

    for (const input of inputFields) {
      input.addEventListener("input", () => {
        void recalcAndPersist();
      });
    }

    elements.syncDynamic.addEventListener("click", async () => {
      await syncListingContext();
      await refreshAndCompute(elements, true, { refreshMarketplace: true });
    });

    elements.reset.addEventListener("click", async () => {
      const { getSettings } = globalThis.BranchHunterStorage;
      const settings = await getSettings();
      state.manualSaleFeePercentFallback = Number(settings.manualSaleFeePercentFallback ?? 16);
      state.syncConfig = {
        enabled: Boolean(settings.sync?.enabled),
        apiBaseUrl: String(settings.sync?.apiBaseUrl || ""),
        apiKey: String(settings.sync?.apiKey || ""),
      };

      setOperationInputs(elements, {
        ...settings.defaults,
      });
      await recalcAndPersist();
    });
  }

  function mountPanel() {
    const anchorResult = globalThis.BranchHunterPageUtils.findBestAnchor();
    const fallbackNode =
      document.querySelector("[data-testid='buy-box-container']") ||
      document.querySelector(".ui-pdp-container__col.col-2") ||
      document.querySelector(".ui-pdp-right-column");
    const resolvedAnchor = anchorResult?.node
      ? anchorResult
      : fallbackNode
        ? { node: fallbackNode, mode: "after" }
        : null;
    if (!resolvedAnchor?.node) {
      logDebug("Anchor nao encontrado no momento.");
      return false;
    }

    const existingHost = document.getElementById(PANEL_HOST_ID);
    if (existingHost) {
      state.host = existingHost;
      state.shadowRoot = existingHost.shadowRoot;
      return true;
    }

    const host = document.createElement("div");
    host.id = PANEL_HOST_ID;
    host.style.display = "block";
    host.style.width = "100%";
    host.style.marginTop = "12px";
    host.style.marginBottom = "12px";

    const inBuyColumn = Boolean(
      resolvedAnchor.node.closest?.(".ui-pdp-container__col.col-2") ||
        resolvedAnchor.node.matches?.("[data-testid='buy-box-container']"),
    );
    if (inBuyColumn) {
      host.style.position = "sticky";
      host.style.top = "12px";
      host.style.zIndex = "10";
    }

    if (resolvedAnchor.mode === "before") {
      resolvedAnchor.node.parentNode?.insertBefore(host, resolvedAnchor.node);
    } else if (resolvedAnchor.mode === "after") {
      resolvedAnchor.node.parentNode?.insertBefore(host, resolvedAnchor.node.nextSibling);
    } else if (resolvedAnchor.mode === "prepend") {
      resolvedAnchor.node.prepend(host);
    } else {
      resolvedAnchor.node.append(host);
    }

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = buildPanelHTML();
    state.host = host;
    state.shadowRoot = shadow;
    return true;
  }

  async function renderOrRefreshPanel() {
    if (!isMlProductPage()) return;

    const mounted = mountPanel();
    if (!mounted || !state.shadowRoot) return;

    await syncListingContext();
    state.marketplaceDataCache = null;

    if (!state.isInitialized) {
      await hydrateInputs();
      bindEvents();
      state.isInitialized = true;
      logDebug("Painel injetado com sucesso.");
      return;
    }

    const elements = getElements();
    if (!elements) return;

    await refreshAndCompute(elements, false, { refreshMarketplace: false });
  }

  function scheduleRefresh() {
    if (state.renderDebounce) clearTimeout(state.renderDebounce);
    state.renderDebounce = setTimeout(() => {
      void renderOrRefreshPanel();
    }, 140);
  }

  function setupDomObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(() => {
      let mustRefresh = false;
      if (state.lastUrl !== location.href) {
        state.lastUrl = location.href;
        state.isInitialized = false;
        state.marketplaceDataCache = null;
        mustRefresh = true;
      }
      const hostGone = state.host && !document.body.contains(state.host);
      if (hostGone) {
        state.host = null;
        state.shadowRoot = null;
        state.isInitialized = false;
        state.marketplaceDataCache = null;
        mustRefresh = true;
      }
      if (!state.host) {
        mustRefresh = true;
      }
      if (mustRefresh) {
        scheduleRefresh();
      }
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  async function bootstrap() {
    if (!isMlProductPage()) return;
    const { getSettings } = globalThis.BranchHunterStorage;
    const settings = await getSettings();
    if (!settings.autoInjectEnabled) return;

    await renderOrRefreshPanel();
    setupDomObserver();
  }

  void bootstrap();
})();
