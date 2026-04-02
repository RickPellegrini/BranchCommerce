import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { getMercadoLivreConfig } from "@/lib/mercadolivre/config"
import type {
  MlItemFull,
  MlSearchResult,
  MlPriceToWinResult,
  MlVisitsEntry,
  CatalogProductItemsResponse,
} from "@/features/product-analysis/domain/types"

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Fetch the base item (own listing only). */
export async function getItem(token: string, itemId: string): Promise<MlItemFull> {
  return fetchMlApi<MlItemFull>(`/items/${itemId}`, token)
}

/**
 * GET /products/{product_id}/items — official catalog competition endpoint.
 * Returns all competing listings with price, seller_id, shipping, etc.
 * Requires authenticated token.
 */
export async function getProductItems(
  token: string,
  productId: string,
): Promise<CatalogProductItemsResponse> {
  return fetchMlApi<CatalogProductItemsResponse>(`/products/${productId}/items`, token)
}

/**
 * Public search (unauthenticated) — fallback for items without catalog_product_id.
 * Does NOT send Authorization header because the seller token causes 403.
 */
export async function searchPublic(
  siteId: string,
  params: Record<string, string>,
): Promise<MlSearchResult> {
  const qs = new URLSearchParams(params)
  const url = `${getMercadoLivreConfig().apiUrl}/sites/${siteId}/search?${qs.toString()}`
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erro Mercado Livre (${res.status}): ${text}`)
  }
  return (await res.json()) as MlSearchResult
}

/** Price-to-win for own item. */
export async function getPriceToWin(token: string, itemId: string): Promise<MlPriceToWinResult | null> {
  try {
    return await fetchMlApi<MlPriceToWinResult>(`/items/${itemId}/price_to_win?version=v2`, token)
  } catch {
    return null
  }
}

/** Visits for own items (batched). */
export async function getVisitsBatch(
  token: string,
  ids: string[],
  dateFrom: string,
  dateTo: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (ids.length === 0) return map

  const settled = await Promise.allSettled(
    chunk(ids, 50).map((c) =>
      fetchMlApi<MlVisitsEntry[]>(
        `/items/visits?ids=${c.join(",")}&date_from=${dateFrom}&date_to=${dateTo}`,
        token,
      ),
    ),
  )
  for (const r of settled) {
    if (r.status !== "fulfilled") continue
    for (const e of r.value) {
      if (e.item_id) map.set(e.item_id, e.total_visits ?? 0)
    }
  }
  return map
}
