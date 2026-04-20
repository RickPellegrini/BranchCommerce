import type {
  FullAnalysis,
  MlItemFull,
  MlProduct,
  CatalogCompetitor,
  CompetitorEntry,
} from "@/features/product-analysis/domain/types"
import { createAnalysisLogger } from "@/features/product-analysis/infra/logger"
import {
  getItem,
  getProduct,
  getProductItems,
  getSellersBatch,
  getCompetitorVisits,
  getPriceToWin,
  getVisitsBatch,
  MlUpstreamError,
} from "@/features/product-analysis/infra/ml-api"
import { scrapeCompetitorPages } from "@/features/product-analysis/infra/scrape-item-page"
import { dateRange } from "@/features/product-analysis/utils/dates"
import { buildCatalogSection } from "@/features/product-analysis/application/build-catalog-section"
import { aggregateCompetitors } from "@/features/product-analysis/application/aggregate-competitors"

// ─── Types ──────────────────────────────────────────────────────────

type ResolveResult =
  | {
      type: "catalog_product"
      catalogProductId: string
      listings: CatalogCompetitor[]
      product: MlProduct
    }
  | {
      type: "item"
      item: MlItemFull
    }

// ─── Synthesize MlItemFull from product + first listing ─────────────
// Used when /items/{id} is blocked (third-party items).
// Combines /products/{id} metadata with /products/{id}/items first listing.

function synthesizeItem(product: MlProduct, firstListing: CatalogCompetitor): MlItemFull {
  const firstPic = product.pictures?.[0]
  const thumbnailUrl = firstPic ? firstPic.url.replace("-F.jpg", "-I.jpg") : ""

  return {
    id: firstListing.item_id,
    title: product.name,
    site_id: firstListing.site_id ?? "MLB",
    category_id: firstListing.category_id ?? "",
    domain_id: product.domain_id,
    price: firstListing.price,
    original_price: firstListing.original_price ?? null,
    currency_id: firstListing.currency_id ?? "BRL",
    available_quantity: 0,
    sold_quantity: 0,
    listing_type_id: firstListing.listing_type_id ?? "gold_special",
    condition: firstListing.condition ?? "new",
    permalink: `https://www.mercadolivre.com.br/p/${product.id}`,
    thumbnail: thumbnailUrl,
    pictures: (product.pictures ?? []).map((p) => ({
      id: p.id,
      url: p.url,
      secure_url: p.url.replace("http://", "https://"),
    })),
    attributes: (product.attributes ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      value_id: a.value_id ?? null,
      value_name: a.value_name ?? null,
      values: a.values,
    })),
    tags: firstListing.tags ?? [],
    catalog_product_id: product.id,
    seller_id: firstListing.seller_id,
    official_store_id: firstListing.official_store_id ?? null,
    status: "active",
    date_created: product.date_created ?? undefined,
    shipping: {
      logistic_type: firstListing.shipping?.logistic_type,
      free_shipping: firstListing.shipping?.free_shipping,
      mode: firstListing.shipping?.mode,
      tags: firstListing.shipping?.tags,
    },
    seller_address: {
      city: firstListing.seller_address?.city,
      state: firstListing.seller_address?.state,
    },
    catalog_listing: true,
  }
}

// ─── Step 1: Catalog-first resolution ───────────────────────────────

async function resolveId(
  rawId: string,
  token: string,
  logger: ReturnType<typeof createAnalysisLogger>,
): Promise<ResolveResult> {
  // Strategy A — catalog-first: /products/{rawId}/items + /products/{rawId}
  logger.log("resolve:A", `GET /products/${rawId}/items (with token)`)
  try {
    const [itemsRes, product] = await Promise.all([
      getProductItems(rawId, token),
      getProduct(rawId, token),
    ])
    const listings = itemsRes.results ?? []

    if (listings.length > 0) {
      logger.log("resolve:A", `✓ CATALOG_RESOLVED — "${product.name}", ${listings.length} listings`)
      return {
        type: "catalog_product",
        catalogProductId: rawId,
        listings,
        product,
      }
    }
    logger.log("resolve:A", `✗ 0 listings — not a valid catalog`)
  } catch (err: unknown) {
    if (err instanceof MlUpstreamError) {
      logger.log("resolve:A", `✗ ML ${err.mlStatus} — not a catalog_product_id`)
    } else {
      logger.log("resolve:A", `✗ ${String(err)}`)
    }
  }

  // Strategy B — item fallback: /items/{rawId} (works for user's own items)
  logger.log("resolve:B", `GET /items/${rawId} (with token)`)
  try {
    const item = await getItem(rawId, token)
    logger.log(
      "resolve:B",
      `✓ ITEM_RESOLVED — "${item.title}" (catalog=${item.catalog_product_id ?? "none"})`,
    )
    return { type: "item", item }
  } catch (err: unknown) {
    if (err instanceof MlUpstreamError) {
      logger.log("resolve:B", `✗ ML ${err.mlStatus}: ${err.bodyText.slice(0, 200)}`)
    } else {
      logger.log("resolve:B", `✗ ${String(err)}`)
    }
  }

  throw new Error("UNRESOLVABLE_ID: ID nao encontrado nem como catalogo nem como item.")
}

