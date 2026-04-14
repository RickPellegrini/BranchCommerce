const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
}

export type ScrapedItemData = {
  itemId: string
  availableQuantity: number | null
  stockIsMinimum: boolean
  soldLabel: string | null
  soldQuantity: number | null
  startTime: string | null
}

// ─── HTML-based scraper (no headless browser needed) ─────────────────

async function scrapeItemPage(itemId: string): Promise<ScrapedItemData> {
  const normalizedId = itemId.replace(/^(MLB)(\d+)$/i, "$1-$2")
  const url = `https://produto.mercadolivre.com.br/${normalizedId}`

  const result: ScrapedItemData = {
    itemId,
    availableQuantity: null,
    stockIsMinimum: false,
    soldLabel: null,
    soldQuantity: null,
    startTime: null,
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return result
    const html = await res.text()

    Object.assign(result, extractStock(html))
    result.soldLabel = extractSoldLabel(html)
    result.soldQuantity = extractSoldQuantity(html)
    result.startTime = extractStartTime(html)
  } catch {
    // network/timeout — return nulls
  }

  return result
}

type StockResult = {
  availableQuantity: number | null
  stockIsMinimum: boolean
}

function extractStock(html: string): StockResult {
  // Strategy 1 (primary): picker.description or input.subtitles
  //   The page loads with selected=1. The text "+N disponíveis" means
  //   "N more units available beyond the 1 selected", so total = N + 1.
  const descMatch = html.match(
    /"description"\s*:\s*"\(\+(\d+)\s*dispon[^"]*\)"/,
  )
  if (descMatch) {
    return {
      availableQuantity: parseInt(descMatch[1], 10) + 1,
      stockIsMinimum: false,
    }
  }

  // Fallback A: input.subtitles "+N disponíveis" (same semantics)
  const subtitleMatch = html.match(
    /quantity_selector[\s\S]*?"input"\s*:\s*\{[\s\S]*?"subtitles"\s*:\s*\[[\s\S]*?\+?(\d+)\s*dispon/,
  )
  if (subtitleMatch) {
    return {
      availableQuantity: parseInt(subtitleMatch[1], 10) + 1,
      stockIsMinimum: false,
    }
  }

  // Fallback B: quantity_selector.available_quantity (no subtitle data)
  const selectorBlock = html.match(
    /quantity_selector"\s*:\s*\{[\s\S]*?"available_quantity"\s*:\s*(\d+)[\s\S]*?"rows"\s*:\s*(\d+)/,
  )
  if (selectorBlock) {
    const dropdownMax = parseInt(selectorBlock[1], 10)
    const rows = parseInt(selectorBlock[2], 10)
    const hasInputMode = /"input"\s*:\s*\{/.test(html)
    const capped = dropdownMax >= rows && rows > 0
    return {
      availableQuantity: dropdownMax,
      stockIsMinimum: capped && hasInputMode,
    }
  }

  // Strategy 2: standalone available_quantity (other JSON contexts)
  const aqMatch = html.match(/"available_quantity"\s*:\s*(\d+)/)
  if (aqMatch) {
    return { availableQuantity: parseInt(aqMatch[1], 10), stockIsMinimum: false }
  }

  // Strategy 3: "Último disponível!" = stock of 1
  if (/"text"\s*:\s*"Último disponível!"/.test(html)) {
    return { availableQuantity: 1, stockIsMinimum: false }
  }

  // Strategy 4: "X disponíveis" in subtitles
  const dispMatch = html.match(/"text"\s*:\s*"(\d+)\s*disponíve/)
  if (dispMatch) {
    return {
      availableQuantity: parseInt(dispMatch[1], 10),
      stockIsMinimum: false,
    }
  }

  return { availableQuantity: null, stockIsMinimum: false }
}

function extractSoldQuantity(html: string): number | null {
  // Pattern: "Novo  |  +100 vendidos" or "Novo  |  1 vendido"
  const subLabel = html.match(
    /"subtitle_label"[^}]*"text"\s*:\s*"([^"]*)"/i,
  )
  if (subLabel) {
    const text = subLabel[1]
    const m = text.match(/\+?(\d+)\s*(?:mil\s*)?vendido/i)
    if (m) {
      let qty = parseInt(m[1], 10)
      if (/mil/i.test(text)) qty *= 1000
      return qty
    }
  }

  // Fallback: any "N vendido(s)" text node
  const fallback = html.match(/"text"\s*:\s*"[^"]*?(\d+)\s*(?:mil\s*)?vendido/i)
  if (fallback) {
    let qty = parseInt(fallback[1], 10)
    if (/mil/i.test(fallback[0])) qty *= 1000
    return qty
  }

  return null
}

function extractStartTime(html: string): string | null {
  const m = html.match(/"startTime"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  return m ? m[1] : null
}

function extractSoldLabel(html: string): string | null {
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

// ─── Buy box winner scraping ─────────────────────────────────────────

/**
 * Scrapes the ML catalog product page to find the buy box winner's item ID.
 * The page embeds the winning item's ID in `event_data.item_id`.
 */
export async function scrapeBuyBoxWinner(
  catalogProductId: string,
): Promise<string | null> {
  const url = `https://www.mercadolivre.com.br/p/${catalogProductId}`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const html = await res.text()

    // The melidata event_data.item_id is the displayed buy box winner
    const m = html.match(/event_data"\s*:\s*\{\s*"item_id"\s*:\s*"(MLB\d+)"/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

// ─── Batch scraping with concurrency ─────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function scrapeCompetitorStock(
  itemIds: string[],
  concurrency = 8,
): Promise<Map<string, ScrapedItemData>> {
  const results = new Map<string, ScrapedItemData>()
  if (itemIds.length === 0) return results

  for (const batch of chunk(itemIds, concurrency)) {
    const settled = await Promise.allSettled(
      batch.map((id) => scrapeItemPage(id)),
    )
    for (const r of settled) {
      if (r.status === "fulfilled") {
        results.set(r.value.itemId, r.value)
      }
    }
  }

  return results
}
