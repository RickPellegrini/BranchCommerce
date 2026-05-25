// ─── ML API response shapes ───

export type MlAttribute = {
  id: string
  name: string
  value_id?: string | null
  value_name?: string | null
  value_struct?: { number?: number; unit?: string } | null
  values?: Array<{ id?: string | null; name?: string | null }>
  attribute_group_id?: string
  attribute_group_name?: string
}

export type MlPicture = {
  id: string
  url: string
  secure_url?: string
}

export type MlItemFull = {
  id: string
  title: string
  site_id: string
  category_id: string
  domain_id?: string
  price: number
  original_price?: number | null
  currency_id?: string
  available_quantity: number | null
  sold_quantity: number | null
  listing_type_id: string
  condition: string
  permalink: string
  thumbnail: string
  secure_thumbnail?: string
  pictures?: MlPicture[]
  attributes?: MlAttribute[]
  tags?: string[]
  catalog_product_id?: string | null
  user_product_id?: string | null
  seller_id: number
  official_store_id?: number | null
  status: string
  date_created?: string
  last_updated?: string
  shipping?: {
    logistic_type?: string
    free_shipping?: boolean
    mode?: string
    tags?: string[]
  }
  seller_address?: {
    city?: { name?: string }
    state?: { name?: string }
    country?: { name?: string }
  }
  health?: number | null
  catalog_listing?: boolean
}

// Shape returned by GET /products/{product_id}/items → results[]
export type CatalogCompetitor = {
  item_id: string
  site_id?: string
  seller_id: number
  accepts_mercadopago?: boolean
  price: number
  category_id?: string
  currency_id?: string
  warranty?: string | null
  condition?: string
  listing_type_id?: string
  international_delivery_mode?: string
  tier?: string
  inventory_id?: string
  tags?: string[]
  deal_ids?: string[]
  official_store_id?: number | null
  original_price?: number | null
  shipping?: {
    free_shipping?: boolean
    store_pick_up?: boolean
    mode?: string
    logistic_type?: string
    tags?: string[]
  }
  seller_address?: {
    city?: { name?: string }
    state?: { name?: string }
  }
  sale_terms?: Array<{
    id?: string
    name?: string
    value_name?: string | null
  }>
}

export type CatalogProductItemsResponse = {
  paging?: { total?: number; offset?: number; limit?: number }
  results: CatalogCompetitor[]
}

export type MlSellerReputation = {
  level_id?: string | null
  power_seller_status?: string | null
  transactions?: { total?: number; period?: string }
}

export type MlSeller = {
  id: number
  nickname: string
  user_type?: string
  permalink?: string
  address?: { city?: string; state?: string }
  seller_reputation?: MlSellerReputation
  status?: { site_status?: string }
}

export type MlSellerBatchEntry = {
  code: number
  body: MlSeller
}

export type MlItemBatchBody = {
  id: string
  title?: string
  available_quantity?: number | null
  sold_quantity?: number | null
  status?: string
  seller_id?: number
  catalog_product_id?: string | null
  permalink?: string
}

export type MlItemBatchEntry = {
  code: number
  body?: MlItemBatchBody
}

export type MlProduct = {
  id: string
  catalog_product_id?: string
  name: string
  family_name?: string
  domain_id?: string
  permalink?: string
  status?: string
  pictures?: Array<{
    id: string
    url: string
    suggested_for_picker?: string | null
    max_width?: number
    max_height?: number
  }>
  attributes?: MlAttribute[]
  main_features?: Array<{ text?: string }>
  date_created?: string
  last_updated?: string
  tags?: string[]
}

export type MlSearchResultItem = {
  id: string
  title: string
  price: number
  original_price?: number | null
  available_quantity: number
  sold_quantity: number
  condition: string
  permalink: string
  thumbnail: string
  category_id?: string
  domain_id?: string
  catalog_product_id?: string | null
  seller: { id: number; nickname?: string }
  seller_id?: number
  official_store_id?: number | null
  listing_type_id?: string
  attributes?: MlAttribute[]
  tags?: string[]
  shipping?: {
    logistic_type?: string
    free_shipping?: boolean
  }
}

export type MlSearchResult = {
  paging: { total: number; offset: number; limit: number }
  results: MlSearchResultItem[]
}

