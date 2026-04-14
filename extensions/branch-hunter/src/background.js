// ─── Shared fetch with retry + backoff ───────────────────────────────

const SCRAPE_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(url, opts = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)
      const res = await fetch(url, { ...opts, signal: controller.signal })
      clearTimeout(timeout)

      if (res.status === 429) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 10000)
        console.warn(`[BH-fetch] 429 on ${url.slice(0, 80)}... retry ${attempt + 1}/${maxRetries} in ${delay}ms`)
        if (attempt < maxRetries) {
          await sleep(delay)
          continue
        }
      }
      return res
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      throw err
    }
  }
  return null
}

// ─── Stock extraction ────────────────────────────────────────────────

function extractStock(html) {
  const descMatch = html.match(/"description"\s*:\s*"\(\+(\d+)\s*dispon[^"]*\)"/)
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

// ─── Sold quantity extraction (from individual item page) ────────────

function extractSoldFromItemPage(html, itemId) {
  // The page has initialState JSON with item data. We need to find
  // sold_quantity that belongs to our specific item, not to recommendations.
  //
  // Strategy: find the quantity_selector section (which is item-specific)
  // and look for sold_quantity near it in the same initialState block.

  // 1. Try to find sold_quantity in the initialState near our item data.
  //    The initialState starts with {"id":"MLB...",...} and contains item-specific fields.
  const initialStateMatch = html.match(/"initialState"\s*:\s*\{[^}]*"id"\s*:\s*"[^"]*"/)
  if (initialStateMatch) {
    const stateStart = initialStateMatch.index
    // Search within a reasonable window from the initialState start
    const stateWindow = html.slice(stateStart, stateStart + 5000)
    const soldMatch = stateWindow.match(/"sold_quantity"\s*:\s*(\d+)/)
    if (soldMatch) {
      const qty = parseInt(soldMatch[1], 10)
      console.log(`[BH-sold] ${itemId}: found sold_quantity=${qty} in initialState`)
      return { soldQuantity: qty, soldLabel: `${qty} vendidos`, source: "initialState" }
    }
  }

  // 2. Try to find sold_quantity near quantity_selector (item-specific section)
  const qsMatch = html.match(/quantity_selector/)
  if (qsMatch) {
    const qsPos = qsMatch.index
    // Look backwards from quantity_selector for the nearest sold_quantity
    const beforeQs = html.slice(Math.max(0, qsPos - 3000), qsPos)
    const allSold = [...beforeQs.matchAll(/"sold_quantity"\s*:\s*(\d+)/g)]
    if (allSold.length > 0) {
      // Take the LAST (nearest to quantity_selector) match
      const nearest = allSold[allSold.length - 1]
      const qty = parseInt(nearest[1], 10)
      console.log(`[BH-sold] ${itemId}: found sold_quantity=${qty} near quantity_selector`)
      return { soldQuantity: qty, soldLabel: `${qty} vendidos`, source: "near_qs" }
    }
  }

  // 3. Subtitle label as last resort (may be product aggregate for catalog items)
  const subLabel = html.match(/"subtitle_label"[^}]*"text"\s*:\s*"([^"]*)"/i)
  if (subLabel) {
    const text = subLabel[1]
    const m = text.match(/\+?\s*(\d[\d.]*)\s*(?:mil\s*)?(?:vendido|venda)/i)
    if (m) {
      let qty = parseFloat(m[1].replace(/\./g, ""))
      if (/mil/i.test(text)) qty *= 1000
      qty = Math.round(qty)
      // Extract the clean label
      const labelMatch = text.match(/(\+?\s*\d[\d.]*\s*(?:mil\s*)?(?:vendidos?|vendas?))/i)
      const soldLabel = labelMatch ? labelMatch[1].trim() : text.trim()
      console.log(`[BH-sold] ${itemId}: found "${soldLabel}" -> ${qty} in subtitle_label`)
      return { soldQuantity: qty, soldLabel, source: "subtitle" }
    }
  }

  console.log(`[BH-sold] ${itemId}: no sold data found`)
  return { soldQuantity: null, soldLabel: null, source: "none" }
}

