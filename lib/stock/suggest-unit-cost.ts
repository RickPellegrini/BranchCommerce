export type ProductCostLookup = {
  id: string
  sku: string
  name: string
  unitCost: number
  category: string
  mlItemId?: string
}

export type SuggestUnitCostResult = {
  suggestedCost: number | null
  source:
    | "sku_match"
    | "title_exact"
    | "title_prefix"
    | "ml_category_median"
    | "global_median"
    | null
  detail: string
  /** Produto no estoque a atualizar/vincular (mesmo SKU ou nome), nao usar addProduct. */
  matchedProductId: string | null
}

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Sugere custo unitario olhando outros produtos no estoque (SKU, nome, medianas).
 */
export function suggestUnitCostFromInventory(input: {
  sellerSku?: string | null
  listingTitle: string
  products: ProductCostLookup[]
}): SuggestUnitCostResult {
  const { sellerSku, listingTitle, products } = input

  const withPositiveCost = products.filter((p) => p.unitCost > 0)

  if (sellerSku?.trim()) {
    const skuUp = sellerSku.trim().toUpperCase()
    const byMlId = withPositiveCost.find(
      (p) => p.mlItemId?.toUpperCase() === skuUp || p.sku.toUpperCase() === skuUp,
    )
    if (byMlId) {
      return {
        suggestedCost: byMlId.unitCost,
        source: "sku_match",
        detail: `Produto vinculado no estoque (${byMlId.mlItemId ?? byMlId.sku}).`,
        matchedProductId: byMlId.id,
      }
    }
  }

  const nt = normalizeTitle(listingTitle)
  const byExactName = withPositiveCost.find((p) => normalizeTitle(p.name) === nt)
  if (byExactName) {
    return {
      suggestedCost: byExactName.unitCost,
      source: "title_exact",
      detail: `Produto com o mesmo nome no estoque.`,
      matchedProductId: byExactName.id,
    }
  }

  const prefixLen = Math.min(24, Math.max(10, Math.floor(nt.length * 0.35)))
  const prefix = nt.slice(0, prefixLen)
  if (prefix.length >= 8) {
    const byPrefix = withPositiveCost.find((p) =>
      normalizeTitle(p.name).startsWith(prefix.slice(0, 12)),
    )
    if (byPrefix) {
      return {
        suggestedCost: byPrefix.unitCost,
        source: "title_prefix",
        detail: `Nome parecido: "${byPrefix.name.slice(0, 48)}${byPrefix.name.length > 48 ? "…" : ""}".`,
        matchedProductId: byPrefix.id,
      }
    }
  }

  const mlCat = withPositiveCost.filter((p) => p.category.trim() === "Mercado Livre")
  if (mlCat.length > 0) {
    const sorted = [...mlCat].sort((a, b) => a.unitCost - b.unitCost)
    const mid = sorted[Math.floor(sorted.length / 2)]!.unitCost
    return {
      suggestedCost: mid,
      source: "ml_category_median",
      detail: "Mediana dos produtos na categoria Mercado Livre.",
      matchedProductId: null,
    }
  }

  if (withPositiveCost.length > 0) {
    const sorted = [...withPositiveCost].sort((a, b) => a.unitCost - b.unitCost)
    const mid = sorted[Math.floor(sorted.length / 2)]!.unitCost
    return {
      suggestedCost: mid,
      source: "global_median",
      detail: "Mediana de todos os produtos com custo > 0 (fallback).",
      matchedProductId: null,
    }
  }

  return {
    suggestedCost: null,
    source: null,
    detail: "Nenhum custo encontrado para inferir — informe manualmente.",
    matchedProductId: null,
  }
}
