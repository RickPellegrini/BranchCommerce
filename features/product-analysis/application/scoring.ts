import type { MlItemFull, CompletenessDetail } from "@/features/product-analysis/domain/types"
import {
  extractGtin,
  extractBrand,
  extractModel,
} from "@/features/product-analysis/utils/normalize"

const FIELDS: Array<{ field: string; weight: number; test: (item: MlItemFull) => boolean }> = [
  { field: "catalog_product_id", weight: 15, test: (i) => !!i.catalog_product_id },
  { field: "gtin", weight: 10, test: (i) => !!extractGtin(i.attributes ?? []) },
  { field: "brand", weight: 10, test: (i) => !!extractBrand(i.attributes ?? []) },
  { field: "model", weight: 10, test: (i) => !!extractModel(i.attributes ?? []) },
  { field: "pictures_3+", weight: 10, test: (i) => (i.pictures?.length ?? 0) >= 3 },
  { field: "attributes_5+", weight: 10, test: (i) => (i.attributes?.length ?? 0) >= 5 },
  { field: "free_shipping", weight: 10, test: (i) => !!i.shipping?.free_shipping },
  {
    field: "original_price",
    weight: 5,
    test: (i) => i.original_price != null && i.original_price > i.price,
  },
  { field: "condition_new", weight: 5, test: (i) => i.condition === "new" },
  { field: "stock_positive", weight: 15, test: (i) => i.available_quantity > 0 },
]

export function computeCompleteness(item: MlItemFull): {
  score: number
  details: CompletenessDetail[]
} {
  let earned = 0
  let total = 0
  const details: CompletenessDetail[] = []
  for (const f of FIELDS) {
    const present = f.test(item)
    details.push({ field: f.field, present, weight: f.weight })
    total += f.weight
    if (present) earned += f.weight
  }
  return { score: total > 0 ? Math.round((earned / total) * 100) : 0, details }
}