// ─── Competitor mapping ─────────────────────────────────────────────

function catalogListingToCompetitor(c: CatalogCompetitor): CompetitorEntry {
  const city = c.seller_address?.city?.name
  const state = c.seller_address?.state?.name
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
    location: [city, state].filter(Boolean).join(", ") || null,
    tags: c.tags ?? [],
    title: null,
    sellerNickname: null,
    sellerPowerStatus: null,
    sellerRepLevel: null,
    sellerTotalTransactions: null,
    sellerPermalink: null,
    thumbnail: null,
    permalink: null,
    visits30d: null,
    visitsShare: null,
    scrapedStock: null,
    scrapedStockIsMinimum: false,
    scrapedStartTime: null,
  }
}

// ─── Main orchestration ─────────────────────────────────────────────

export async function getProductAnalysis(token: string, receivedId: string): Promise<FullAnalysis> {
  const logger = createAnalysisLogger()
  logger.log("start", `receivedId=${receivedId}`)
  const t0 = Date.now()

  const resolved = await resolveId(receivedId, token, logger)

  let item: MlItemFull
  let catalogProductId: string | null
  let allListings: CatalogCompetitor[] = []

  if (resolved.type === "catalog_product") {
    allListings = resolved.listings
    catalogProductId = resolved.catalogProductId
    item = synthesizeItem(resolved.product, resolved.listings[0])
    logger.log(
      "resolve",
      `resolvedType=catalog_product, catalogProductId=${catalogProductId}, ` +
        `representativeItem=${item.id}, totalListings=${allListings.length}`,
    )
  } else {
    item = resolved.item
    catalogProductId = item.catalog_product_id ?? null
    logger.log("resolve", `resolvedType=item, itemId=${item.id}`)

    // If the item belongs to a catalog, fetch competitors
    if (catalogProductId) {
      logger.log("discover", `Item has catalog_product_id=${catalogProductId}, fetching listings`)
      try {
        const res = await getProductItems(catalogProductId, token)
        allListings = res.results ?? []
        logger.log("discover", `✓ ${allListings.length} listings`)
      } catch (err: unknown) {
        const detail = err instanceof MlUpstreamError ? `ML ${err.mlStatus}` : String(err)
        logger.log("discover", `✗ ${detail} — continuing without competitors`)
      }
    }
  }

  // Build competitors from catalog listings
  const competitors = allListings
    .filter((c) => c.item_id !== item.id)
    .map(catalogListingToCompetitor)

  logger.log("competitors", `total=${allListings.length}, afterExcludingSelf=${competitors.length}`)

  // Enrich everything in a single parallel wave:
  // competitors (sellers + visits + stock) + own item (price_to_win + visits)
  const uniqueSellerIds = [...new Set(competitors.map((c) => c.sellerId))]
  const competitorItemIds = competitors.map((c) => c.itemId)
  const range7 = dateRange(7)
  const range30 = dateRange(30)
  logger.log(
    "enrich",
    `Fetching ${uniqueSellerIds.length} sellers + ${competitorItemIds.length} visits + stock + ptw + own visits`,
  )
  const enrichT0 = Date.now()

  // Shared map: scraping writes results here as each page completes.
  // This lets us snapshot partial results after a grace period.
  const scrapeMap = new Map<
    string,
    import("@/features/product-analysis/infra/scrape-item-page").ScrapedItemResult
  >()
  const scrapePromise = scrapeCompetitorPages(competitorItemIds, scrapeMap)

  // Fast API calls run in parallel with the scraping above.
  const [sellersResult, visitsResult, ptwResult, visits7Result, visits30Result] =
    await Promise.allSettled([
      getSellersBatch(token, uniqueSellerIds),
      getCompetitorVisits(token, competitorItemIds),
      getPriceToWin(token, item.id),
      getVisitsBatch(token, [item.id], range7.from, range7.to).then((m) => m.get(item.id) ?? null),
      getVisitsBatch(token, [item.id], range30.from, range30.to).then(
        (m) => m.get(item.id) ?? null,
      ),
    ])

  // Give scraping a short grace period after the fast calls finish.
  // scrapeMap already has partial results; wait up to 2s more for stragglers.
  const SCRAPE_GRACE_MS = 2_000
  await Promise.race([
    scrapePromise,
    new Promise<void>((resolve) => setTimeout(resolve, SCRAPE_GRACE_MS)),
  ])

  const sellersMap =
    sellersResult.status === "fulfilled"
      ? sellersResult.value
      : new Map<number, import("@/features/product-analysis/domain/types").MlSeller>()
  const visitsMap =
    visitsResult.status === "fulfilled" ? visitsResult.value : new Map<string, number>()
  const ptw = ptwResult.status === "fulfilled" ? ptwResult.value : null
  const visits7 = visits7Result.status === "fulfilled" ? visits7Result.value : null
  const visits30 = visits30Result.status === "fulfilled" ? visits30Result.value : null

  const totalVisits = Array.from(visitsMap.values()).reduce((a, b) => a + b, 0)

  for (const comp of competitors) {
    const seller = sellersMap.get(comp.sellerId)
    if (seller) {
      comp.sellerNickname = seller.nickname
      comp.sellerPowerStatus = seller.seller_reputation?.power_seller_status ?? null
      comp.sellerRepLevel = seller.seller_reputation?.level_id ?? null
      comp.sellerTotalTransactions = seller.seller_reputation?.transactions?.total ?? null
      comp.sellerPermalink = seller.permalink ?? null
      if (!comp.location && seller.address) {
        const city = seller.address.city
        const state = seller.address.state?.replace("BR-", "")
        comp.location = [city, state].filter(Boolean).join(", ") || null
      }
    }
    const v = visitsMap.get(comp.itemId)
    if (v != null) {
      comp.visits30d = v
      comp.visitsShare = totalVisits > 0 ? (v / totalVisits) * 100 : 0
    }
    const scraped = scrapeMap.get(comp.itemId)
    if (scraped) {
      comp.scrapedStock = scraped.availableQuantity
      comp.scrapedStockIsMinimum = scraped.stockIsMinimum
      comp.scrapedStartTime = scraped.startTime
    }
  }

  const scrapeHits = Array.from(scrapeMap.values()).filter(
    (r) => r.availableQuantity != null,
  ).length
  const catalogMs = Date.now() - enrichT0
  logger.log(
    "enrich",
    `✓ ${sellersMap.size} sellers, ${visitsMap.size} visits (total=${totalVisits}), stock=${scrapeHits}/${competitorItemIds.length}, ptw=${ptw?.status ?? "N/A"}, visits7d=${visits7}, visits30d=${visits30} in ${catalogMs}ms`,
  )

  const summary = aggregateCompetitors(competitors, item.price)
  logger.log(
    "compute",
    `min=${summary.minPrice}, max=${summary.maxPrice}, avg=${summary.avgPrice}, ` +
      `median=${summary.medianPrice}, freeShipping=${summary.freeShippingCount}, ` +
      `fulfillment=${summary.fulfillmentCount}, officialStore=${summary.officialStoreCount}`,
  )

  const catalog = buildCatalogSection(item, visits7, visits30, ptw)
  const totalMs = Date.now() - t0

  logger.log(
    "done",
    `resolvedType=${resolved.type}, strategy=catalog_product_items, ` +
      `competitors=${competitors.length}, totalTime=${totalMs}ms`,
  )

  return {
    catalog,
    competitors: {
      strategy: "catalog_product_items",
      totalCandidatesRaw: allListings.length,
      totalAfterFilters: competitors.length,
      competitors,
      summary,
      buyBoxWinnerItemId: ptw?.winner?.item_id ?? allListings[0]?.item_id ?? null,
    },
    logs: logger.entries,
    fetchedAt: new Date().toISOString(),
    timings: {
      totalMs,
      catalogMs,
      competitorsMs: Date.now() - enrichT0,
    },
  }
}
