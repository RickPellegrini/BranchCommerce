;(() => {
  const PANEL_HOST_ID = "branch-hunter-inline-host"
  const BRAND_LOGO_URL = "https://branch-commerce.vercel.app/branch_logo.jpeg"
  const DEBUG = false
  const LISTING_TYPE_FEES = { premium: 16, gold_special: 12 }
  const BADGE_ATTR = "data-bh-processed"
  const PUBLIC_STOCK_RETRY_TIMEOUT_MS = 3200
  const PUBLIC_STOCK_RETRY_INTERVAL_MS = 160
  const APP_WEB_BASE_URL = "https://branchcommercehub.com"

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
    shippingConfig: {
      freeShippingMinPrice: 79,
      freeShippingSubsidyPercent: 50,
      defaultShippingCost: 12,
    },
    costSyncDebounce: null,
    marketplaceDataCache: null,
    serpEnrichDebounce: null,
  }

  function logDebug(message, payload) {
    if (!DEBUG) return
    console.log(`[BranchHunter] ${message}`, payload || "")
  }

  function isMlProductPage() {
    return /MLB[-]?\d+/i.test(location.href)
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  function formatPercent(value) {
    return `${value.toFixed(2)}%`
  }

  function formatSource(source) {
    if (!source) return "indisponivel"
    if (source === "api") return "api"
    if (source === "page") return "pagina"
    if (source === "manual") return "manual"
    return "derivado"
  }

  function formatNullableMoney(value) {
    return typeof value === "number" && Number.isFinite(value) ? formatMoney(value) : "--"
  }

  function parsePublicStockText(text) {
    const normalized = String(text || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!normalized) return null

    const lower = normalized.toLowerCase()
    if (lower.includes("último") || lower.includes("ultimo")) {
      return { stockText: normalized, stockMin: 1 }
    }

    const plusMatch = normalized.match(/\+\s*(\d+)/)
    if (plusMatch) {
      return { stockText: normalized, stockMin: Number(plusMatch[1]) }
    }

    const unitMatch = normalized.match(
      /(\d+)\s+(?:unidade|unidades|disponível|disponiveis|disponíveis)/i,
    )
    if (unitMatch) {
      return { stockText: normalized, stockMin: Number(unitMatch[1]) }
    }

    return { stockText: normalized, stockMin: null }
  }

  function detectBlockedPage() {
    const text = document.body?.innerText?.toLowerCase() || ""
    return (
      text.includes("captcha") ||
      text.includes("não foi possível acessar") ||
      text.includes("nao foi possivel acessar") ||
      text.includes("verifique que você não é um robô") ||
      text.includes("verifique que voce nao e um robo")
    )
  }

  function collectPublicStockFromPage(expectedItemId) {
    if (detectBlockedPage()) {
      return {
        ok: false,
        status: "blocked",
        itemId: expectedItemId,
        finalUrl: location.href,
        error: "Bloqueado pelo ML.",
      }
    }

    const selectors = [
      ".ui-pdp-buybox__quantity__available",
      "#buybox_available_quantity .ui-pdp-buybox__quantity__available",
      "#buybox_available_quantity [aria-label]",
      ".ui-pdp-buybox__quantity__trigger",
      "[class*='quantity__available']",
    ]

    for (const selector of selectors) {
      const node = document.querySelector(selector)
      const parsed = parsePublicStockText(node?.textContent)
      if (parsed) {
        return {
          ok: true,
          status: "success",
          itemId: expectedItemId,
          finalUrl: location.href,
          source: "extension_page",
          ...parsed,
        }
      }
    }

    const buybox =
      document.querySelector("#buybox_available_quantity") ||
      document.querySelector(".ui-pdp-buybox") ||
      document.querySelector("[data-testid='buy-box-container']")
    const lines = (buybox?.innerText || document.body?.innerText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    const stockLine = lines.find(
      (line) =>
        /\+\s*\d+/.test(line) ||
        /[uú]ltimo/i.test(line) ||
        /(\d+)\s+(?:unidade|unidades|disponível|disponiveis|disponíveis)/i.test(line),
    )
    const parsed = parsePublicStockText(stockLine)
    if (parsed) {
      return {
        ok: true,
        status: "success",
        itemId: expectedItemId,
        finalUrl: location.href,
        source: "extension_page",
        ...parsed,
      }
    }

    return {
      ok: false,
      status: "unavailable",
      itemId: expectedItemId,
      finalUrl: location.href,
      error: "Estoque nao encontrado na pagina.",
    }
  }

  async function collectPublicStockWithRetry(expectedItemId) {
    const deadline = Date.now() + PUBLIC_STOCK_RETRY_TIMEOUT_MS
    let lastResult = collectPublicStockFromPage(expectedItemId)

    while (Date.now() < deadline) {
      if (lastResult.ok || lastResult.status === "blocked") return lastResult
      await new Promise((resolve) => setTimeout(resolve, PUBLIC_STOCK_RETRY_INTERVAL_MS))
      lastResult = collectPublicStockFromPage(expectedItemId)
    }

    return lastResult
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "BRANCH_HUNTER_COLLECT_PUBLIC_STOCK") return
    collectPublicStockWithRetry(String(message.itemId || state.listingId || "")).then(sendResponse)
    return true
  })

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
          border-radius: 12px;
          padding: 10px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
          width: 100%;
          max-width: 320px;
          display: grid;
          gap: 8px;
        }
        .section {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .section-operation { border-color: #c7d2fe; background: #f8f9ff; }
        .section-adv-inline { border-color: #c7d2fe; background: #f8f9ff; padding: 7px; gap: 6px; }
        .section-centralize { border-color: #fdba74; background: #fff7ed; }
        .section-result { border-color: #bbf7d0; background: #f0fdf4; }
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
        .title { font-size: 15px; font-weight: 700; margin: 0; }
        .subtitle { margin: 0; font-size: 11px; color: #6b7280; }
        .chip {
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          color: #374151;
          background: #f9fafb;
        }
        .section-title-row { display: flex; align-items: center; gap: 6px; }
        .section-icon {
          width: 18px; height: 18px; border-radius: 6px;
          display: inline-flex; align-items: center; justify-content: center;
          color: #0f172a; background: #e2e8f0;
        }
        .section-title { margin: 0; font-size: 12px; font-weight: 700; color: #111827; }
        .subtle { font-size: 12px; color: #374151; }
        .grid { display: grid; gap: 8px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .freight-box {
          border: 1px solid #bfdbfe; background: #f8fbff;
          border-radius: 8px; padding: 5px; display: grid; gap: 4px;
        }
        .freight-compact-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
        }
        .freight-card {
          border: 1px solid #d1d5db; border-radius: 6px;
          background: #ffffff; padding: 5px 6px; display: grid; gap: 3px;
        }
        .freight-card.green { border-color: #bbf7d0; background: #f0fdf4; }
        .freight-card.blue { border-color: #bfdbfe; background: #eff6ff; }
        .freight-title { font-size: 10px; font-weight: 700; color: #111827; margin: 0; }
        .freight-hint-tiny { font-size: 8px; line-height: 1.2; color: #4b5563; margin: 0; }
        .switch-min { font-size: 10px; }
        .switch-min input { width: 14px; height: 14px; }
        .section-centralize { padding: 8px; }
        .centralize-body { display: grid; gap: 4px; }
        .centralize-body.muted { opacity: 0.5; }
        .switch-row {
          display: flex; align-items: center; justify-content: space-between; gap: 4px;
        }
        .switch-inline {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; color: #374151;
        }
        .switch-green input { accent-color: #16a34a; }
        .switch-blue input { accent-color: #2563eb; }
        .freight-hint { font-size: 8px; line-height: 1.2; color: #4b5563; }
        label { display: grid; gap: 4px; font-size: 12px; color: #374151; }
        input {
          width: 100%; border: 1px solid #d1d5db; border-radius: 8px;
          padding: 8px 9px; font-size: 13px; background: #fff; color: #111827;
        }
        input:focus { outline: 2px solid #bfdbfe; border-color: #60a5fa; }
        select {
          width: 100%; border: 1px solid #d1d5db; border-radius: 8px;
          padding: 8px 9px; font-size: 13px; background: #fff; color: #111827;
        }
        .dynamic-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; }
        .row-label { display: inline-flex; align-items: center; gap: 5px; }
        .row-icon { width: 12px; height: 12px; color: #64748b; }
        .dynamic-row strong { color: #111827; font-size: 12px; }
        .dynamic-row small { color: #6b7280; font-size: 11px; }
        .actions { display: grid; grid-template-columns: 1fr; gap: 8px; }
        button {
          border: 0; border-radius: 8px; padding: 8px 10px;
          font-size: 12px; font-weight: 600; cursor: pointer;
        }
        .btn-secondary { background: #e5e7eb; color: #374151; }
        .btn-secondary:hover { background: #d1d5db; }
        .btn-toggle {
          background: none; border: 1px solid #d1d5db; border-radius: 8px;
          padding: 6px 10px; font-size: 11px; font-weight: 600;
          color: #6b7280; cursor: pointer; width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 4px;
          transition: background 0.15s;
        }
        .btn-toggle:hover { background: #f1f5f9; }
        .btn-toggle svg { transition: transform 0.2s; }
        .btn-toggle.expanded svg { transform: rotate(180deg); }
        .collapsible { display: none; }
        .collapsible.open { display: grid; gap: 8px; }
        .result-title { margin: 0; font-size: 12px; font-weight: 700; color: #111827; }
        .result-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; font-size: 12px;
        }
        .result-row strong { font-size: 13px; color: #111827; }
        .result-row.critical strong { font-size: 16px; font-weight: 800; }
        .result-row.total strong { color: #1e40af; }
        .result-profit strong { color: #16a34a; }
        .result-profit.negative strong { color: #dc2626; }
        .compact-input-row {
          display: flex; align-items: flex-end; gap: 8px;
        }
        .compact-input-row label { flex: 1; }
        .compact-price-row {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 12px; padding: 6px 0;
        }
        .compact-price-row strong { font-size: 14px; color: #111827; }
        .separator { height: 1px; background: #e5e7eb; margin: 1px 0; }
      </style>
      <section class="panel">
        <header class="header">
          <div class="header-main">
            <img class="brand-logo" src="${BRAND_LOGO_URL}" alt="Branch Commerce logo" />
            <div>
              <p class="title">Branch Hunter</p>
              <p class="subtitle">Calculadora ML</p>
            </div>
          </div>
          <span id="bh-header-chip" class="chip">Clássico</span>
        </header>

        <div style="display:grid;gap:8px;">
          <div class="compact-price-row">
            <span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Preco anuncio</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <strong id="bh-dyn-sale-price" style="font-size:14px;">--</strong>
              <small id="bh-src-sale-price" style="color:#6b7280;font-size:10px;">(indisponivel)</small>
              <label class="switch-inline switch-blue" style="margin-left:2px;font-size:11px;"><input id="bh-sale-price-manual-toggle" type="checkbox"> Manual</label>
            </div>
          </div>
          <div id="bh-sale-price-manual-wrap" style="display:none;">
            <label>Preco do anuncio (R$)<input id="bh-sale-price-manual-input" type="number" step="0.01" min="0" value="0"></label>
          </div>
          <div class="compact-price-row">
            <span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Tipo anuncio</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <select id="bh-listing-type-select" style="width:auto;padding:4px 8px;font-size:12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#111827;cursor:pointer;">
                <option value="gold_special">Clássico</option>
                <option value="premium">Premium</option>
              </select>
              <small id="bh-listing-type-fee" style="color:#6b7280;font-size:10px;">Taxa: --</small>
            </div>
          </div>
          <div class="compact-input-row">
            <label>Custo produto (R$)<input id="bh-product-cost" type="number" step="0.01" min="0"></label>
          </div>
          <div class="actions">
            <button id="bh-open-catalog-analysis" class="btn-secondary" type="button">Visualizar catalogo</button>
          </div>
        </div>

        <div class="separator"></div>

        <div class="section section-result">
          <div id="bh-profit-row" class="result-row result-profit critical"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 17l6-6 4 4 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Lucro liquido</span><strong id="bh-result-profit">R$ 0,00</strong></div>
          <div class="result-row critical"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Margem</span><strong id="bh-result-margin">0,00%</strong></div>
          <div class="result-row critical total"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Total custos</span><strong id="bh-result-total-costs">R$ 0,00</strong></div>
        </div>

        <button id="bh-toggle-details" class="btn-toggle" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span id="bh-toggle-label">Ver mais</span>
        </button>

        <div id="bh-details" class="collapsible">
          <div class="section section-adv-inline">
            <div class="section-title-row">
              <span class="section-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 6h18v12H3zM8 10h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
              <p class="section-title">Frete</p>
            </div>
            <div class="freight-box">
              <div class="freight-compact-grid">
                <div class="freight-card green">
                  <div class="switch-row">
                    <div style="min-width:0">
                      <p class="freight-title">Gratis (ML)</p>
                      <p id="bh-free-shipping-hint" class="freight-hint-tiny">A partir R$ 79</p>
                    </div>
                    <label class="switch-inline switch-green switch-min" title="Modo frete grátis do ML">
                      <input id="bh-free-shipping-toggle" type="checkbox" checked aria-label="Frete grátis ML" />
                    </label>
                  </div>
                </div>
                <div id="bh-custom-shipping-card" class="freight-card blue">
                  <div class="switch-row">
                    <div style="min-width:0">
                      <p class="freight-title">Custom</p>
                      <p id="bh-custom-shipping-hint" class="freight-hint-tiny">Padrao R$ 12</p>
                    </div>
                    <label class="switch-inline switch-blue switch-min" title="Frete manual">
                      <input id="bh-shipping-manual-toggle" type="checkbox" aria-label="Frete manual" />
                    </label>
                  </div>
                  <div id="bh-shipping-fallback-wrap" style="display:none;">
                    <input id="bh-shipping-fallback" type="number" step="0.01" min="0" value="12" style="padding:4px 6px;font-size:12px; border-radius:4px" title="Valor do frete (R$)">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="section section-centralize">
          <div class="section-title-row">
            <span class="section-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
            <p class="section-title">Centralize / Full</p>
          </div>
          <div id="bh-centralize-body" class="centralize-body">
            <div class="dynamic-row" style="font-size:11px"><span>Envio</span><strong>R$ 5,00</strong></div>
            <div class="dynamic-row" style="font-size:11px"><span>Embalagem</span><strong>R$ 1,50</strong></div>
          </div>
          <div class="freight-card">
            <div class="switch-row">
              <p class="section-title">Centralize</p>
              <label class="switch-inline switch-blue">
                <input id="bh-centralize-toggle" type="checkbox" checked> Ativo
              </label>
            </div>
          </div>
          <div class="freight-card">
            <div class="switch-row">
              <p class="section-title">Full</p>
              <label class="switch-inline switch-green">
                <input id="bh-full-toggle" type="checkbox"> Ativo
              </label>
            </div>
            <div id="bh-full-config-wrap" style="display:none; margin-top:6px; gap:6px;">
              <label>Qtd enviada ao Full
                <input id="bh-full-shipment-units" type="number" step="1" min="1" value="100" style="padding:4px 6px;font-size:12px; border-radius:4px">
              </label>
              <label>Custo coleta Full (R$)
                <input id="bh-full-collection-cost" type="number" step="0.01" min="0" value="100" style="padding:4px 6px;font-size:12px; border-radius:4px">
              </label>
            </div>
          </div>
          </div>

          <div style="display:grid;gap:6px;">
            <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Receita bruta</span><strong id="bh-result-gross">R$ 0,00</strong></div>
            <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M3 17h18M5 17l2-6h10l2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Frete usado</span><strong id="bh-result-shipping">R$ 0,00</strong></div>
            <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Centralize fixo</span><strong id="bh-result-centralize">R$ 0,00</strong></div>
            <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Custo Full</span><strong id="bh-result-full">R$ 0,00</strong></div>
            <div class="result-row"><span class="row-label"><svg class="row-icon" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Coleta/un</span><strong id="bh-result-full-collection-unit">R$ 0,00</strong></div>
          </div>
        </div>
      </section>
    `
  }

  function getElements() {
    if (!state.shadowRoot) return null
    const $ = (id) => state.shadowRoot.getElementById(id)
    return {
      dynSalePrice: $("bh-dyn-sale-price"),
      srcSalePrice: $("bh-src-sale-price"),
      salePriceManualToggle: $("bh-sale-price-manual-toggle"),
      salePriceManualWrap: $("bh-sale-price-manual-wrap"),
      salePriceManualInput: $("bh-sale-price-manual-input"),
      productCost: $("bh-product-cost"),
      centralizeToggle: $("bh-centralize-toggle"),
      centralizeBody: $("bh-centralize-body"),
      freeShippingToggle: $("bh-free-shipping-toggle"),
      freeShippingHint: $("bh-free-shipping-hint"),
      shippingManualToggle: $("bh-shipping-manual-toggle"),
      customShippingHint: $("bh-custom-shipping-hint"),
      shippingFallbackWrap: $("bh-shipping-fallback-wrap"),
      shippingFallback: $("bh-shipping-fallback"),
      resultGross: $("bh-result-gross"),
      resultShipping: $("bh-result-shipping"),
      resultCentralize: $("bh-result-centralize"),
      resultFull: $("bh-result-full"),
      resultTotalCosts: $("bh-result-total-costs"),
      profitRow: $("bh-profit-row"),
      resultProfit: $("bh-result-profit"),
      resultMargin: $("bh-result-margin"),
      toggleDetails: $("bh-toggle-details"),
      toggleLabel: $("bh-toggle-label"),
      detailsPanel: $("bh-details"),
      listingTypeSelect: $("bh-listing-type-select"),
      listingTypeFee: $("bh-listing-type-fee"),
      headerChip: $("bh-header-chip"),
      centralizeToggle: $("bh-centralize-toggle"),
      fullToggle: $("bh-full-toggle"),
      fullConfigWrap: $("bh-full-config-wrap"),
      fullShipmentUnits: $("bh-full-shipment-units"),
      fullCollectionCost: $("bh-full-collection-cost"),
      resultFullCollectionUnit: $("bh-result-full-collection-unit"),
      openCatalogAnalysis: $("bh-open-catalog-analysis"),
    }
  }

  function applySalePriceUiState(elements) {
    const manual = Boolean(elements.salePriceManualToggle.checked)
    elements.salePriceManualWrap.style.display = manual ? "block" : "none"
    elements.salePriceManualInput.disabled = !manual
  }

  function readManualMarketplaceValues(elements) {
    const forceManualSalePrice = elements && Boolean(elements.salePriceManualToggle.checked)
    const manualSalePrice = forceManualSalePrice
      ? toNumber(elements.salePriceManualInput.value, 0)
      : null
    const selectedType = elements.listingTypeSelect?.value || "gold_special"
    return {
      salePrice: manualSalePrice,
      forceManualSalePrice,
      listingType: selectedType,
      forceListingType: true,
      saleFeePercent: LISTING_TYPE_FEES[selectedType] ?? state.manualSaleFeePercentFallback,
    }
  }

  function readOperationValues(elements) {
    return {
      productCost: toNumber(elements.productCost.value, 0),
      taxPercent: 0,
      adsPercent: 0,
      packagingCost: 0,
      otherFixedCosts: 0,
      riskPercent: 0,
      shippingFallback: toNumber(elements.shippingFallback.value, 0),
      forceManualShipping: Boolean(elements.shippingManualToggle.checked),
      freeShippingEnabled: Boolean(elements.freeShippingToggle.checked),
      freeShippingMinPrice: Number(state.shippingConfig.freeShippingMinPrice ?? 79),
      freeShippingSubsidyPercent: Number(state.shippingConfig.freeShippingSubsidyPercent ?? 50),
      defaultShippingCost: 12,
      centralizeEnabled: Boolean(elements.centralizeToggle.checked),
      fullEnabled: Boolean(elements.fullToggle.checked),
      fullShipmentUnits: toNumber(elements.fullShipmentUnits?.value, 100),
      fullCollectionCost: toNumber(elements.fullCollectionCost?.value, 100),
    }
  }

  function applyShippingUiState(elements) {
    const manual = Boolean(elements.shippingManualToggle.checked)
    elements.shippingFallback.disabled = !manual
    elements.shippingFallbackWrap.style.display = manual ? "block" : "none"
    const minP = formatMoney(Number(state.shippingConfig.freeShippingMinPrice ?? 79))
    if (elements.customShippingHint) {
      elements.customShippingHint.textContent = manual ? "Val. manual" : "Pad. R$ 12"
    }
    if (elements.freeShippingHint) {
      elements.freeShippingHint.textContent = `De ${minP}`
    }
    elements.freeShippingToggle.disabled = manual
  }

  function applyCentralizeUiState(elements) {
    if (!elements.centralizeBody) return
    const on = Boolean(elements.centralizeToggle?.checked)
    elements.centralizeBody.classList.toggle("muted", !on)
    if (elements.fullConfigWrap) {
      elements.fullConfigWrap.style.display = elements.fullToggle?.checked ? "grid" : "none"
    }
  }

  function writeMarketplaceDynamicSection(elements, marketplaceData) {
    elements.dynSalePrice.textContent = formatNullableMoney(marketplaceData.salePrice)
    elements.srcSalePrice.textContent = `(${formatSource(marketplaceData.source.salePrice)})`
    const feeLabel =
      marketplaceData.saleFeePercent !== null
        ? `${formatPercent(marketplaceData.saleFeePercent)}`
        : "--"
    elements.listingTypeFee.textContent = `Taxa: ${feeLabel}`
  }

  function updateResultUI(elements, calculationResult) {
    elements.resultGross.textContent = formatMoney(calculationResult.grossRevenue)
    elements.resultShipping.textContent = formatMoney(calculationResult.shippingCostUsed)
    elements.resultCentralize.textContent = formatMoney(calculationResult.centralizeFixedCosts)
    elements.resultFull.textContent = formatMoney(calculationResult.fullCosts || 0)
    if (elements.resultFullCollectionUnit) {
      elements.resultFullCollectionUnit.textContent = formatMoney(
        calculationResult.fullCollectionUnitCost || 0,
      )
    }
    elements.resultTotalCosts.textContent = formatMoney(calculationResult.totalCosts)
    elements.resultProfit.textContent = formatMoney(calculationResult.netProfit)
    elements.resultMargin.textContent = formatPercent(calculationResult.netMarginPercent)
    if (calculationResult.netProfit < 0) {
      elements.profitRow.classList.add("negative")
    } else {
      elements.profitRow.classList.remove("negative")
    }
  }

  async function syncListingContext() {
    const { getCurrentListingId, getCurrentListingTitle, extractPriceFromPage } =
      globalThis.BranchHunterPageUtils
    state.listingId = getCurrentListingId()
    state.listingTitle = getCurrentListingTitle()
    state.listingUrl = location.href
    state.detectedPrice = extractPriceFromPage()

    if (!chrome?.runtime?.id) return
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
    )
  }

  async function buildCalculationContext(elements, options = {}) {
    const shouldRefreshMarketplace =
      options.refreshMarketplace === true || !state.marketplaceDataCache
    const manualMarketplace = readManualMarketplaceValues(elements)
    const operation = readOperationValues(elements)
    let marketplace = state.marketplaceDataCache

    if (shouldRefreshMarketplace) {
      marketplace = await globalThis.BranchHunterMarketplaceService.getMarketplaceDynamicData({
        listingId: state.listingId,
        manualFallback: manualMarketplace,
      })
      state.marketplaceDataCache = marketplace
    }

    if (manualMarketplace.forceManualSalePrice) {
      marketplace = {
        ...marketplace,
        salePrice: manualMarketplace.salePrice,
        source: {
          ...(marketplace?.source || {}),
          salePrice: "manual",
        },
      }
    }

    if (manualMarketplace.forceListingType) {
      const typeLabel = manualMarketplace.listingType === "premium" ? "premium" : "gold_special"
      marketplace = {
        ...marketplace,
        listingType: typeLabel,
        saleFeePercent: manualMarketplace.saleFeePercent,
        saleFeeAmount: null,
        source: {
          ...(marketplace?.source || {}),
          listingType: "manual",
          saleFeePercent: "manual",
        },
      }
    }

    return { marketplace, operation, manualMarketplace }
  }

  async function refreshAndCompute(elements, shouldPersist = true, options = {}) {
    const context = await buildCalculationContext(elements, options)
    writeMarketplaceDynamicSection(elements, context.marketplace)
    const result = globalThis.BranchHunterCalculator.calculateHybridResult({
      marketplace: context.marketplace,
      operation: context.operation,
    })
    updateResultUI(elements, result)

    if (shouldPersist) {
      await globalThis.BranchHunterStorage.saveListingState(state.listingId, {
        manualMarketplace: context.manualMarketplace,
        operation: context.operation,
      })
      scheduleRemoteCostSync(context.operation.productCost)
    }
  }

  function scheduleRemoteCostSync(productCost) {
    if (state.costSyncDebounce) clearTimeout(state.costSyncDebounce)
    state.costSyncDebounce = setTimeout(() => {
      void syncProductCostToPlatform(productCost)
    }, 700)
  }

  async function syncProductCostToPlatform(productCost) {
    if (!state.syncConfig.enabled) return
    if (!state.syncConfig.apiBaseUrl || !state.syncConfig.apiKey) return
    if (!state.listingId || state.listingId === "unknown-item") return
    if (!Number.isFinite(productCost) || productCost <= 0) return

    const endpoint = `${state.syncConfig.apiBaseUrl.replace(/\/+$/, "")}/api/branch-hunter/cost`
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
      })
    } catch {
      // Keep calculator smooth even if remote sync fails.
    }
  }

  function setOperationInputs(elements, values) {
    elements.productCost.value = String(values.productCost ?? 0)
    if (elements.centralizeToggle) {
      elements.centralizeToggle.checked =
        values.centralizeEnabled === undefined ? true : Boolean(values.centralizeEnabled)
    }
    elements.freeShippingToggle.checked = values.freeShippingEnabled ?? true
    elements.shippingFallback.value = String(values.shippingFallback ?? 12)
    if (elements.fullShipmentUnits) {
      elements.fullShipmentUnits.value = String(values.fullShipmentUnits ?? 100)
    }
    if (elements.fullCollectionCost) {
      elements.fullCollectionCost.value = String(values.fullCollectionCost ?? 100)
    }
    elements.shippingManualToggle.checked = Boolean(values.forceManualShipping)
    elements.salePriceManualToggle.checked = Boolean(values.forceManualSalePrice)
    elements.salePriceManualInput.value = String(values.manualSalePrice ?? 0)
    elements.listingTypeSelect.value = values.listingTypeOverride || "gold_special"
    const fullEnabled = Boolean(values.fullEnabled)
    const centralizeEnabled = fullEnabled ? false : (values.centralizeEnabled ?? true)
    elements.centralizeToggle.checked = centralizeEnabled
    elements.fullToggle.checked = fullEnabled
    if (elements.headerChip) {
      elements.headerChip.textContent =
        elements.listingTypeSelect.value === "premium" ? "Premium" : "Clássico"
    }
    applySalePriceUiState(elements)
    applyShippingUiState(elements)
    applyCentralizeUiState(elements)
  }

  function applyLogisticModeUiState(elements, changedMode) {
    if (changedMode === "centralize" && elements.centralizeToggle.checked) {
      elements.fullToggle.checked = false
    }
    if (changedMode === "full" && elements.fullToggle.checked) {
      elements.centralizeToggle.checked = false
    }
  }

  function normalizeMlItemId(value) {
    const match = String(value || "").match(/MLB[-]?\d+/i)
    if (!match) return ""
    return match[0].toUpperCase().replace("-", "")
  }

  function resolveListingIdForCatalogAnalysis() {
    const fromCandidates =
      globalThis.BranchHunterPageUtils?.getCandidateListingIds?.().find((id) =>
        /^MLB\d+$/.test(id),
      ) || ""
    if (fromCandidates) return fromCandidates

    const fromState = normalizeMlItemId(state.listingId)
    if (fromState) return fromState

    const fromUrl = normalizeMlItemId(state.listingUrl || location.href)
    return fromUrl
  }

  function openCatalogAnalysisInApp() {
    const listingId = resolveListingIdForCatalogAnalysis()
    const base = APP_WEB_BASE_URL.replace(/\/+$/, "")
    const targetPath = `${base}/branch-hunter`
    const url = new URL(targetPath)
    url.searchParams.set("hunterSection", "analise-anuncio")
    if (listingId) {
      url.searchParams.set("itemId", listingId)
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer")
  }

  async function hydrateInputs() {
    const elements = getElements()
    if (!elements) return

    const { getSettings, getListingState } = globalThis.BranchHunterStorage
    const settings = await getSettings()
    state.manualSaleFeePercentFallback = Number(settings.manualSaleFeePercentFallback ?? 16)
    state.syncConfig = {
      enabled: Boolean(settings.sync?.enabled),
      apiBaseUrl: String(settings.sync?.apiBaseUrl || ""),
      apiKey: String(settings.sync?.apiKey || ""),
    }
    state.shippingConfig = {
      freeShippingMinPrice: Number(settings.defaults?.freeShippingMinPrice ?? 79),
      freeShippingSubsidyPercent: Number(settings.defaults?.freeShippingSubsidyPercent ?? 50),
      defaultShippingCost: Number(settings.defaults?.defaultShippingCost ?? 12),
    }
    const saved = await getListingState(state.listingId)

    setOperationInputs(elements, {
      ...settings.defaults,
      ...(saved?.operation || {}),
      forceManualSalePrice: saved?.manualMarketplace?.forceManualSalePrice ?? false,
      manualSalePrice: saved?.manualMarketplace?.salePrice ?? 0,
      listingTypeOverride: saved?.manualMarketplace?.listingType || "gold_special",
    })

    await refreshAndCompute(elements, false, { refreshMarketplace: true })
  }

  function bindEvents() {
    const elements = getElements()
    if (!elements) return

    async function recalcAndPersist() {
      await refreshAndCompute(elements, true)
    }

    const inputFields = [
      elements.productCost,
      elements.shippingFallback,
      elements.salePriceManualInput,
      elements.fullShipmentUnits,
      elements.fullCollectionCost,
    ]

    for (const input of inputFields) {
      input.addEventListener("input", () => {
        void recalcAndPersist()
      })
    }
    elements.shippingManualToggle.addEventListener("change", () => {
      applyShippingUiState(elements)
      void recalcAndPersist()
    })
    elements.freeShippingToggle.addEventListener("change", () => {
      applyShippingUiState(elements)
      void recalcAndPersist()
    })
    if (elements.centralizeToggle) {
      elements.centralizeToggle.addEventListener("change", () => {
        applyCentralizeUiState(elements)
        void recalcAndPersist()
      })
    }
    elements.salePriceManualToggle.addEventListener("change", () => {
      applySalePriceUiState(elements)
      if (elements.salePriceManualToggle.checked && state.marketplaceDataCache?.salePrice) {
        elements.salePriceManualInput.value = String(state.marketplaceDataCache.salePrice)
      }
      void recalcAndPersist()
    })

    elements.listingTypeSelect.addEventListener("change", () => {
      const label = elements.listingTypeSelect.value === "premium" ? "Premium" : "Clássico"
      elements.headerChip.textContent = label
      void recalcAndPersist()
    })
    elements.centralizeToggle.addEventListener("change", () => {
      applyLogisticModeUiState(elements, "centralize")
      void recalcAndPersist()
    })
    elements.fullToggle.addEventListener("change", () => {
      applyLogisticModeUiState(elements, "full")
      void recalcAndPersist()
    })

    elements.toggleDetails.addEventListener("click", () => {
      const isOpen = elements.detailsPanel.classList.toggle("open")
      elements.toggleLabel.textContent = isOpen ? "Ver menos" : "Ver mais"
      elements.toggleDetails.classList.toggle("expanded", isOpen)
    })

    elements.openCatalogAnalysis.addEventListener("click", () => {
      openCatalogAnalysisInApp()
    })
  }

  function mountPanel() {
    const anchorResult = globalThis.BranchHunterPageUtils.findBestAnchor()
    const fallbackNode =
      document.querySelector("[data-testid='buy-box-container']") ||
      document.querySelector(".ui-pdp-container__col.col-2") ||
      document.querySelector(".ui-pdp-right-column")
    const resolvedAnchor = anchorResult?.node
      ? anchorResult
      : fallbackNode
        ? { node: fallbackNode, mode: "after" }
        : null
    if (!resolvedAnchor?.node) {
      logDebug("Anchor nao encontrado no momento.")
      return false
    }

    const existingHost = document.getElementById(PANEL_HOST_ID)
    if (existingHost) {
      state.host = existingHost
      state.shadowRoot = existingHost.shadowRoot
      return true
    }

    const host = document.createElement("div")
    host.id = PANEL_HOST_ID
    host.style.display = "block"
    host.style.width = "100%"
    host.style.marginTop = "12px"
    host.style.marginBottom = "12px"

    const inBuyColumn = Boolean(
      resolvedAnchor.node.closest?.(".ui-pdp-container__col.col-2") ||
      resolvedAnchor.node.matches?.("[data-testid='buy-box-container']"),
    )
    if (inBuyColumn) {
      host.style.position = "sticky"
      host.style.top = "12px"
      host.style.zIndex = "10"
    }

    if (resolvedAnchor.mode === "before") {
      resolvedAnchor.node.parentNode?.insertBefore(host, resolvedAnchor.node)
    } else if (resolvedAnchor.mode === "after") {
      resolvedAnchor.node.parentNode?.insertBefore(host, resolvedAnchor.node.nextSibling)
    } else if (resolvedAnchor.mode === "prepend") {
      resolvedAnchor.node.prepend(host)
    } else {
      resolvedAnchor.node.append(host)
    }

    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = buildPanelHTML()
    state.host = host
    state.shadowRoot = shadow
    return true
  }

  async function renderOrRefreshPanel() {
    if (!isMlProductPage()) return

    const mounted = mountPanel()
    if (!mounted || !state.shadowRoot) return

    await syncListingContext()
    state.marketplaceDataCache = null

    if (!state.isInitialized) {
      await hydrateInputs()
      bindEvents()
      state.isInitialized = true
      logDebug("Painel injetado com sucesso.")
      return
    }

    const elements = getElements()
    if (!elements) return

    await refreshAndCompute(elements, false, { refreshMarketplace: false })
  }

  function scheduleRefresh() {
    if (state.renderDebounce) clearTimeout(state.renderDebounce)
    state.renderDebounce = setTimeout(() => {
      void renderOrRefreshPanel()
    }, 140)
  }

  function setupDomObserver() {
    if (state.observer) state.observer.disconnect()
    state.observer = new MutationObserver(() => {
      let mustRefresh = false
      if (state.lastUrl !== location.href) {
        state.lastUrl = location.href
        state.isInitialized = false
        state.marketplaceDataCache = null
        mustRefresh = true
      }
      const hostGone = state.host && !document.body.contains(state.host)
      if (hostGone) {
        state.host = null
        state.shadowRoot = null
        state.isInitialized = false
        state.marketplaceDataCache = null
        mustRefresh = true
      }
      if (!state.host) {
        mustRefresh = true
      }
      if (mustRefresh) {
        scheduleRefresh()
      }
    })

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }

  // ═══════════════════════════════════════════
  // SERP: Catalog badge injection
  // ═══════════════════════════════════════════

  function injectCatalogBadge(card) {
    if (card.querySelector("[data-bh-catalog-badge]")) return

    const badge = document.createElement("div")
    badge.setAttribute("data-bh-catalog-badge", "true")
    Object.assign(badge.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      background: "#16a34a",
      color: "#fff",
      fontSize: "11px",
      fontWeight: "700",
      fontFamily: "Inter, 'Segoe UI', Arial, sans-serif",
      padding: "4px 8px",
      borderRadius: "4px",
      position: "absolute",
      top: "6px",
      left: "6px",
      zIndex: "9999",
      lineHeight: "1",
      letterSpacing: "0.3px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      pointerEvents: "none",
    })
    badge.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;">' +
      '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="currentColor"/>' +
      "</svg>CATÁLOGO"

    const cardStyle = getComputedStyle(card)
    if (cardStyle.position === "static" || cardStyle.position === "") {
      card.style.position = "relative"
    }
    card.style.overflow = "visible"
    card.prepend(badge)
  }

  function enrichSearchResults() {
    const { isMlSearchPage, extractCardItemIds } = globalThis.BranchHunterPageUtils

    if (!isMlSearchPage()) return

    const cards = extractCardItemIds()
    if (cards.length === 0) return

    let badgeCount = 0
    for (const { card, isCatalog } of cards) {
      card.setAttribute(BADGE_ATTR, "1")
      if (isCatalog) {
        injectCatalogBadge(card)
        badgeCount++
      }
    }
    console.log("[BH] catalog badges:", badgeCount, "/", cards.length, "cards")
  }

  function scheduleSerpEnrich() {
    if (state.serpEnrichDebounce) clearTimeout(state.serpEnrichDebounce)
    state.serpEnrichDebounce = setTimeout(enrichSearchResults, 300)
  }

  // ═══════════════════════════════════════════
  // Bootstrap
  // ═══════════════════════════════════════════

  async function bootstrap() {
    const { isMlSearchPage } = globalThis.BranchHunterPageUtils

    if (isMlProductPage()) {
      const { getSettings } = globalThis.BranchHunterStorage
      const settings = await getSettings()
      if (!settings.autoInjectEnabled) return
      await renderOrRefreshPanel()
      setupDomObserver()
      return
    }

    if (isMlSearchPage()) {
      console.log("[BH] Search page detected:", location.href)
      setupSerpObserver()
      for (let attempt = 0; attempt < 8; attempt++) {
        const { extractCardItemIds } = globalThis.BranchHunterPageUtils
        const cards = extractCardItemIds()
        if (cards.length > 0) {
          enrichSearchResults()
          return
        }
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  }

  function setupSerpObserver() {
    if (state.observer) state.observer.disconnect()
    let tick = 0
    state.observer = new MutationObserver(() => {
      tick++
      if (state.lastUrl !== location.href) {
        state.lastUrl = location.href
        tick = 0
        scheduleSerpEnrich()
        return
      }
      if (tick % 5 === 0) {
        const { extractCardItemIds } = globalThis.BranchHunterPageUtils
        if (extractCardItemIds().length > 0) scheduleSerpEnrich()
      }
    })
    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }

  void bootstrap()
})()
