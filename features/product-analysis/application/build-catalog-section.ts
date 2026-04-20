import type {
  MlItemFull,
  CatalogSection,
  CatalogStatus,
  MlPriceToWinResult,
} from "@/features/product-analysis/domain/types"
import {
  extractGtin,
  extractBrand,
  extractModel,
} from "@/features/product-analysis/utils/normalize"
import { daysSince } from "@/features/product-analysis/utils/dates"
import { computeCompleteness } from "@/features/product-analysis/application/scoring"

function determineCatalogStatus(item: MlItemFull): CatalogStatus {
  if (item.catalog_product_id) return "linked"
  if (item.tags?.includes("catalog_listing_eligible")) return "eligible"
  if (item.catalog_listing) return "linked"
  return "not_catalog"
}

function buildAttributes(
  attrs: Array<import("@/features/product-analysis/domain/types").MlAttribute>,
): CatalogSection["attributes"] {
  return attrs.map((a) => ({
    key: a.id,
    name: a.name,
    value: a.value_name ?? a.values?.[0]?.name ?? "-",
  }))
}

export function buildCatalogSection(
  item: MlItemFull,
  visits7d: number | null,
  visits30d: number | null,
  ptw: MlPriceToWinResult | null,
): CatalogSection {
  const attrs = item.attributes ?? []
  const gtin = extractGtin(attrs)
  const brand = extractBrand(attrs)
  const model = extractModel(attrs)
  const { score, details } = computeCompleteness(item)

  return {
    status: determineCatalogStatus(item),
    catalogProductId: item.catalog_product_id ?? null,
    item: {
      id: item.id,
      title: item.title,
      categoryId: item.category_id,
      domainId: item.domain_id ?? null,
      price: item.price,
      originalPrice: item.original_price ?? null,
      stock: item.available_quantity,
      sold: item.sold_quantity,
      listingType: item.listing_type_id,
      condition: item.condition,
      permalink: item.permalink,
      thumbnail: item.thumbnail,
      pictures: (item.pictures ?? []).map((p) => ({ id: p.id, url: p.secure_url ?? p.url })),
      freeShipping: !!item.shipping?.free_shipping,
      shippingType: item.shipping?.logistic_type ?? null,
      officialStore: !!item.official_store_id,
      createdAt: item.date_created ?? null,
      ageDays: daysSince(item.date_created),
    },
    attributes: buildAttributes(attrs),
    identifiers: {
      gtin,
      brand,
      model,
      hasGtin: !!gtin,
      hasBrand: !!brand,
      hasModel: !!model,
    },
    completenessScore: score,
    completenessDetails: details,
    visits: { "7d": visits7d, "30d": visits30d },
    priceToWin: ptw,
  }
}