function extractStartTime(html) {
  const m = html.match(/"startTime"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  if (m) return m[1]
  const dc = html.match(/"date_created"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  if (dc) return dc[1]
  const sc = html.match(/"start_time"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  return sc ? sc[1] : null
}

// ─── Full item page scrape (stock + sold + startTime) ────────────────

async function scrapeItemPage(itemId) {
  const normalizedId = itemId.replace(/^(MLB)(\d+)$/i, "$1-$2")
  const url = `https://produto.mercadolivre.com.br/${normalizedId}`

  const result = {
    itemId,
    availableQuantity: null,
    stockIsMinimum: false,
    soldQuantity: null,
    soldLabel: null,
    startTime: null,
  }

  try {
    const res = await fetchWithRetry(url, { headers: SCRAPE_HEADERS, redirect: "follow" })
    if (!res || !res.ok) {
      console.warn(`[BH-scraper] ${itemId}: HTTP ${res?.status ?? "null"}`)
      return result
    }

    const finalUrl = res.url
    const html = await res.text()
    if (html.length < 5000) {
      console.warn(`[BH-scraper] ${itemId}: too small (${html.length} chars)`)
      return result
    }

    console.log(`[BH-scraper] ${itemId}: ${html.length} chars, redirected to ${finalUrl.slice(0, 80)}`)

    // Stock
    Object.assign(result, extractStock(html))

    // Sold
    const sold = extractSoldFromItemPage(html, itemId)
    result.soldQuantity = sold.soldQuantity
    result.soldLabel = sold.soldLabel

    // Start time
    result.startTime = extractStartTime(html)
  } catch (err) {
    console.warn(`[BH-scraper] ${itemId}: ${err.message || err}`)
  }

  return result
}

// ─── Buy box winner (from catalog page) ──────────────────────────────

async function scrapeBuyBoxWinner(catalogProductId) {
  const url = `https://www.mercadolivre.com.br/p/${catalogProductId}`
  try {
    const res = await fetchWithRetry(url, { headers: SCRAPE_HEADERS, redirect: "follow" })
    if (!res || !res.ok) return null
    const html = await res.text()
    const m = html.match(/event_data"\s*:\s*\{\s*"item_id"\s*:\s*"(MLB\d+)"/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function handleScrapeCompetitors(payload) {
  const { itemIds = [], catalogProductId = null } = payload
  const CONCURRENCY = 2
  const BATCH_DELAY = 1500
  const t0 = Date.now()

  // Phase 1: Scrape individual item pages (stock + sold + startTime)
  console.log(`[BH-scraper] scraping ${itemIds.length} items (concurrency=${CONCURRENCY}, delay=${BATCH_DELAY}ms)`)
  const stockMap = {}
  const batches = chunk(itemIds, CONCURRENCY)

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(BATCH_DELAY)

    const settled = await Promise.allSettled(
      batches[i].map((id) => scrapeItemPage(id)),
    )
    for (const r of settled) {
      if (r.status === "fulfilled") {
        stockMap[r.value.itemId] = r.value
      }
    }
  }

  // Phase 2: Buy box winner from catalog page
  await sleep(1000)
  const buyBoxWinner = catalogProductId
    ? await scrapeBuyBoxWinner(catalogProductId)
    : null

  const stockHits = Object.values(stockMap).filter((r) => r.availableQuantity != null).length
  const soldHits = Object.values(stockMap).filter((r) => r.soldQuantity != null && r.soldQuantity > 0).length
  console.log(
    `[BH-scraper] done: stock=${stockHits}/${itemIds.length}, sold=${soldHits}/${itemIds.length}, winner=${buyBoxWinner || "none"}, ${Date.now() - t0}ms`,
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
