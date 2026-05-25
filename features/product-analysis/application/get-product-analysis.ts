import type {
  FullAnalysis,
  MlItemFull,
  MlProduct,
  CatalogCompetitor,
  CompetitorEntry,
  AnalysisDataSource,
  AnalysisDataSourceKey,
  AnalysisDataSourceStatus,
  AnalysisStatus,
} from "@/features/product-analysis/domain/types"
import { createAnalysisLogger } from "@/features/product-analysis/infra/logger"
import {
  getItem,
  getProduct,
  getProductItems,
  getSellersBatch,
  getItemsReferenceStockBatch,
  getCompetitorVisits,
  getPriceToWin,
  getVisitsBatch,
  MlUpstreamError,
} from "@/features/product-analysis/infra/ml-api"
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

type RecordSource = (
  key: AnalysisDataSourceKey,
  status: AnalysisDataSourceStatus,
  patch?: Partial<Omit<AnalysisDataSource, "key" | "label" | "kind" | "status">>,
) => void

const SOURCE_DEFS: Record<
  AnalysisDataSourceKey,
  Pick<AnalysisDataSource, "key" | "label" | "kind" | "status" | "used">
> = {
  catalog_product_items: {
    key: "catalog_product_items",
    label: "Concorrentes do catalogo",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  catalog_product: {
    key: "catalog_product",
    label: "Produto de catalogo",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  item: {
    key: "item",
    label: "Anuncio principal",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  competitor_sellers: {
    key: "competitor_sellers",
    label: "Dados dos vendedores",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  competitor_visits: {
    key: "competitor_visits",
    label: "Visitas dos concorrentes",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  price_to_win: {
    key: "price_to_win",
    label: "Price to Win / Buy Box",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  own_visits_7d: {
    key: "own_visits_7d",
    label: "Visitas do anuncio 7d",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  own_visits_30d: {
    key: "own_visits_30d",
    label: "Visitas do anuncio 30d",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  reference_stock: {
    key: "reference_stock",
    label: "Estoque referencial API",
    kind: "mercadolivre_api",
    status: "skipped",
    used: false,
  },
  computed_summary: {
    key: "computed_summary",
    label: "Resumo calculado",
    kind: "computed",
    status: "skipped",
    used: false,
  },
}

const SOURCE_ORDER = Object.keys(SOURCE_DEFS) as AnalysisDataSourceKey[]

function createDataSourceRecorder() {
  const sources = new Map<AnalysisDataSourceKey, AnalysisDataSource>()
  const record: RecordSource = (key, status, patch = {}) => {
    const previous = sources.get(key)
    sources.set(key, {
      ...SOURCE_DEFS[key],
      ...previous,
      ...patch,
      status,
    })
  }
  const list = () => SOURCE_ORDER.map((key) => sources.get(key) ?? SOURCE_DEFS[key])
  return { record, list }
}

function sourceError(err: unknown): string {
  if (err instanceof MlUpstreamError) {
    return `ML ${err.mlStatus}: ${err.bodyText.slice(0, 180)}`
  }
  return err instanceof Error ? err.message : String(err)
}

function itemPermalinkFromId(itemId: string): string {
  const normalizedId = itemId.replace(/^(MLB)(\d+)$/i, "$1-$2")
  return `https://produto.mercadolivre.com.br/${normalizedId}`
}

function deriveAnalysisStatus(params: {
  catalogProductId: string | null
  competitorsCount: number
  sources: AnalysisDataSource[]
}): AnalysisStatus {
  if (!params.catalogProductId) return "not_catalog"
  if (params.competitorsCount === 0) return "no_competitors"

  const relevantKeys = new Set<AnalysisDataSourceKey>([
    "competitor_sellers",
    "competitor_visits",
    "price_to_win",
    "own_visits_7d",
    "own_visits_30d",
    "reference_stock",
  ])
  const hasPartialSource = params.sources.some(
    (source) =>
      relevantKeys.has(source.key) && source.status !== "success" && source.status !== "skipped",
  )
  return hasPartialSource ? "partial" : "success"
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
    available_quantity: null,
    sold_quantity: null,
    listing_type_id: firstListing.listing_type_id ?? "gold_special",
    condition: firstListing.condition ?? "new",
    permalink: product.permalink ?? `https://www.mercadolivre.com.br/p/${product.id}`,
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
  recordSource: RecordSource,
): Promise<ResolveResult> {
  // Strategy A — catalog-first: /products/{rawId}/items + /products/{rawId}
  logger.log("resolve:A", `GET /products/${rawId}/items (with token)`)
  const catalogT0 = Date.now()
  try {
    const [itemsRes, product] = await Promise.all([
      getProductItems(rawId, token),
      getProduct(rawId, token),
    ])
    const listings = itemsRes.results ?? []
    recordSource("catalog_product_items", listings.length > 0 ? "success" : "unavailable", {
      endpoint: `/products/${rawId}/items`,
      count: listings.length,
      used: listings.length > 0,
      durationMs: Date.now() - catalogT0,
      detail: listings.length > 0 ? "Catalogo resolvido com anuncios." : "Catalogo sem anuncios.",
    })
    recordSource("catalog_product", "success", {
      endpoint: `/products/${rawId}`,
      used: listings.length > 0,
      durationMs: Date.now() - catalogT0,
      detail: product.name,
    })

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
    recordSource("catalog_product_items", "failed", {
      endpoint: `/products/${rawId}/items`,
      used: false,
      durationMs: Date.now() - catalogT0,
      error: sourceError(err),
    })
    recordSource("catalog_product", "failed", {
      endpoint: `/products/${rawId}`,
      used: false,
      durationMs: Date.now() - catalogT0,
      error: sourceError(err),
    })
    if (err instanceof MlUpstreamError) {
      logger.log("resolve:A", `✗ ML ${err.mlStatus} — not a catalog_product_id`)
    } else {
      logger.log("resolve:A", `✗ ${String(err)}`)
    }
  }

  // Strategy B — item fallback: /items/{rawId} (works for user's own items)
  logger.log("resolve:B", `GET /items/${rawId} (with token)`)
  const itemT0 = Date.now()
  try {
    const item = await getItem(rawId, token)
    recordSource("item", "success", {
      endpoint: `/items/${rawId}`,
      used: true,
      durationMs: Date.now() - itemT0,
      detail: item.title,
    })
    logger.log(
      "resolve:B",
      `✓ ITEM_RESOLVED — "${item.title}" (catalog=${item.catalog_product_id ?? "none"})`,
    )
    return { type: "item", item }
  } catch (err: unknown) {
    recordSource("item", "failed", {
      endpoint: `/items/${rawId}`,
      used: false,
      durationMs: Date.now() - itemT0,
      error: sourceError(err),
    })
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
    permalink: itemPermalinkFromId(c.item_id),
    visits30d: null,
    visitsShare: null,
    referenceStock: null,
    referenceStockLabel: null,
    referenceStockSource: null,
  }
}

function referenceStockLabel(value: number | null): string | null {
  if (value == null) return null
  if (value === 1) return "1-50"
  if (value === 50) return "51-100"
  if (value === 100) return "101-150"
  if (value === 150) return "151-200"
  if (value === 200) return "201-250"
  if (value === 250) return "251-500"
  if (value === 500) return "501-5000"
  if (value === 5000) return "5001-50000"
  if (value === 50000) return "50001-99999"
  return String(value)
}

// ─── Main orchestration ─────────────────────────────────────────────

export async function getProductAnalysis(token: string, receivedId: string): Promise<FullAnalysis> {
  const logger = createAnalysisLogger()
  const dataSources = createDataSourceRecorder()
  logger.log("start", `receivedId=${receivedId}`)
  const t0 = Date.now()

  const resolved = await resolveId(receivedId, token, logger, dataSources.record)

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
      const discoverT0 = Date.now()
      try {
        const res = await getProductItems(catalogProductId, token)
        allListings = res.results ?? []
        dataSources.record(
          "catalog_product_items",
          allListings.length > 0 ? "success" : "unavailable",
          {
            endpoint: `/products/${catalogProductId}/items`,
            count: allListings.length,
            used: allListings.length > 0,
            durationMs: Date.now() - discoverT0,
            detail:
              allListings.length > 0
                ? "Anuncios do catalogo carregados."
                : "Catalogo sem anuncios retornados.",
          },
        )
        logger.log("discover", `✓ ${allListings.length} listings`)
      } catch (err: unknown) {
        const detail = err instanceof MlUpstreamError ? `ML ${err.mlStatus}` : String(err)
        dataSources.record("catalog_product_items", "failed", {
          endpoint: `/products/${catalogProductId}/items`,
          used: false,
          durationMs: Date.now() - discoverT0,
          error: sourceError(err),
        })
        logger.log("discover", `✗ ${detail} — continuing without competitors`)
      }
    } else {
      dataSources.record("catalog_product_items", "skipped", {
        used: false,
        detail: "Anuncio sem catalog_product_id.",
      })
    }
  }

  // Build competitors from catalog listings
  const competitors = allListings
    .filter((c) => c.item_id !== item.id)
    .map(catalogListingToCompetitor)

  logger.log("competitors", `total=${allListings.length}, afterExcludingSelf=${competitors.length}`)

  // Enrich everything in a single parallel wave using ML API only.
  const uniqueSellerIds = [...new Set(competitors.map((c) => c.sellerId))]
  const competitorItemIds = competitors.map((c) => c.itemId)
  const range7 = dateRange(7)
  const range30 = dateRange(30)
  logger.log(
    "enrich",
    `Fetching ${uniqueSellerIds.length} sellers + ${competitorItemIds.length} visits + reference stock + ptw + own visits`,
  )
  const enrichT0 = Date.now()

  const [sellersResult, visitsResult, stockResult, ptwResult, visits7Result, visits30Result] =
    await Promise.allSettled([
      getSellersBatch(token, uniqueSellerIds),
      getCompetitorVisits(token, competitorItemIds),
      getItemsReferenceStockBatch(token, competitorItemIds),
      getPriceToWin(token, item.id),
      getVisitsBatch(token, [item.id], range7.from, range7.to).then((m) => m.get(item.id) ?? null),
      getVisitsBatch(token, [item.id], range30.from, range30.to).then(
        (m) => m.get(item.id) ?? null,
      ),
    ])

  const sellersMap =
    sellersResult.status === "fulfilled"
      ? sellersResult.value
      : new Map<number, import("@/features/product-analysis/domain/types").MlSeller>()
  const visitsMap =
    visitsResult.status === "fulfilled" ? visitsResult.value : new Map<string, number>()
  const referenceStockMap =
    stockResult.status === "fulfilled"
      ? stockResult.value
      : new Map<string, { availableQuantity: number | null; soldQuantity: number | null }>()
  const ptw = ptwResult.status === "fulfilled" ? ptwResult.value : null
  const visits7 = visits7Result.status === "fulfilled" ? visits7Result.value : null
  const visits30 = visits30Result.status === "fulfilled" ? visits30Result.value : null

  if (uniqueSellerIds.length === 0) {
    dataSources.record("competitor_sellers", "skipped", {
      used: false,
      detail: "Sem concorrentes para enriquecer.",
    })
  } else if (sellersResult.status === "fulfilled") {
    dataSources.record(
      "competitor_sellers",
      sellersMap.size === uniqueSellerIds.length
        ? "success"
        : sellersMap.size > 0
          ? "partial"
          : "unavailable",
      {
        endpoint: `/users?ids=...`,
        count: sellersMap.size,
        used: sellersMap.size > 0,
        durationMs: Date.now() - enrichT0,
        detail: `${sellersMap.size}/${uniqueSellerIds.length} vendedores carregados.`,
      },
    )
  } else {
    dataSources.record("competitor_sellers", "failed", {
      endpoint: `/users?ids=...`,
      used: false,
      durationMs: Date.now() - enrichT0,
      error: sourceError(sellersResult.reason),
    })
  }

  if (competitorItemIds.length === 0) {
    dataSources.record("competitor_visits", "skipped", {
      used: false,
      detail: "Sem concorrentes para buscar visitas.",
    })
  } else if (visitsResult.status === "fulfilled") {
    dataSources.record(
      "competitor_visits",
      visitsMap.size === competitorItemIds.length
        ? "success"
        : visitsMap.size > 0
          ? "partial"
          : "unavailable",
      {
        endpoint: `/items/{id}/visits/time_window`,
        count: visitsMap.size,
        used: visitsMap.size > 0,
        durationMs: Date.now() - enrichT0,
        detail: `${visitsMap.size}/${competitorItemIds.length} visitas carregadas.`,
      },
    )
  } else {
    dataSources.record("competitor_visits", "failed", {
      endpoint: `/items/{id}/visits/time_window`,
      used: false,
      durationMs: Date.now() - enrichT0,
      error: sourceError(visitsResult.reason),
    })
  }

  if (ptwResult.status === "fulfilled") {
    dataSources.record(
      ptw ? (ptw.winner?.item_id ? "price_to_win" : "price_to_win") : "price_to_win",
      ptw ? "success" : "unavailable",
      {
        endpoint: `/items/${item.id}/price_to_win?version=v2`,
        used: !!ptw,
        durationMs: Date.now() - enrichT0,
        detail: ptw
          ? ptw.winner?.item_id
            ? "Buy Box confirmado pela API."
            : "Price to Win retornou sem vencedor confirmado."
          : "Price to Win indisponivel.",
      },
    )
  } else {
    dataSources.record("price_to_win", "failed", {
      endpoint: `/items/${item.id}/price_to_win?version=v2`,
      used: false,
      durationMs: Date.now() - enrichT0,
      error: sourceError(ptwResult.reason),
    })
  }

  dataSources.record(
    "own_visits_7d",
    visits7Result.status === "rejected" ? "failed" : visits7 != null ? "success" : "unavailable",
    {
      endpoint: `/items/visits`,
      count: visits7 != null ? 1 : 0,
      used: visits7 != null,
      durationMs: Date.now() - enrichT0,
      detail:
        visits7 != null ? `${visits7} visitas nos ultimos 7 dias.` : "Visitas 7d indisponiveis.",
      error: visits7Result.status === "rejected" ? sourceError(visits7Result.reason) : undefined,
    },
  )
  dataSources.record(
    "own_visits_30d",
    visits30Result.status === "rejected" ? "failed" : visits30 != null ? "success" : "unavailable",
    {
      endpoint: `/items/visits`,
      count: visits30 != null ? 1 : 0,
      used: visits30 != null,
      durationMs: Date.now() - enrichT0,
      detail:
        visits30 != null
          ? `${visits30} visitas nos ultimos 30 dias.`
          : "Visitas 30d indisponiveis.",
      error: visits30Result.status === "rejected" ? sourceError(visits30Result.reason) : undefined,
    },
  )

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
    const referenceStock = referenceStockMap.get(comp.itemId)
    if (referenceStock) {
      comp.referenceStock = referenceStock.availableQuantity
      comp.referenceStockLabel = referenceStockLabel(referenceStock.availableQuantity)
      comp.referenceStockSource = referenceStock.availableQuantity != null ? "ml_api" : null
    }
  }

  const stockHits = Array.from(referenceStockMap.values()).filter(
    (r) => r.availableQuantity != null,
  ).length
  const catalogMs = Date.now() - enrichT0
  if (competitorItemIds.length === 0) {
    dataSources.record("reference_stock", "skipped", {
      used: false,
      detail: "Sem concorrentes para buscar estoque.",
    })
  } else if (stockResult.status === "rejected") {
    dataSources.record("reference_stock", "failed", {
      endpoint: `/items?ids=...&attributes=id,available_quantity,sold_quantity`,
      used: false,
      durationMs: catalogMs,
      error: sourceError(stockResult.reason),
    })
  } else {
    dataSources.record(
      "reference_stock",
      stockHits === competitorItemIds.length
        ? "success"
        : stockHits > 0
          ? "partial"
          : "unavailable",
      {
        endpoint: `/items?ids=...&attributes=id,available_quantity,sold_quantity`,
        count: stockHits,
        used: stockHits > 0,
        durationMs: catalogMs,
        detail: `Estoque referencial encontrado em ${stockHits}/${competitorItemIds.length} anuncios.`,
      },
    )
  }
  logger.log(
    "enrich",
    `✓ ${sellersMap.size} sellers, ${visitsMap.size} visits (total=${totalVisits}), referenceStock=${stockHits}/${competitorItemIds.length}, ptw=${ptw?.status ?? "N/A"}, visits7d=${visits7}, visits30d=${visits30} in ${catalogMs}ms`,
  )

  const summary = aggregateCompetitors(competitors, item.price)
  dataSources.record("computed_summary", "success", {
    used: true,
    count: competitors.length,
    detail: "Resumo de concorrencia calculado internamente.",
  })
  logger.log(
    "compute",
    `min=${summary.minPrice}, max=${summary.maxPrice}, avg=${summary.avgPrice}, ` +
      `median=${summary.medianPrice}, freeShipping=${summary.freeShippingCount}, ` +
      `fulfillment=${summary.fulfillmentCount}, officialStore=${summary.officialStoreCount}`,
  )

  const catalog = buildCatalogSection(item, visits7, visits30, ptw)
  const totalMs = Date.now() - t0
  const sources = dataSources.list()
  const analysisStatus = deriveAnalysisStatus({
    catalogProductId,
    competitorsCount: competitors.length,
    sources,
  })

  logger.log(
    "done",
    `resolvedType=${resolved.type}, strategy=catalog_product_items, ` +
      `competitors=${competitors.length}, totalTime=${totalMs}ms`,
  )

  return {
    receivedId,
    resolvedInputType: resolved.type,
    primaryItemSource: resolved.type === "catalog_product" ? "synthetic_catalog_item" : "real_item",
    analysisStatus,
    catalog,
    competitors: {
      strategy: "catalog_product_items",
      totalCandidatesRaw: allListings.length,
      totalAfterFilters: competitors.length,
      competitors,
      summary,
      buyBoxWinnerItemId: ptw?.winner?.item_id ?? null,
    },
    dataSources: sources,
    logs: logger.entries,
    fetchedAt: new Date().toISOString(),
    timings: {
      totalMs,
      catalogMs,
      competitorsMs: Date.now() - enrichT0,
    },
  }
}
