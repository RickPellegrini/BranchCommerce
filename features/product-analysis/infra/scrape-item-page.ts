import { throttledMlFetch } from "@/lib/rate-limit/ml-throttle"

export type ScrapedItemResult = {
  itemId: string
  availableQuantity: number | null
  stockIsMinimum: boolean
  startTime: string | null
}

const SCRAPE_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
}

// ─── Stock extraction from initialState JSON embedded in HTML ────────

export function extractStock(html: string): {
  availableQuantity: number | null
  stockIsMinimum: boolean
} {
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

// ─── Start time extraction ───────────────────────────────────────────

export function extractStartTime(html: string): string | null {
  const m = html.match(/"startTime"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  if (m) return m[1]
  const dc = html.match(/"date_created"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  if (dc) return dc[1]
  const sc = html.match(/"start_time"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/)
  return sc ? sc[1] : null
}

// ─── Single item page scrape (stock + startTime) ─────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: SCRAPE_HEADERS,
      redirect: "follow",
      cache: "no-store",
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length >= 5000 ? html : null
  } catch {
    return null
  }
}

export async function scrapeItemPage(itemId: string): Promise<ScrapedItemResult> {
  const result: ScrapedItemResult = {
    itemId,
    availableQuantity: null,
    stockIsMinimum: false,
    startTime: null,
  }

  const normalizedId = itemId.replace(/^(MLB)(\d+)$/i, "$1-$2")
  const url = `https://produto.mercadolivre.com.br/${normalizedId}`
  const html = await throttledMlFetch(() => fetchPage(url))
  if (!html) return result

  const stock = extractStock(html)
  result.availableQuantity = stock.availableQuantity
  result.stockIsMinimum = stock.stockIsMinimum
  result.startTime = extractStartTime(html)

  return result
}

// ─── Batch scrape item pages ─────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function scrapeCompetitorPages(
  itemIds: string[],
): Promise<Map<string, ScrapedItemResult>> {
  const map = new Map<string, ScrapedItemResult>()
  if (itemIds.length === 0) return map

  const BATCH_SIZE = 5
  const batches = chunk(itemIds, BATCH_SIZE)

  for (const batch of batches) {
    const settled = await Promise.allSettled(
      batch.map((id) => scrapeItemPage(id)),
    )
    for (const r of settled) {
      if (r.status === "fulfilled") {
        map.set(r.value.itemId, r.value)
      }
    }
  }

  return map
}
