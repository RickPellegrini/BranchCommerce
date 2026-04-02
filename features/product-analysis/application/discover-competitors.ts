import type {
  MlItemFull,
  CompetitorEntry,
  DiscoveryStrategy,
  CatalogCompetitor,
  MlSearchResultItem,
} from "@/features/product-analysis/domain/types"
import { getProductItems, searchPublic } from "@/features/product-analysis/infra/ml-api"
import { normalizeTitle, extractBrand, extractModel } from "@/features/product-analysis/utils/normalize"
import type { AnalysisLogger } from "@/features/product-analysis/infra/logger"

function catalogCompetitorToEntry(c: CatalogCompetitor): CompetitorEntry {
  const city = c.seller_address?.city?.name
  const state = c.seller_address?.state?.name
  const location = [city, state].filter(Boolean).join(", ") || null

  return {
    itemId: c.item_id,
    sellerId: c.seller_id,
    price: c.price,
    originalPrice: c.original_price ?? null,
    condition: c.condition ?? null,
    listingType: c.listing_type_id ?? null,
    officialStore: c.official_store_id != null && c.official_store_id > 0,
    freeShipping: !!c.shipping?.free_shipping,
    shippingMode: c.shipping?.mode ?? null,
    logisticType: c.shipping?.logistic_type ?? null,
    tier: c.tier ?? null,
    warranty: c.warranty ?? null,
    location,
    tags: c.tags ?? [],
    title: null,
    sellerNickname: null,
    thumbnail: null,
    permalink: null,
  }
}

function searchResultToEntry(r: MlSearchResultItem): CompetitorEntry {
  const sellerId = r.seller?.id ?? r.seller_id ?? 0
  return {
    itemId: r.id,
    sellerId: sellerId,
    price: r.price,
    originalPrice: r.original_price ?? null,
    condition: r.condition ?? null,
    listingType: r.listing_type_id ?? null,
    officialStore: r.official_store_id != null && r.official_store_id > 0,
    freeShipping: !!r.shipping?.free_shipping,
    shippingMode: null,
    logisticType: r.shipping?.logistic_type ?? null,
    tier: null,
    warranty: null,
    location: null,
    tags: r.tags ?? [],
    title: r.title ?? null,
    sellerNickname: r.seller?.nickname ?? null,
    thumbnail: r.thumbnail ?? null,
    permalink: r.permalink ?? null,
  }
}

export type DiscoverResult = {
  competitors: CompetitorEntry[]
  strategy: DiscoveryStrategy
  rawCount: number
}

export async function discoverCompetitors(
  token: string,
  item: MlItemFull,
  logger: AnalysisLogger,
): Promise<DiscoverResult> {
  // Strategy 1: catalog_product_id → /products/{id}/items (official endpoint)
  if (item.catalog_product_id) {
    logger.log("discover", `catalog_product_id detected: ${item.catalog_product_id}`)
    try {
      const res = await getProductItems(token, item.catalog_product_id)
      const raw = res.results ?? []
      logger.log("discover", `/products/${item.catalog_product_id}/items returned ${raw.length} listings`, raw.length)

      const filtered = raw
        .filter((c) => c.item_id !== item.id)
        .map(catalogCompetitorToEntry)

      logger.log("discover", `After excluding self: ${filtered.length}`, filtered.length)
      return { competitors: filtered, strategy: "catalog_product_items", rawCount: raw.length }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.log("discover", `catalog_product_items error: ${msg}`)
    }
  } else {
    logger.log("discover", "No catalog_product_id — skipping /products/{id}/items")
  }

  // Strategy 2: public search fallback (unauthenticated)
  const siteId = item.site_id || "MLB"
  const brand = extractBrand(item.attributes ?? [])
  const model = extractModel(item.attributes ?? [])
  const title = normalizeTitle(item.title)
  const query = brand && model ? `${brand} ${model}` : title.split(/\s+/).slice(0, 6).join(" ")

  if (query.trim().length < 3) {
    logger.log("discover", "Query too short for public search, returning empty")
    return { competitors: [], strategy: "public_search", rawCount: 0 }
  }

  logger.log("discover", `Public search fallback: q="${query}" category=${item.category_id}`)
  try {
    const params: Record<string, string> = { q: query, limit: "50" }
    if (item.category_id) params.category = item.category_id

    const res = await searchPublic(siteId, params)
    const raw = res.results ?? []
    logger.log("discover", `Public search returned ${raw.length} results`, raw.length)

    const filtered = raw
      .filter((r) => {
        if (r.id === item.id) return false
        const sid = r.seller?.id ?? r.seller_id
        if (sid && sid === item.seller_id) return false
        return true
      })
      .map(searchResultToEntry)

    logger.log("discover", `After excluding self: ${filtered.length}`, filtered.length)
    return { competitors: filtered, strategy: "public_search", rawCount: raw.length }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.log("discover", `Public search error: ${msg}`)
    return { competitors: [], strategy: "public_search", rawCount: 0 }
  }
}
