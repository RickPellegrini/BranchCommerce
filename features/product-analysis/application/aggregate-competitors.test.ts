import { describe, expect, it } from "vitest"

import type { CompetitorEntry } from "@/features/product-analysis/domain/types"

import { aggregateCompetitors } from "./aggregate-competitors"

function comp(overrides: Partial<CompetitorEntry> & { price: number }): CompetitorEntry {
  return {
    itemId: "MLBxxx",
    sellerId: 1,
    originalPrice: null,
    condition: "new",
    listingType: "gold_special",
    officialStore: false,
    freeShipping: false,
    shippingMode: null,
    logisticType: null,
    tier: null,
    warranty: null,
    location: null,
    tags: [],
    title: null,
    sellerNickname: null,
    sellerPowerStatus: null,
    sellerRepLevel: null,
    sellerTotalTransactions: null,
    sellerPermalink: null,
    thumbnail: null,
    permalink: null,
    visits30d: null,
    visitsShare: null,
    scrapedStock: null,
    scrapedStockIsMinimum: false,
    scrapedStartTime: null,
    stockSource: null,
    ...overrides,
  }
}

describe("aggregateCompetitors", () => {
  it("returns zeroed summary for empty list", () => {
    const result = aggregateCompetitors([], 100)
    expect(result.count).toBe(0)
    expect(result.minPrice).toBe(0)
    expect(result.maxPrice).toBe(0)
    expect(result.avgPrice).toBe(0)
    expect(result.medianPrice).toBe(0)
    expect(result.top5).toEqual([])
  })

  it("calculates min, max, avg for odd number of competitors", () => {
    const competitors = [comp({ price: 50 }), comp({ price: 100 }), comp({ price: 150 })]
    const result = aggregateCompetitors(competitors, 100)
    expect(result.minPrice).toBe(50)
    expect(result.maxPrice).toBe(150)
    expect(result.avgPrice).toBe(100)
    expect(result.medianPrice).toBe(100)
  })

  it("calculates median for even number of competitors", () => {
    const competitors = [
      comp({ price: 50 }),
      comp({ price: 100 }),
      comp({ price: 150 }),
      comp({ price: 200 }),
    ]
    const result = aggregateCompetitors(competitors, 100)
    expect(result.medianPrice).toBe(125)
  })

  it("computes myPricePosition and myPricePercentile", () => {
    const competitors = [comp({ price: 50 }), comp({ price: 100 }), comp({ price: 150 })]
    const result = aggregateCompetitors(competitors, 120)
    expect(result.myPricePosition).toBe(3)
    expect(result.myPricePercentile).toBe(67)
  })

  it("counts officialStore, freeShipping, fulfillment", () => {
    const competitors = [
      comp({ price: 50, officialStore: true, freeShipping: true, logisticType: "fulfillment" }),
      comp({ price: 60, officialStore: false, freeShipping: true, logisticType: "xd_drop_off" }),
      comp({ price: 70, officialStore: true, freeShipping: false, logisticType: "fulfillment" }),
    ]
    const result = aggregateCompetitors(competitors, 100)
    expect(result.officialStoreCount).toBe(2)
    expect(result.freeShippingCount).toBe(2)
    expect(result.fulfillmentCount).toBe(2)
  })

  it("top5 sorted by price ascending, limited to 5", () => {
    const competitors = Array.from({ length: 8 }, (_, i) =>
      comp({ itemId: `MLB${i}`, price: (i + 1) * 10 }),
    )
    const result = aggregateCompetitors(competitors, 100)
    expect(result.top5).toHaveLength(5)
    expect(result.top5[0].price).toBe(10)
    expect(result.top5[4].price).toBe(50)
  })

  it("single competitor edge case", () => {
    const result = aggregateCompetitors([comp({ price: 200 })], 150)
    expect(result.count).toBe(1)
    expect(result.minPrice).toBe(200)
    expect(result.maxPrice).toBe(200)
    expect(result.medianPrice).toBe(200)
    expect(result.myPricePosition).toBe(1)
    expect(result.myPricePercentile).toBe(0)
  })
})
