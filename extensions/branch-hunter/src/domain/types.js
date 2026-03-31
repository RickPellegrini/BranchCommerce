(() => {
  /**
   * @typedef {"api"|"page"|"manual"|"derived"|null} DataSourceKind
   */

  /**
   * @typedef {"real"|"estimated"|"fallback"} ShippingCostSource
   */

  /**
   * @typedef {Object} MarketplaceDynamicData
   * @property {number|null} salePrice
   * @property {string|null} listingType
   * @property {number|null} saleFeePercent
   * @property {number|null} saleFeeAmount
   * @property {string|null} categoryId
   * @property {string|null} categoryName
   * @property {string|null} shippingMode
   * @property {number|null} shippingEstimatedCost
   * @property {number|null} shippingRealCost
   * @property {{
   *   salePrice: DataSourceKind,
   *   listingType: DataSourceKind,
   *   saleFeePercent: DataSourceKind,
   *   shippingEstimatedCost: DataSourceKind,
   *   shippingRealCost: DataSourceKind
   * }} source
   */

  /**
   * @typedef {Object} SellerOperationCosts
   * @property {number} productCost
   * @property {number} taxPercent
   * @property {number} adsPercent
   * @property {number} packagingCost
   * @property {number} otherFixedCosts
   * @property {number} riskPercent
   * @property {number} shippingFallback
   */

  /**
   * @typedef {Object} CalculationInput
   * @property {MarketplaceDynamicData} marketplace
   * @property {SellerOperationCosts} operation
   */

  /**
   * @typedef {Object} CalculationResult
   * @property {number} grossRevenue
   * @property {number} marketplaceFeeAmount
   * @property {number} taxAmount
   * @property {number} adsAmount
   * @property {number} riskAmount
   * @property {number} shippingCostUsed
   * @property {ShippingCostSource} shippingCostSource
   * @property {number} totalCosts
   * @property {number} netProfit
   * @property {number} netMarginPercent
   */

  /**
   * @returns {MarketplaceDynamicData}
   */
  function createEmptyMarketplaceData() {
    return {
      salePrice: null,
      listingType: null,
      saleFeePercent: null,
      saleFeeAmount: null,
      categoryId: null,
      categoryName: null,
      shippingMode: null,
      shippingEstimatedCost: null,
      shippingRealCost: null,
      source: {
        salePrice: null,
        listingType: null,
        saleFeePercent: null,
        shippingEstimatedCost: null,
        shippingRealCost: null,
      },
    };
  }

  /**
   * @returns {SellerOperationCosts}
   */
  function createDefaultOperationCosts() {
    return {
      productCost: 0,
      taxPercent: 0,
      adsPercent: 0,
      packagingCost: 0,
      otherFixedCosts: 0,
      riskPercent: 0,
      shippingFallback: 0,
    };
  }

  globalThis.BranchHunterTypes = {
    createEmptyMarketplaceData,
    createDefaultOperationCosts,
  };
})();
