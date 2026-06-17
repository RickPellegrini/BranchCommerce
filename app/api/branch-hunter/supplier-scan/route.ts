import { NextRequest } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { getAnyValidMlConnection, requestMlApi } from "@/lib/mercadolivre/storage"
import {
  calculateBranchHunterProfit,
  createDefaultBranchHunterOperationSettings,
  listingTypeFeePercent,
  type BranchHunterOperationSettings,
} from "@/features/product-analysis/utils/branch-hunter-profit"

const ALLOWED_ORIGINS = [
  "chrome-extension://",
  "https://branchcommercehub.com",
  "http://localhost:3000",
]

const PACK_NAME_PATTERN = /\bkit\b|\bcaixa\b|\bc\/\d+\b|\bx\s*\d+\b|pacote\s*x\s*\d+/i

type SupplierRowInput = {
  code?: string
  name?: string
  gtin?: string
  cost?: number
}

type SupplierScanSettingsInput = Partial<BranchHunterOperationSettings>

type ProductSearchResult = {
  id?: string
  catalog_product_id?: string
  domain_id?: string
  name?: string
  attributes?: Array<{
    id?: string
    value_name?: string | null
    values?: Array<{ name?: string | null }>
  }>
}

type ProductItemsResult = {
  results?: Array<{
    item_id?: string
    price?: number
    listing_type_id?: string
  }>
}

function getAllowedOrigin(request?: NextRequest): string {
  const origin = request?.headers.get("origin") ?? ""
  if (ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    return origin
  }
  return ALLOWED_ORIGINS[0]
}

function corsHeaders(request?: NextRequest) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(request),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-branch-hunter-key",
    Vary: "Origin",
  }
}

function parseNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeGtin(value: unknown) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .trim()
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function parseSize(text: string) {
  const match = text.toUpperCase().match(/(\d+[.,]?\d*)\s*(ML|G)\b/)
  if (!match) return null
  return {
    value: Number(match[1].replace(",", ".")),
    unit: match[2],
  }
}

function getAttrValue(attrs: ProductSearchResult["attributes"], id: string): string | null {
  const found = attrs?.find((attr) => attr.id === id)
  if (!found) return null
  return found.value_name ?? found.values?.[0]?.name ?? null
}

function shouldRejectPackMismatch(supplierName: string, catalogName: string) {
  const supplierIsKit = /\bkit\b/i.test(supplierName)
  return !supplierIsKit && PACK_NAME_PATTERN.test(catalogName)
}

async function searchMatchingCatalogProduct(
  row: Required<Pick<SupplierRowInput, "name" | "gtin" | "cost">> & { code: string | null },
  accessToken: string,
) {
  const search = await requestMlApi<{
    results?: ProductSearchResult[]
  }>(
    `/products/search?status=active&site_id=MLB&product_identifier=${encodeURIComponent(row.gtin)}&limit=8`,
    accessToken,
    { method: "GET" },
  )

  const results = Array.isArray(search.results) ? search.results : []
  if (results.length === 0) return null

  const supplierSize = parseSize(row.name)
  let matched: ProductSearchResult | null = null

  for (const result of results) {
    const attrs = result.attributes ?? []
    const gtin = normalizeGtin(getAttrValue(attrs, "GTIN"))
    if (gtin !== row.gtin) continue

    const unitsPerPackRaw = getAttrValue(attrs, "UNITS_PER_PACK")
    const unitsPerPack = Number(String(unitsPerPackRaw ?? "1").replace(/[^\d.]/g, "")) || 1
    if (!/\bkit\b/i.test(row.name) && unitsPerPack > 1) continue

    const unitSize = parseSize(
      getAttrValue(attrs, "UNIT_WEIGHT") ?? getAttrValue(attrs, "NET_WEIGHT") ?? result.name ?? "",
    )
    if (supplierSize && unitSize && supplierSize.unit === unitSize.unit) {
      const ratio = unitSize.value / supplierSize.value
      if (ratio < 0.8 || ratio > 1.25) continue
    }

    matched = result
    break
  }

  if (!matched?.id || !matched.name) return null
  if (shouldRejectPackMismatch(row.name, matched.name)) return null
  return matched
}

async function scanRow(
  row: Required<Pick<SupplierRowInput, "name" | "gtin" | "cost">> & { code: string | null },
  accessToken: string,
  settings: BranchHunterOperationSettings,
) {
  const matchedProduct = await searchMatchingCatalogProduct(row, accessToken)
  if (!matchedProduct?.id || !matchedProduct.name) return null

  const items = await requestMlApi<ProductItemsResult>(
    `/products/${matchedProduct.id}/items`,
    accessToken,
    { method: "GET" },
  )
  const offers = (items.results ?? []).filter(
    (item) => Number.isFinite(item.price) && Number(item.price) > 0,
  )
  if (offers.length === 0) return null

  offers.sort((left, right) => Number(left.price) - Number(right.price))
  const cheapest = offers[0]
  if (!cheapest?.item_id || !Number.isFinite(cheapest.price)) return null

  const salePrice = Number(cheapest.price)
  const feePercent = listingTypeFeePercent(settings.listingType || cheapest.listing_type_id)
  const calculation = calculateBranchHunterProfit(
    {
      salePrice,
      saleFeePercent: feePercent,
    },
    {
      ...settings,
      productCost: row.cost,
    },
  )
  const grossMargin = salePrice > 0 ? ((salePrice - row.cost) / salePrice) * 100 : 0

  return {
    supplierCode: row.code,
    supplierName: row.name,
    supplierCost: row.cost,
    gtin: row.gtin,
    catalogName: matchedProduct.name,
    catalogProductId: matchedProduct.id,
    salePrice,
    feePercent,
    feeAmount: calculation.marketplaceFeeAmount,
    shippingCostUsed: calculation.shippingCostUsed,
    centralizeFixedCosts: calculation.centralizeFixedCosts,
    fullCosts: calculation.fullCosts,
    fullUnitCost: calculation.fullUnitCost,
    fullCollectionUnitCost: calculation.fullCollectionUnitCost,
    additionalCosts:
      calculation.adsAmount +
      calculation.riskAmount +
      settings.packagingCost +
      settings.otherFixedCosts,
    totalCosts: calculation.totalCosts,
    netProfit: calculation.netProfit,
    netMargin: calculation.netMarginPercent,
    grossMargin,
    offers: offers.length,
    catalogLink: `https://www.mercadolivre.com.br/p/${matchedProduct.id}`,
    itemLink: `https://produto.mercadolivre.com.br/${cheapest.item_id}`,
  }
}