export type MlPriceToWinResult = {
  item_id: string
  current_price?: number
  price_to_win: number | null
  status: string
  reason?: string[]
  visit_share?: string | null
  competitors_sharing_first_place?: number | null
  catalog_product_id?: string | null
  winner?: { item_id?: string; price?: number; currency_id?: string } | null
  boosts?: Array<{ id?: string; status?: string; description?: string }>
}

export type MlVisitsEntry = {
  item_id: string
  total_visits: number
}

// ─── Feature output shapes ───

export type CatalogStatus = "linked" | "eligible" | "not_catalog" | "undetermined"

export type Identifiers = {
  gtin: string | null
  brand: string | null
  model: string | null
}

export type CompletenessDetail = { field: string; present: boolean; weight: number }

export type CatalogSection = {
  status: CatalogStatus
  catalogProductId: string | null
  item: {
    id: string
    title: string
    categoryId: string
    domainId: string | null
    price: number
    originalPrice: number | null
    stock: number | null
    sold: number | null
    listingType: string
    condition: string
    permalink: string
    thumbnail: string
    pictures: Array<{ id: string; url: string }>
    freeShipping: boolean
    shippingType: string | null
    officialStore: boolean
    createdAt: string | null
    ageDays: number
  }
  attributes: Array<{ key: string; name: string; value: string }>
  identifiers: Identifiers & { hasGtin: boolean; hasBrand: boolean; hasModel: boolean }
  completenessScore: number
  completenessDetails: CompletenessDetail[]
  visits: { "7d": number | null; "30d": number | null }
  priceToWin: MlPriceToWinResult | null
}

export type CompetitorEntry = {
  itemId: string
  sellerId: number
  price: number
  originalPrice: number | null
  condition: string | null
  listingType: string | null
  officialStore: boolean
  freeShipping: boolean
  shippingMode: string | null
  logisticType: string | null
  tier: string | null
  warranty: string | null
  location: string | null
  tags: string[]
  title: string | null
  sellerNickname: string | null
  sellerPowerStatus: string | null
  sellerRepLevel: string | null
  sellerTotalTransactions: number | null
  sellerPermalink: string | null
  thumbnail: string | null
  permalink: string | null
  visits30d: number | null
  visitsShare: number | null
  referenceStock: number | null
  referenceStockLabel: string | null
  referenceStockSource: "ml_api" | "extension_page" | null
}

export type CompetitorSummary = {
  count: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  medianPrice: number
  myPricePosition: number
  myPricePercentile: number
  officialStoreCount: number
  freeShippingCount: number
  fulfillmentCount: number
  top5: CompetitorEntry[]
}

export type DiscoveryStrategy = "catalog_product_items"

export type AnalysisStatus = "success" | "partial" | "no_competitors" | "not_catalog"

export type ResolvedInputType = "catalog_product" | "item"

export type PrimaryItemSource = "real_item" | "synthetic_catalog_item"

export type AnalysisDataSourceKey =
  | "catalog_product_items"
  | "catalog_product"
  | "item"
  | "competitor_sellers"
  | "competitor_visits"
  | "price_to_win"
  | "own_visits_7d"
  | "own_visits_30d"
  | "reference_stock"
  | "computed_summary"

export type AnalysisDataSourceKind = "mercadolivre_api" | "computed"

export type AnalysisDataSourceStatus = "success" | "partial" | "failed" | "skipped" | "unavailable"

export type AnalysisDataSource = {
  key: AnalysisDataSourceKey
  label: string
  kind: AnalysisDataSourceKind
  status: AnalysisDataSourceStatus
  used: boolean
  endpoint?: string
  count?: number
  detail?: string
  error?: string
  durationMs?: number
}

export type CompetitorSection = {
  strategy: DiscoveryStrategy
  totalCandidatesRaw: number
  totalAfterFilters: number
  competitors: CompetitorEntry[]
  summary: CompetitorSummary
  buyBoxWinnerItemId: string | null
}

export type LogEntry = { step: string; detail: string; count?: number; ms?: number }

export type FullAnalysis = {
  receivedId: string
  resolvedInputType: ResolvedInputType
  primaryItemSource: PrimaryItemSource
  analysisStatus: AnalysisStatus
  catalog: CatalogSection
  competitors: CompetitorSection
  dataSources: AnalysisDataSource[]
  logs: LogEntry[]
  fetchedAt: string
  timings: { totalMs: number; catalogMs: number; competitorsMs: number }
}
