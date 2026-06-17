export const BRANCH_HUNTER_LISTING_TYPE_FEES = {
  premium: 16,
  gold_special: 12,
} as const

const CENTRALIZE_FIXED_SHIPPING = 5
const CENTRALIZE_FIXED_PACKAGING = 1.5
const FULL_COST_PER_UNIT_UP_TO_100 = 2
const FULL_COST_PER_UNIT_ABOVE_100 = 1

export type BranchHunterListingType = "gold_special" | "premium"

export type BranchHunterOperationSettings = {
  listingType: BranchHunterListingType
  productCost: number
  shippingFallback: number
  forceManualShipping: boolean
  freeShippingEnabled: boolean
  freeShippingMinPrice: number
  freeShippingSubsidyPercent: number
  defaultShippingCost: number
  centralizeEnabled: boolean
  fullEnabled: boolean
  fullShipmentUnits: number
  fullCollectionCost: number
  packagingCost: number
  otherFixedCosts: number
  adsPercent: number
  riskPercent: number
}

export type BranchHunterMarketplaceContext = {
  salePrice: number
  saleFeePercent: number | null
}

export type BranchHunterProfitResult = {
  marketplaceFeeAmount: number
  adsAmount: number
  riskAmount: number
  shippingCostUsed: number
  centralizeFixedCosts: number
  fullCosts: number
  fullUnitCost: number
  fullCollectionUnitCost: number
  totalCosts: number
  netProfit: number
  netMarginPercent: number
}

function toNumberOrZero(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function toPercentValue(value: unknown) {
  return toNumberOrZero(value) / 100
}

export function createDefaultBranchHunterOperationSettings(): BranchHunterOperationSettings {
  return {
    listingType: "gold_special",
    productCost: 0,
    shippingFallback: 12,
    forceManualShipping: false,
    freeShippingEnabled: true,
    freeShippingMinPrice: 79,
    freeShippingSubsidyPercent: 50,
    defaultShippingCost: 12,
    centralizeEnabled: true,
    fullEnabled: false,
    fullShipmentUnits: 100,
    fullCollectionCost: 100,
    packagingCost: 0,
    otherFixedCosts: 0,
    adsPercent: 0,
    riskPercent: 0,
  }
}

function resolveFullUnitCost(operation: BranchHunterOperationSettings) {
  if (!operation.fullEnabled) {
    return {
      fullUnitCost: 0,
      fullCollectionUnitCost: 0,
      fullCosts: 0,
    }
  }

  const shipmentUnits = Math.max(1, toNumberOrZero(operation.fullShipmentUnits))
  const collectionCost = Math.max(0, toNumberOrZero(operation.fullCollectionCost))
  const perUnitBase =
    shipmentUnits > 100 ? FULL_COST_PER_UNIT_ABOVE_100 : FULL_COST_PER_UNIT_UP_TO_100
  const collectionPerUnit = collectionCost / shipmentUnits

  return {
    fullUnitCost: perUnitBase,
    fullCollectionUnitCost: collectionPerUnit,
    fullCosts: perUnitBase + collectionPerUnit,
  }
}

export function listingTypeFeePercent(listingType: string | null | undefined) {
  const normalized = String(listingType ?? "").toLowerCase()
  if (normalized === "premium" || normalized === "gold_pro") {
    return BRANCH_HUNTER_LISTING_TYPE_FEES.premium
  }
  return BRANCH_HUNTER_LISTING_TYPE_FEES.gold_special
}

function resolveShippingCost(
  grossRevenue: number,
  operation: BranchHunterOperationSettings,
): number {
  const defaultShippingCost = Math.max(0, toNumberOrZero(operation.defaultShippingCost))
  const manualShippingValue = Math.max(0, toNumberOrZero(operation.shippingFallback))

  if (operation.forceManualShipping) {
    return manualShippingValue
  }

  if (!operation.freeShippingEnabled) {
    return defaultShippingCost
  }

  const freeShippingMinPrice = Math.max(0, toNumberOrZero(operation.freeShippingMinPrice))
  const freeShippingSubsidyPercent = Math.min(
    100,
    Math.max(0, toNumberOrZero(operation.freeShippingSubsidyPercent)),
  )

  if (grossRevenue >= freeShippingMinPrice) {
    return Math.max(0, defaultShippingCost * (1 - freeShippingSubsidyPercent / 100))
  }

  return defaultShippingCost
}

export function calculateBranchHunterProfit(
  marketplace: BranchHunterMarketplaceContext,
  operation: BranchHunterOperationSettings,
): BranchHunterProfitResult {
  const grossRevenue = Math.max(0, toNumberOrZero(marketplace.salePrice))
  const feePercent =
    marketplace.saleFeePercent != null
      ? Math.max(0, toNumberOrZero(marketplace.saleFeePercent))
      : listingTypeFeePercent(operation.listingType)

  const marketplaceFeeAmount = grossRevenue * (feePercent / 100)
  const adsAmount = grossRevenue * toPercentValue(operation.adsPercent)
  const riskAmount = grossRevenue * toPercentValue(operation.riskPercent)
  const shippingCostUsed = resolveShippingCost(grossRevenue, operation)
  const productCost = Math.max(0, toNumberOrZero(operation.productCost))
  const packagingCost = Math.max(0, toNumberOrZero(operation.packagingCost))
  const otherFixedCosts = Math.max(0, toNumberOrZero(operation.otherFixedCosts))
  const centralizeFixedCosts = operation.centralizeEnabled
    ? CENTRALIZE_FIXED_SHIPPING + CENTRALIZE_FIXED_PACKAGING
    : 0
  const { fullUnitCost, fullCollectionUnitCost, fullCosts } = resolveFullUnitCost(operation)

  const totalCosts =
    marketplaceFeeAmount +
    adsAmount +
    riskAmount +
    shippingCostUsed +
    productCost +
    packagingCost +
    otherFixedCosts +
    centralizeFixedCosts +
    fullCosts

  const netProfit = grossRevenue - totalCosts
  const netMarginPercent = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

  return {
    marketplaceFeeAmount,
    adsAmount,
    riskAmount,
    shippingCostUsed,
    centralizeFixedCosts,
    fullCosts,
    fullUnitCost,
    fullCollectionUnitCost,
    totalCosts,
    netProfit,
    netMarginPercent,
  }
}
