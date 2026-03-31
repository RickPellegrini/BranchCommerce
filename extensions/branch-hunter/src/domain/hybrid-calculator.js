(() => {
  function toNumberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function toPercentValue(value) {
    return toNumberOrZero(value) / 100;
  }

  function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function resolveShippingCost(marketplace, operation) {
    const shippingRealCost = toNullableNumber(marketplace.shippingRealCost);
    if (shippingRealCost !== null && shippingRealCost >= 0) {
      return { shippingCostUsed: shippingRealCost, shippingCostSource: "real" };
    }

    const shippingEstimatedCost = toNullableNumber(marketplace.shippingEstimatedCost);
    if (shippingEstimatedCost !== null && shippingEstimatedCost >= 0) {
      return { shippingCostUsed: shippingEstimatedCost, shippingCostSource: "estimated" };
    }

    return {
      shippingCostUsed: Math.max(0, toNumberOrZero(operation.shippingFallback)),
      shippingCostSource: "fallback",
    };
  }

  function resolveMarketplaceFeeAmount(grossRevenue, marketplace) {
    const saleFeeAmount = toNullableNumber(marketplace.saleFeeAmount);
    if (saleFeeAmount !== null && saleFeeAmount >= 0) return saleFeeAmount;

    const feePercent = Math.max(0, toNumberOrZero(marketplace.saleFeePercent));
    return grossRevenue * (feePercent / 100);
  }

  /**
   * Calculation core:
   * - separates marketplace dynamic data from seller operation costs
   * - applies explicit shipping priority: real -> estimated -> fallback
   */
  function calculateHybridResult(input) {
    const marketplace = input?.marketplace || {};
    const operation = input?.operation || {};

    const grossRevenue = Math.max(0, toNumberOrZero(marketplace.salePrice));
    const marketplaceFeeAmount = resolveMarketplaceFeeAmount(grossRevenue, marketplace);
    const taxAmount = grossRevenue * toPercentValue(operation.taxPercent);
    const adsAmount = grossRevenue * toPercentValue(operation.adsPercent);
    const riskAmount = grossRevenue * toPercentValue(operation.riskPercent);

    const { shippingCostUsed, shippingCostSource } = resolveShippingCost(marketplace, operation);

    const productCost = Math.max(0, toNumberOrZero(operation.productCost));
    const packagingCost = Math.max(0, toNumberOrZero(operation.packagingCost));
    const otherFixedCosts = Math.max(0, toNumberOrZero(operation.otherFixedCosts));

    const totalCosts =
      marketplaceFeeAmount +
      taxAmount +
      adsAmount +
      riskAmount +
      shippingCostUsed +
      productCost +
      packagingCost +
      otherFixedCosts;

    const netProfit = grossRevenue - totalCosts;
    const netMarginPercent = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    return {
      grossRevenue,
      marketplaceFeeAmount,
      taxAmount,
      adsAmount,
      riskAmount,
      shippingCostUsed,
      shippingCostSource,
      totalCosts,
      netProfit,
      netMarginPercent,
    };
  }

  globalThis.BranchHunterCalculator = {
    calculateHybridResult,
    resolveShippingCost,
    resolveMarketplaceFeeAmount,
    toNullableNumber,
    toNumberOrZero,
  };
})();
