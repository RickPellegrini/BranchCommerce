import type { CompetitorEntry, CompetitorSummary } from "@/features/product-analysis/domain/types"

export function aggregateCompetitors(
  competitors: CompetitorEntry[],
  myPrice: number,
): CompetitorSummary {
  if (competitors.length === 0) {
    return {
      count: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      medianPrice: 0,
      myPricePosition: 0,
      myPricePercentile: 0,
      officialStoreCount: 0,
      freeShippingCount: 0,
      fulfillmentCount: 0,
      top5: [],
    }
  }

  const prices = competitors.map((c) => c.price).sort((a, b) => a - b)
  const min = prices[0]
  const max = prices[prices.length - 1]
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
  const mid = Math.floor(prices.length / 2)
  const median = prices.length % 2 === 0 ? Math.round((prices[mid - 1] + prices[mid]) / 2) : prices[mid]

  const below = prices.filter((p) => p < myPrice).length
  const position = below + 1
  const percentile = Math.round((below / prices.length) * 100)

  return {
    count: competitors.length,
    minPrice: min,
    maxPrice: max,
    avgPrice: avg,
    medianPrice: median,
    myPricePosition: position,
    myPricePercentile: percentile,
    officialStoreCount: competitors.filter((c) => c.officialStore).length,
    freeShippingCount: competitors.filter((c) => c.freeShipping).length,
    fulfillmentCount: competitors.filter((c) => c.logisticType === "fulfillment").length,
    top5: [...competitors].sort((a, b) => a.price - b.price).slice(0, 5),
  }
}
