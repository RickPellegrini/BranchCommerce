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

const supplierState = {
  rows: [],
  results: [],
}

function parseNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function parseLocaleNumber(value) {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[R$r$]/gi, "")
  if (!sanitized) return null
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function setStatus(message, success = true) {
  const status = document.getElementById("status-message")
  status.textContent = message
  status.style.color = success ? "#065f46" : "#b91c1c"
}

function setSupplierStatus(message, success = true) {
  const status = document.getElementById("supplier-status")
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

function activateTab(tabName) {
  const isSupplier = tabName === "supplier"
  document.getElementById("tab-settings").classList.toggle("is-active", !isSupplier)
  document.getElementById("tab-supplier").classList.toggle("is-active", isSupplier)
  document.getElementById("panel-settings").classList.toggle("is-active", !isSupplier)
  document.getElementById("panel-supplier").classList.toggle("is-active", isSupplier)
}

function splitLine(line, delimiter) {
  return line
    .split(delimiter)
    .map((value) => value.trim())
    .filter((value, index, arr) => index < arr.length)
}

function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) || ""
  if (sample.includes("\t")) return "\t"
  if (sample.includes(";")) return ";"
  return ","
}

function parseSupplierTable(text) {
  const trimmed = String(text ?? "").trim()
  if (!trimmed) return []

  const delimiter = detectDelimiter(trimmed)
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const headers = splitLine(lines[0], delimiter).map(normalizeHeader)
  const codeIndex = headers.findIndex((header) => ["codigo", "cod", "sku"].includes(header))
  const nameIndex = headers.findIndex((header) =>
    ["descricao", "descricao", "produto", "nome"].includes(header),
  )
  const gtinIndex = headers.findIndex((header) =>
    ["gtin", "ean", "codigo de barras", "codigo universal de produto"].includes(header),
  )
  const costIndex = headers.findIndex((header) =>
    ["r$ unit.", "r$ unit", "r$ unitario", "unitario", "custo", "preco", "preco custo"].includes(
      header,
    ),
  )

  if (nameIndex === -1 || gtinIndex === -1 || costIndex === -1) return []

  return lines
    .slice(1)
    .map((line) => splitLine(line, delimiter))
    .map((cols) => ({
      code: codeIndex >= 0 ? (cols[codeIndex] ?? "") : "",
      name: cols[nameIndex] ?? "",
      gtin: (cols[gtinIndex] ?? "").replace(/\D/g, ""),
      cost: parseLocaleNumber(cols[costIndex]),
    }))
    .filter((row) => row.name && row.gtin && row.cost !== null)
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function renderSupplierResults(rows) {
  const container = document.getElementById("supplier-results")
  const card = document.getElementById("supplier-results-card")
  const summary = document.getElementById("supplier-results-summary")

  supplierState.results = rows

  if (!rows.length) {
    card.classList.add("hidden")
    container.innerHTML = ""
    summary.textContent = "0 produtos"
    return
  }

  card.classList.remove("hidden")
  summary.textContent = `${rows.length} produtos com margem boa`
  container.innerHTML = rows
    .map(
      (row) => `
        <article class="supplier-result-item">
          <div class="supplier-result-head">
            <h3>${row.supplierName}</h3>
            <span class="supplier-margin">${formatPercent(row.netMargin)}</span>
          </div>
          <p class="supplier-catalog-name">${row.catalogName}</p>
          <div class="supplier-metrics">
            <span>Custo ${formatCurrency(row.supplierCost)}</span>
            <span>Venda ${formatCurrency(row.salePrice)}</span>
            <span>Taxa ${row.feePercent}%</span>
          </div>
          <div class="supplier-links">
            <a href="${row.catalogLink}" target="_blank" rel="noreferrer">Catalogo</a>
            <a href="${row.itemLink}" target="_blank" rel="noreferrer">Anuncio</a>
          </div>
        </article>
      `,
    )
    .join("")
}

function buildSupplierSummary(rows) {
  return rows
    .map(
      (row) =>
        `${row.supplierName} | custo ${formatCurrency(row.supplierCost)} | venda ${formatCurrency(row.salePrice)} | margem ${formatPercent(row.netMargin)} | ${row.catalogLink}`,
    )
    .join("\n")
}

async function loadSupplierFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const text = await file.text()
  document.getElementById("supplier-paste").value = text
  setSupplierStatus("Arquivo carregado. Agora clique em Buscar catalogos.")
}

async function runSupplierScan() {
  const payloadText = document.getElementById("supplier-paste").value
  const rows = parseSupplierTable(payloadText)
  supplierState.rows = rows

  if (!rows.length) {
    renderSupplierResults([])
    setSupplierStatus(
      "Nao consegui ler a planilha. Use CSV/TSV com colunas codigo, descricao, gtin e custo.",
      false,
    )
    return
  }

  const settings = await new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_KEY], (data) => {
      const persisted = data[SETTINGS_KEY] || {}
      resolve({
        ...defaultSettings,
        ...persisted,
        sync: {
          ...defaultSettings.sync,
          ...(persisted.sync || {}),
        },
      })
    })
  })

  if (!settings.sync.apiBaseUrl || !settings.sync.apiKey) {
    setSupplierStatus(
      "Configure a URL da plataforma e a chave de sincronizacao na aba Calculadora.",
      false,
    )
    return
  }

  const minMargin = parseLocaleNumber(document.getElementById("supplier-min-margin").value) ?? 15
  setSupplierStatus(`Buscando ${rows.length} produtos no catalogo do Mercado Livre...`)
  renderSupplierResults([])

  try {
    const response = await fetch(
      `${settings.sync.apiBaseUrl.replace(/\/$/, "")}/api/branch-hunter/supplier-scan`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-branch-hunter-key": settings.sync.apiKey,
        },
        body: JSON.stringify({
          rows,
          minMargin,
        }),
      },
    )

    const payload = await response.json()
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Falha ao consultar o catalogo.")
    }

    const winners = Array.isArray(payload.data?.winners) ? payload.data.winners : []
    renderSupplierResults(winners)
    setSupplierStatus(
      `${payload.data.scanned} itens lidos, ${payload.data.matched} bateram no catalogo e ${winners.length} ficaram acima de ${formatPercent(minMargin)}.`,
    )
  } catch (error) {
    renderSupplierResults([])
    setSupplierStatus(
      error instanceof Error ? error.message : "Erro ao buscar produtos do fornecedor.",
      false,
    )
  }
}

async function copySupplierResults() {
  if (!supplierState.results.length) {
    setSupplierStatus("Nao ha resultados para copiar.", false)
    return
  }
  const text = buildSupplierSummary(supplierState.results)
  await navigator.clipboard.writeText(text)
  setSupplierStatus("Resumo copiado para a area de transferencia.")
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

  document.getElementById("tab-settings").addEventListener("click", () => activateTab("settings"))
  document.getElementById("tab-supplier").addEventListener("click", () => activateTab("supplier"))
  document.getElementById("save-settings").addEventListener("click", saveSettings)
  document.getElementById("reset-settings").addEventListener("click", resetSettings)
  document.getElementById("supplier-file").addEventListener("change", loadSupplierFile)
  document.getElementById("run-supplier-scan").addEventListener("click", runSupplierScan)
  document.getElementById("copy-supplier-results").addEventListener("click", copySupplierResults)
}

boot()
