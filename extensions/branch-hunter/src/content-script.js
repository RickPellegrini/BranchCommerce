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
        .source-chip {
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 11px;
          background: #ffffff;
          color: #334155;
          text-transform: capitalize;
        }
        .source-chip.real {
          border-color: #86efac;
          background: #dcfce7;
          color: #166534;
        }
        .source-chip.estimated {
          border-color: #93c5fd;
          background: #dbeafe;
          color: #1d4ed8;
        }
        .source-chip.fallback {
          border-color: #fcd34d;
          background: #fef3c7;
          color: #92400e;
        }
        .result-warn {
          color: #92400e;
          font-size: 11px;
          margin: 0;
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

        <div class="section">
          <div id="bh-listing-title" class="listing-title">Anuncio carregado</div>
          <div id="bh-listing-url" class="listing-url"></div>
        </div>

        <div class="section section-dynamic">
          <div class="section-title-row">
            <span class="section-icon" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <p class="section-title">Dados dinamicos Mercado Livre</p>
          </div>
          <div class="dynamic-row"><span>Preco anuncio</span><div><strong id="bh-dyn-sale-price">--</strong> <small id="bh-src-sale-price">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span>Tipo anuncio</span><div><strong id="bh-dyn-listing-type">--</strong> <small id="bh-src-listing-type">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span>Taxa ML</span><div><strong id="bh-dyn-fee">--</strong> <small id="bh-src-fee">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span>Categoria</span><div><strong id="bh-dyn-category">--</strong></div></div>
          <div class="dynamic-row"><span>Frete estimado</span><div><strong id="bh-dyn-shipping-estimated">--</strong> <small id="bh-src-shipping-estimated">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span>Frete real</span><div><strong id="bh-dyn-shipping-real">--</strong> <small id="bh-src-shipping-real">(indisponivel)</small></div></div>
          <div class="dynamic-row"><span>Modo envio</span><div><strong id="bh-dyn-shipping-mode">--</strong></div></div>
        </div>

        <div class="section section-manual grid">
          <div class="section-title-row">
            <span class="section-icon" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <p class="section-title">Fallbacks manuais (marketplace)</p>
          </div>
          <label>Preco manual (R$)<input id="bh-manual-sale-price" type="number" step="0.01" min="0"></label>
          <label>
            Tipo manual (opcional)
            <select id="bh-manual-listing-type">
              <option value="">Selecionar</option>
              <option value="classico">Classico</option>
              <option value="premium">Premium</option>
            </select>
          </label>
          <label>Taxa ML manual (%)<input id="bh-manual-sale-fee-percent" type="number" step="0.01" min="0"></label>
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
          <div class="grid-2">
            <label>Ads (%)<input id="bh-ads-percent" type="number" step="0.01" min="0"></label>
            <label>Risco (%)<input id="bh-risk-percent" type="number" step="0.01" min="0"></label>
          </div>
          <div class="grid-2">
            <label>Embalagem (R$)<input id="bh-packaging-cost" type="number" step="0.01" min="0"></label>
            <label>Outros fixos (R$)<input id="bh-other-fixed-costs" type="number" step="0.01" min="0"></label>
          </div>
          <label>Frete fallback (R$)<input id="bh-shipping-fallback" type="number" step="0.01" min="0"></label>
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
          <div class="result-row"><span>Receita bruta</span><strong id="bh-result-gross">R$ 0,00</strong></div>
          <div class="result-row"><span>Taxa marketplace</span><strong id="bh-result-fee">R$ 0,00</strong></div>
          <div class="result-row"><span>Impostos</span><strong id="bh-result-tax">R$ 0,00</strong></div>
          <div class="result-row"><span>Ads</span><strong id="bh-result-ads">R$ 0,00</strong></div>
          <div class="result-row"><span>Risco</span><strong id="bh-result-risk">R$ 0,00</strong></div>
          <div class="result-row"><span>Frete usado</span><strong id="bh-result-shipping">R$ 0,00</strong></div>
          <div class="result-row"><span>Origem do frete</span><strong id="bh-result-shipping-source" class="source-chip fallback">fallback</strong></div>
          <div class="result-row"><span>Total custos</span><strong id="bh-result-total-costs">R$ 0,00</strong></div>
          <div id="bh-profit-row" class="result-row result-profit"><span>Lucro liquido</span><strong id="bh-result-profit">R$ 0,00</strong></div>
          <div class="result-row"><span>Margem</span><strong id="bh-result-margin">0,00%</strong></div>
          <p id="bh-result-warning" class="result-warn"></p>
        </div>
      </section>
    `;
  }

  function getElements() {
    if (!state.shadowRoot) return null;
    const $ = (id) => state.shadowRoot.getElementById(id);
    return {
      listingTitle: $("bh-listing-title"),
      listingUrl: $("bh-listing-url"),
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
      manualSalePrice: $("bh-manual-sale-price"),
      manualListingType: $("bh-manual-listing-type"),
      manualSaleFeePercent: $("bh-manual-sale-fee-percent"),
      productCost: $("bh-product-cost"),
      taxPercent: $("bh-tax-percent"),
      adsPercent: $("bh-ads-percent"),
      riskPercent: $("bh-risk-percent"),
      packagingCost: $("bh-packaging-cost"),
      otherFixedCosts: $("bh-other-fixed-costs"),
      shippingFallback: $("bh-shipping-fallback"),
      syncDynamic: $("bh-sync-dynamic"),
      reset: $("bh-reset"),
      resultGross: $("bh-result-gross"),
      resultFee: $("bh-result-fee"),
      resultTax: $("bh-result-tax"),
      resultAds: $("bh-result-ads"),
      resultRisk: $("bh-result-risk"),
      resultShipping: $("bh-result-shipping"),
      resultShippingSource: $("bh-result-shipping-source"),
      resultTotalCosts: $("bh-result-total-costs"),
      profitRow: $("bh-profit-row"),
      resultProfit: $("bh-result-profit"),
      resultMargin: $("bh-result-margin"),
      resultWarning: $("bh-result-warning"),
    };
  }

  function readManualMarketplaceValues(elements) {
    return {
      salePrice: elements.manualSalePrice.value === "" ? null : toNumber(elements.manualSalePrice.value, null),
      listingType: elements.manualListingType.value || null,
      saleFeePercent:
        elements.manualSaleFeePercent.value === ""
          ? null
          : toNumber(elements.manualSaleFeePercent.value, null),
    };
  }

  function readOperationValues(elements) {
    return {
      productCost: toNumber(elements.productCost.value, 0),
      taxPercent: toNumber(elements.taxPercent.value, 0),
      adsPercent: toNumber(elements.adsPercent.value, 0),
      packagingCost: toNumber(elements.packagingCost.value, 0),
      otherFixedCosts: toNumber(elements.otherFixedCosts.value, 0),
      riskPercent: toNumber(elements.riskPercent.value, 0),
      shippingFallback: toNumber(elements.shippingFallback.value, 0),
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
    elements.resultAds.textContent = formatMoney(calculationResult.adsAmount);
    elements.resultRisk.textContent = formatMoney(calculationResult.riskAmount);
    elements.resultShipping.textContent = formatMoney(calculationResult.shippingCostUsed);
    elements.resultShippingSource.textContent = calculationResult.shippingCostSource;
    elements.resultShippingSource.className = `source-chip ${calculationResult.shippingCostSource}`;
    elements.resultTotalCosts.textContent = formatMoney(calculationResult.totalCosts);
    elements.resultProfit.textContent = formatMoney(calculationResult.netProfit);
    elements.resultMargin.textContent = formatPercent(calculationResult.netMarginPercent);
    if (calculationResult.netProfit < 0) {
      elements.profitRow.classList.add("negative");
    } else {
      elements.profitRow.classList.remove("negative");
    }
    elements.resultWarning.textContent =
      calculationResult.shippingCostSource === "fallback"
        ? "Frete dinamico nao disponivel. Usando fallback manual."
        : "";
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

  async function buildCalculationContext(elements) {
    const manualMarketplace = readManualMarketplaceValues(elements);
    const operation = readOperationValues(elements);
    const marketplace = await globalThis.BranchHunterMarketplaceService.getMarketplaceDynamicData({
      listingId: state.listingId,
      manualFallback: manualMarketplace,
    });

    return { marketplace, operation, manualMarketplace };
  }

  async function refreshAndCompute(elements, shouldPersist = true) {
    const context = await buildCalculationContext(elements);
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
    }
  }

  function setOperationInputs(elements, values) {
    elements.productCost.value = String(values.productCost ?? 0);
    elements.taxPercent.value = String(values.taxPercent ?? 0);
    elements.adsPercent.value = String(values.adsPercent ?? 0);
    elements.packagingCost.value = String(values.packagingCost ?? 0);
    elements.otherFixedCosts.value = String(values.otherFixedCosts ?? 0);
    elements.riskPercent.value = String(values.riskPercent ?? 0);
    elements.shippingFallback.value = String(values.shippingFallback ?? 0);
  }

  function setManualMarketplaceInputs(elements, values) {
    elements.manualSalePrice.value =
      values.salePrice === null || values.salePrice === undefined ? "" : String(values.salePrice);
    elements.manualListingType.value = values.listingType || "";
    elements.manualSaleFeePercent.value =
      values.saleFeePercent === null || values.saleFeePercent === undefined
        ? ""
        : String(values.saleFeePercent);
  }

  async function hydrateInputs() {
    const elements = getElements();
    if (!elements) return;

    const { getSettings, getListingState } = globalThis.BranchHunterStorage;
    const settings = await getSettings();
    const saved = await getListingState(state.listingId);

    setManualMarketplaceInputs(elements, {
      salePrice: saved?.manualMarketplace?.salePrice ?? state.detectedPrice ?? "",
      listingType: saved?.manualMarketplace?.listingType ?? "",
      saleFeePercent:
        saved?.manualMarketplace?.saleFeePercent ?? settings.manualSaleFeePercentFallback ?? 16,
    });

    setOperationInputs(elements, {
      ...settings.defaults,
      ...(saved?.operation || {}),
    });

    elements.listingTitle.textContent = state.listingTitle;
    elements.listingUrl.textContent = state.listingUrl;
    await refreshAndCompute(elements, false);
  }

  function bindEvents() {
    const elements = getElements();
    if (!elements) return;

    async function recalcAndPersist() {
      await refreshAndCompute(elements, true);
    }

    const inputFields = [
      elements.manualSalePrice,
      elements.manualListingType,
      elements.manualSaleFeePercent,
      elements.productCost,
      elements.taxPercent,
      elements.adsPercent,
      elements.riskPercent,
      elements.packagingCost,
      elements.otherFixedCosts,
      elements.shippingFallback,
    ];

    for (const input of inputFields) {
      input.addEventListener("input", () => {
        void recalcAndPersist();
      });
    }

    elements.syncDynamic.addEventListener("click", async () => {
      await syncListingContext();
      await recalcAndPersist();
    });

    elements.reset.addEventListener("click", async () => {
      const { getSettings } = globalThis.BranchHunterStorage;
      const settings = await getSettings();

      setManualMarketplaceInputs(elements, {
        salePrice: state.detectedPrice ?? "",
        listingType: "",
        saleFeePercent: settings.manualSaleFeePercentFallback ?? 16,
      });
      setOperationInputs(elements, {
        ...settings.defaults,
      });
      await recalcAndPersist();
    });
  }

  function mountPanel() {
    const anchorResult = globalThis.BranchHunterPageUtils.findBestAnchor();
    if (!anchorResult?.node) {
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
    host.style.width = "100%";
    host.style.marginTop = "12px";
    host.style.marginBottom = "12px";

    if (anchorResult.mode === "before") {
      anchorResult.node.parentNode?.insertBefore(host, anchorResult.node);
    } else if (anchorResult.mode === "after") {
      anchorResult.node.parentNode?.insertBefore(host, anchorResult.node.nextSibling);
    } else if (anchorResult.mode === "prepend") {
      anchorResult.node.prepend(host);
    } else {
      anchorResult.node.append(host);
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

    if (!state.isInitialized) {
      await hydrateInputs();
      bindEvents();
      state.isInitialized = true;
      logDebug("Painel injetado com sucesso.");
      return;
    }

    const elements = getElements();
    if (!elements) return;
    elements.listingTitle.textContent = state.listingTitle;
    elements.listingUrl.textContent = state.listingUrl;

    if (!elements.manualSalePrice.value && typeof state.detectedPrice === "number") {
      elements.manualSalePrice.value = String(state.detectedPrice);
      await refreshAndCompute(elements, false);
    }
  }

  function scheduleRefresh() {
    if (state.renderDebounce) clearTimeout(state.renderDebounce);
    state.renderDebounce = setTimeout(() => {
      void renderOrRefreshPanel();
    }, 400);
  }

  function setupDomObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(() => {
      if (state.lastUrl !== location.href) {
        state.lastUrl = location.href;
        state.isInitialized = false;
      }
      const hostGone = state.host && !document.body.contains(state.host);
      if (hostGone) {
        state.host = null;
        state.shadowRoot = null;
        state.isInitialized = false;
      }
      scheduleRefresh();
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
