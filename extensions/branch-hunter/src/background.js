// ─── Scraping helpers (ported from ml-scraper.ts) ────────────────────

const SCRAPE_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
}

function extractStock(html) {
  const descMatch = html.match(
    /"description"\s*:\s*"\(\+(\d+)\s*dispon[^"]*\)"/,
  )
  if (descMatch) {
    return { availableQuantity: parseInt(descMatch[1], 10) + 1, stockIsMinimum: false }
  }

  const subtitleMatch = html.match(
    /quantity_selector[\s\S]*?"input"\s*:\s*\{[\s\S]*?"subtitles"\s*:\s*\[[\s\S]*?\+?(\d+)\s*dispon/,
  )
  if (subtitleMatch) {
    return { availableQuantity: parseInt(subtitleMatch[1], 10) + 1, stockIsMinimum: false }
  }

  const selectorBlock = html.match(
    /quantity_selector"\s*:\s*\{[\s\S]*?"available_quantity"\s*:\s*(\d+)[\s\S]*?"rows"\s*:\s*(\d+)/,
  )
  if (selectorBlock) {
    const dropdownMax = parseInt(selectorBlock[1], 10)
    const rows = parseInt(selectorBlock[2], 10)
    const hasInputMode = /"input"\s*:\s*\{/.test(html)
    const capped = dropdownMax >= rows && rows > 0
    return { availableQuantity: dropdownMax, stockIsMinimum: capped && hasInputMode }
  }

  const aqMatch = html.match(/"available_quantity"\s*:\s*(\d+)/)
  if (aqMatch) {
    return { availableQuantity: parseInt(aqMatch[1], 10), stockIsMinimum: false }
  }

  if (/"text"\s*:\s*"Último disponível!"/.test(html)) {
    return { availableQuantity: 1, stockIsMinimum: false }
  }

  const dispMatch = html.match(/"text"\s*:\s*"(\d+)\s*disponíve/)
  if (dispMatch) {
    return { availableQuantity: parseInt(dispMatch[1], 10), stockIsMinimum: false }
  }

  return { availableQuantity: null, stockIsMinimum: false }
}

function extractSoldQuantity(html) {
  const subLabel = html.match(/"subtitle_label"[^}]*"text"\s*:\s*"([^"]*)"/i)
  if (subLabel) {
    const text = subLabel[1]
    const m = text.match(/\+?(\d+)\s*(?:mil\s*)?vendido/i)
    if (m) {
      let qty = parseInt(m[1], 10)
      if (/mil/i.test(text)) qty *= 1000
      return qty
    }
  }

  const fallback = html.match(/"text"\s*:\s*"[^"]*?(\d+)\s*(?:mil\s*)?vendido/i)
  if (fallback) {
    let qty = parseInt(fallback[1], 10)
    if (/mil/i.test(fallback[0])) qty *= 1000
    return qty
  }

  return null
}

function extractStartTime(html) {
  const m = html.match(/"startTime"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  return m ? m[1] : null
}

function extractSoldLabel(html) {
  const subMatch = html.match(
    /"subtitle_label"[^}]*"text"\s*:\s*"([^"]*vendido[^"]*)"/i,
  )
  if (subMatch) {
    const soldPart = subMatch[1].match(/(\+?\d[\w.]*\s*vendido\w*)/i)
    return soldPart ? soldPart[1] : subMatch[1]
  }

  const sub2 = html.match(/"subtitle"\s*:\s*"([^"]*vendido[^"]*)"/i)
  if (sub2) {
    const soldPart = sub2[1].match(/(\+?\d[\w.]*\s*vendido\w*)/i)
    return soldPart ? soldPart[1] : sub2[1]
  }

  return null
}

async function scrapeItemPage(itemId) {
  const normalizedId = itemId.replace(/^(MLB)(\d+)$/i, "$1-$2")
  const url = `https://produto.mercadolivre.com.br/${normalizedId}`

  const result = {
    itemId,
    availableQuantity: null,
    stockIsMinimum: false,
    soldLabel: null,
    soldQuantity: null,
    startTime: null,
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      headers: SCRAPE_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.warn(`[BH-scraper] ${itemId}: HTTP ${res.status}`)
      return result
    }
    const html = await res.text()
    if (html.length < 5000) {
      console.warn(`[BH-scraper] ${itemId}: too small (${html.length} chars)`)
      return result
    }

    Object.assign(result, extractStock(html))
    result.soldLabel = extractSoldLabel(html)
    result.soldQuantity = extractSoldQuantity(html)
    result.startTime = extractStartTime(html)
  } catch (err) {
    console.warn(`[BH-scraper] ${itemId}: ${err.message || err}`)
  }

  return result
}

async function scrapeBuyBoxWinner(catalogProductId) {
  const url = `https://www.mercadolivre.com.br/p/${catalogProductId}`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      headers: SCRAPE_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const html = await res.text()

    const m = html.match(/event_data"\s*:\s*\{\s*"item_id"\s*:\s*"(MLB\d+)"/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function handleScrapeCompetitors(payload) {
  const { itemIds = [], catalogProductId = null } = payload
  const CONCURRENCY = 4

  const stockMap = {}
  const t0 = Date.now()

  for (const batch of chunk(itemIds, CONCURRENCY)) {
    const settled = await Promise.allSettled(batch.map((id) => scrapeItemPage(id)))
    for (const r of settled) {
      if (r.status === "fulfilled") {
        stockMap[r.value.itemId] = r.value
      }
    }
  }

  const buyBoxWinner = catalogProductId
    ? await scrapeBuyBoxWinner(catalogProductId)
    : null

  const hits = Object.values(stockMap).filter((r) => r.availableQuantity != null).length
  console.log(
    `[BH-scraper] done: ${hits}/${itemIds.length} items, winner=${buyBoxWinner || "none"}, ${Date.now() - t0}ms`,
  )

  return { stockData: stockMap, buyBoxWinner }
}

// ─── Message listener ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return

  if (message.type === "BRANCH_HUNTER_LISTING") {
    chrome.storage.local.set(
      {
        "branchHunter:lastListing": {
          ...message.payload,
          capturedAt: Date.now(),
        },
      },
      () => {
        sendResponse({ ok: true })
      },
    )
    return true
  }

  if (message.type === "SCRAPE_COMPETITORS") {
    handleScrapeCompetitors(message.payload)
      .then((result) => sendResponse(result))
      .catch((err) => {
        console.error("[BH-scraper] fatal:", err)
        sendResponse({ stockData: {}, buyBoxWinner: null })
      })
    return true
  }
})
