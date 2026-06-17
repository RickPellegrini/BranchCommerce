;(() => {
  /**
   * @typedef {"api"|"page"|"manual"|"derived"|null} DataSourceKind
   */

  /**
   * @typedef {"real"|"estimated"|"fallback"|"manual"|"ml_subsidy"|"default"} ShippingCostSource
   */

  /**
   * @typedef {Object} MarketplaceDynamicData
   * @property {number|null} salePrice
   * @property {string|null} listingType
   * @property {number|null} saleFeePercent
   * @property {number|null} saleFeeAmount
   * @property {number|null} reviewRating
   * @property {string|null} categoryId
   * @property {string|null} categoryName
   * @property {string|null} shippingMode
   * @property {number|null} shippingEstimatedCost
   * @property {number|null} shippingRealCost
   * @property {{
   *   salePrice: DataSourceKind,
   *   listingType: DataSourceKind,
   *   saleFeePercent: DataSourceKind,
   *   reviewRating: DataSourceKind,
   *   shippingEstimatedCost: DataSourceKind,
   *   shippingRealCost: DataSourceKind
   * }} source
   */

  /**
   * @typedef {Object} SellerOperationCosts
   * @property {number} productCost
   * @property {number} taxPercent Sempre 0 (impostos removidos da UI).
   * @property {boolean|undefined} centralizeEnabled Incluir custos fixos Centralize (5 + 1,50)
   * @property {number} adsPercent
   * @property {number} packagingCost
   * @property {number} otherFixedCosts
   * @property {number} riskPercent
   * @property {number} shippingFallback
   * @property {boolean|undefined} forceManualShipping
   * @property {boolean|undefined} freeShippingEnabled
   * @property {number|undefined} freeShippingMinPrice
   * @property {number|undefined} freeShippingSubsidyPercent
   * @property {number|undefined} defaultShippingCost
   * @property {boolean|undefined} centralizeEnabled
   * @property {boolean|undefined} fullEnabled
   * @property {number|undefined} fullShipmentUnits
   * @property {number|undefined} fullCollectionCost
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
   * @property {string} shippingModeLabel
   * @property {string} shippingModeDetail
   * @property {number} centralizeFixedCosts
   * @property {number} fullCosts
   * @property {number} fullUnitCost
   * @property {number} fullCollectionUnitCost
   * @property {number} totalCosts
   * @property {number} netProfit
   * @property {number} netMarginPercent
   * @property {number} roiPercent
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
      reviewRating: null,
      categoryId: null,
      categoryName: null,
      shippingMode: null,
      shippingEstimatedCost: null,
      shippingRealCost: null,
      source: {
        salePrice: null,
        listingType: null,
        saleFeePercent: null,
        reviewRating: null,
        shippingEstimatedCost: null,
        shippingRealCost: null,
      },
    }
  }

  /**
   * @returns {SellerOperationCosts}
   */
  function createDefaultOperationCosts() {
    return {
      productCost: 0,
      taxPercent: 0,
      centralizeEnabled: true,
      adsPercent: 0,
      packagingCost: 0,
      otherFixedCosts: 0,
      riskPercent: 0,
      shippingFallback: 0,
      forceManualShipping: false,
      freeShippingEnabled: true,
      freeShippingMinPrice: 79,
      freeShippingSubsidyPercent: 50,
      defaultShippingCost: 12,
      centralizeEnabled: true,
      fullEnabled: false,
      fullShipmentUnits: 100,
      fullCollectionCost: 100,
    }
  }

  globalThis.BranchHunterTypes = {
    createEmptyMarketplaceData,
    createDefaultOperationCosts,
  }
})()
