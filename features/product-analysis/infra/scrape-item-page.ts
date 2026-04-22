import { throttledMlFetch } from "@/lib/rate-limit/ml-throttle"
import { mlItemIdLookupKeys } from "@/features/product-analysis/utils/ml-item-id"

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

/** Reduz HTML ao bloco do anuncio (evita pegar available_quantity de vitrines/recomendacoes). */
function scopeHtmlToPrimaryItem(html: string, itemId: string): string {
  const keys = mlItemIdLookupKeys(itemId)
  for (const variant of keys) {
    const anchor = `"id":"${variant}"`
    const idx = html.indexOf(anchor)
    if (idx !== -1) {
      return html.slice(idx, Math.min(html.length, idx + 40_000))
    }
  }
  return html
}

export function extractStock(
  html: string,
  /** Se informado, a busca evita o primeiro available_quantity global (ex.: outro item na pagina). */
  itemId?: string,
): {
  availableQuantity: number | null
  stockIsMinimum: boolean
} {
  const slice = itemId ? scopeHtmlToPrimaryItem(html, itemId) : html

  const descMatch = slice.match(/"description"\s*:\s*"\(\+(\d+)\s*dispon[^"]*\)"/)
  if (descMatch) {
    return { availableQuantity: parseInt(descMatch[1], 10) + 1, stockIsMinimum: false }
  }

  const subtitleMatch = slice.match(
    /quantity_selector[\s\S]*?"input"\s*:\s*\{[\s\S]*?"subtitles"\s*:\s*\[[\s\S]*?\+?(\d+)\s*dispon/,
  )
  if (subtitleMatch) {
    return { availableQuantity: parseInt(subtitleMatch[1], 10) + 1, stockIsMinimum: false }
  }

  const selectorBlock = slice.match(
    /quantity_selector"\s*:\s*\{[\s\S]*?"available_quantity"\s*:\s*(\d+)[\s\S]*?"rows"\s*:\s*(\d+)/,
  )
  if (selectorBlock) {
    const dropdownMax = parseInt(selectorBlock[1], 10)
    const rows = parseInt(selectorBlock[2], 10)
    const hasInputMode = /"input"\s*:\s*\{/.test(slice)
    const capped = dropdownMax >= rows && rows > 0
    return { availableQuantity: dropdownMax, stockIsMinimum: capped && hasInputMode }
  }

  const aqMatch = slice.match(/"available_quantity"\s*:\s*(\d+)/)
  if (aqMatch) {
    return { availableQuantity: parseInt(aqMatch[1], 10), stockIsMinimum: false }
  }

  if (/"text"\s*:\s*"Último disponível!"/.test(slice)) {
    return { availableQuantity: 1, stockIsMinimum: false }
  }

  const dispMatch = slice.match(/"text"\s*:\s*"(\d+)\s*disponíve/)
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

const PAGE_TIMEOUT_MS = 4_000

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: SCRAPE_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length >= 5000 ? html : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
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

  const stock = extractStock(html, itemId)
  result.availableQuantity = stock.availableQuantity
  result.stockIsMinimum = stock.stockIsMinimum
  result.startTime = extractStartTime(html)

  return result
}

// ─── Batch scrape item pages ─────────────────────────────────────────

const BATCH_TIMEOUT_MS = 6_000

/**
 * Scrape stock / startTime for a batch of items. Results are written
 * into `target` as they arrive. If a shared map is passed the caller
 * can snapshot partial results at any time (e.g. after a grace period).
 */
export async function scrapeCompetitorPages(
  itemIds: string[],
  target: Map<string, ScrapedItemResult> = new Map(),
): Promise<Map<string, ScrapedItemResult>> {
  if (itemIds.length === 0) return target

  const promises = itemIds.map((id) =>
    scrapeItemPage(id)
      .then((r) => {
        target.set(r.itemId, r)
      })
      .catch(() => {}),
  )

  const allDone = Promise.allSettled(promises)
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, BATCH_TIMEOUT_MS))

  await Promise.race([allDone, timeout])

  return target
}
