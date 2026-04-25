;(() => {
  const CENTRALIZE_FIXED_SHIPPING = 5
  const CENTRALIZE_FIXED_PACKAGING = 1.5

  function toNumberOrZero(value) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
  }

  function toPercentValue(value) {
    return toNumberOrZero(value) / 100
  }

  function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }

  function resolveShippingCost(grossRevenue, marketplace, operation) {
    const defaultShippingCost = Math.max(0, toNumberOrZero(operation?.defaultShippingCost))
    const manualShippingValue = Math.max(0, toNumberOrZero(operation?.shippingFallback))
    const forceManualShipping = Boolean(operation?.forceManualShipping)
    if (forceManualShipping) {
      return {
        shippingCostUsed: manualShippingValue,
        shippingCostSource: "manual",
        shippingModeLabel: "Frete manual definido pelo usuario",
        shippingModeDetail: `Valor manual aplicado: R$ ${manualShippingValue.toFixed(2)}`,
      }
    }

    // Business rule: when manual freight is OFF, base freight is always the default fixed value.
    const baseShippingCost = defaultShippingCost

    const freeShippingEnabled = Boolean(operation?.freeShippingEnabled)
    const freeShippingMinPrice = Math.max(0, toNumberOrZero(operation?.freeShippingMinPrice))
    const freeShippingSubsidyPercent = Math.min(
      100,
      Math.max(0, toNumberOrZero(operation?.freeShippingSubsidyPercent)),
    )

    if (!freeShippingEnabled) {
      return {
        shippingCostUsed: defaultShippingCost,
        shippingCostSource: "default",
        shippingModeLabel: "Frete padrao (SP)",
        shippingModeDetail: `Frete gratis desligado. Valor padrao: R$ ${defaultShippingCost.toFixed(2)}`,
      }
    }

    const qualifiesForSubsidy = freeShippingEnabled && grossRevenue >= freeShippingMinPrice
    if (qualifiesForSubsidy) {
      const subsidizedCost = baseShippingCost * (1 - freeShippingSubsidyPercent / 100)
      return {
        shippingCostUsed: Math.max(0, subsidizedCost),
        shippingCostSource: "ml_subsidy",
        shippingModeLabel: "Frete gratis com subsidio do Mercado Livre",
        shippingModeDetail: `Custo base R$ ${baseShippingCost.toFixed(2)} com subsidio de ${freeShippingSubsidyPercent.toFixed(0)}%`,
      }
    }

    return {
      shippingCostUsed: defaultShippingCost,
      shippingCostSource: "default",
      shippingModeLabel: "Frete padrao (SP)",
      shippingModeDetail: `Valor padrao configurado: R$ ${defaultShippingCost.toFixed(2)}`,
    }
  }

  function resolveMarketplaceFeeAmount(grossRevenue, marketplace) {
    const saleFeeAmount = toNullableNumber(marketplace.saleFeeAmount)
    if (saleFeeAmount !== null && saleFeeAmount >= 0) return saleFeeAmount

    const feePercent = Math.max(0, toNumberOrZero(marketplace.saleFeePercent))
    return grossRevenue * (feePercent / 100)
  }

  /**
   * Calculation core:
   * - separates marketplace dynamic data from seller operation costs
   * - applies explicit shipping priority: real -> estimated -> fallback
   */
  function calculateHybridResult(input) {
    const marketplace = input?.marketplace || {}
    const operation = input?.operation || {}

    const grossRevenue = Math.max(0, toNumberOrZero(marketplace.salePrice))
    const marketplaceFeeAmount = resolveMarketplaceFeeAmount(grossRevenue, marketplace)
    const taxAmount = 0
    const adsAmount = grossRevenue * toPercentValue(operation.adsPercent)
    const riskAmount = grossRevenue * toPercentValue(operation.riskPercent)

    const { shippingCostUsed, shippingCostSource, shippingModeLabel, shippingModeDetail } =
      resolveShippingCost(grossRevenue, marketplace, operation)

    const productCost = Math.max(0, toNumberOrZero(operation.productCost))
    const packagingCost = Math.max(0, toNumberOrZero(operation.packagingCost))
    const otherFixedCosts = Math.max(0, toNumberOrZero(operation.otherFixedCosts))
    const centralizeOn =
      operation.centralizeEnabled === undefined ? true : Boolean(operation.centralizeEnabled)
    const centralizeFixedCosts = centralizeOn
      ? CENTRALIZE_FIXED_SHIPPING + CENTRALIZE_FIXED_PACKAGING
      : 0

    const totalCosts =
      marketplaceFeeAmount +
      taxAmount +
      adsAmount +
      riskAmount +
      shippingCostUsed +
      productCost +
      packagingCost +
      otherFixedCosts +
      centralizeFixedCosts

    const netProfit = grossRevenue - totalCosts
    const netMarginPercent = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0
    const roiPercent = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0

    return {
      grossRevenue,
      marketplaceFeeAmount,
      taxAmount,
      adsAmount,
      riskAmount,
      shippingCostUsed,
      shippingCostSource,
      shippingModeLabel,
      shippingModeDetail,
      centralizeFixedCosts,
      totalCosts,
      netProfit,
      netMarginPercent,
      roiPercent,
    }
  }

  globalThis.BranchHunterCalculator = {
    calculateHybridResult,
    resolveShippingCost,
    resolveMarketplaceFeeAmount,
    toNullableNumber,
    toNumberOrZero,
  }
})()