function normalizeOperationSettings(
  input: SupplierScanSettingsInput | undefined,
): BranchHunterOperationSettings {
  const defaults = createDefaultBranchHunterOperationSettings()

  return {
    listingType: input?.listingType === "premium" ? "premium" : defaults.listingType,
    productCost: defaults.productCost,
    shippingFallback: parseNumber(input?.shippingFallback) ?? defaults.shippingFallback,
    forceManualShipping: Boolean(input?.forceManualShipping),
    freeShippingEnabled:
      input?.freeShippingEnabled === undefined
        ? defaults.freeShippingEnabled
        : Boolean(input.freeShippingEnabled),
    freeShippingMinPrice: parseNumber(input?.freeShippingMinPrice) ?? defaults.freeShippingMinPrice,
    freeShippingSubsidyPercent:
      parseNumber(input?.freeShippingSubsidyPercent) ?? defaults.freeShippingSubsidyPercent,
    defaultShippingCost: parseNumber(input?.defaultShippingCost) ?? defaults.defaultShippingCost,
    centralizeEnabled:
      input?.centralizeEnabled === undefined
        ? defaults.centralizeEnabled
        : Boolean(input.centralizeEnabled),
    fullEnabled: Boolean(input?.fullEnabled),
    fullShipmentUnits: parseNumber(input?.fullShipmentUnits) ?? defaults.fullShipmentUnits,
    fullCollectionCost: parseNumber(input?.fullCollectionCost) ?? defaults.fullCollectionCost,
    packagingCost: parseNumber(input?.packagingCost) ?? defaults.packagingCost,
    otherFixedCosts: parseNumber(input?.otherFixedCosts) ?? defaults.otherFixedCosts,
    adsPercent: parseNumber(input?.adsPercent) ?? defaults.adsPercent,
    riskPercent: parseNumber(input?.riskPercent) ?? defaults.riskPercent,
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}

export async function POST(request: NextRequest) {
  try {
    const syncKey = String(process.env.BRANCH_HUNTER_SYNC_KEY ?? "").trim()
    const providedKey = String(request.headers.get("x-branch-hunter-key") ?? "").trim()
    const keyIsValid = Boolean(syncKey) && providedKey === syncKey

    if (!keyIsValid) {
      try {
        await requireAuthenticatedAppUserId()
      } catch {
        return Response.json(
          { ok: false, error: "Nao autenticado para usar a analise de fornecedor." },
          { status: 401, headers: corsHeaders(request) },
        )
      }
    }

    const body = (await request.json()) as {
      rows?: SupplierRowInput[]
      minMargin?: number
      settings?: SupplierScanSettingsInput
    }

    const rows = Array.isArray(body.rows) ? body.rows : []
    const minMargin = parseNumber(body.minMargin) ?? 15
    const settings = normalizeOperationSettings(body.settings)

    if (rows.length === 0) {
      return Response.json(
        { ok: false, error: "rows obrigatorio." },
        { status: 400, headers: corsHeaders(request) },
      )
    }

    const normalizedRows = rows
      .map((row) => ({
        code: normalizeText(row.code) || null,
        name: normalizeText(row.name),
        gtin: normalizeGtin(row.gtin),
        cost: parseNumber(row.cost),
      }))
      .filter((row): row is { code: string | null; name: string; gtin: string; cost: number } => {
        return Boolean(row.name) && Boolean(row.gtin) && Number.isFinite(row.cost)
      })
      .slice(0, 150)

    if (normalizedRows.length === 0) {
      return Response.json(
        { ok: false, error: "Nenhuma linha valida encontrada." },
        { status: 400, headers: corsHeaders(request) },
      )
    }

    const connection = await getAnyValidMlConnection()
    const scanned = await Promise.all(
      normalizedRows.map(async (row) => {
        try {
          return await scanRow(row, connection.accessToken, settings)
        } catch {
          return null
        }
      }),
    )

    const matches = scanned.filter((row) => row !== null)
    const winners = matches
      .filter((row) => row.netMargin >= minMargin)
      .sort((left, right) => right.netMargin - left.netMargin)
    const allResults = [...matches].sort((left, right) => right.netMargin - left.netMargin)

    return Response.json(
      {
        ok: true,
        data: {
          scanned: normalizedRows.length,
          matched: matches.length,
          minMargin,
          settingsUsed: settings,
          allResults,
          winners,
        },
      },
      { status: 200, headers: corsHeaders(request) },
    )
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Erro ao processar a planilha do fornecedor.",
      },
      { status: 500, headers: corsHeaders(request) },
    )
  }
}
