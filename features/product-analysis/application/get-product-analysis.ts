import type { FullAnalysis } from "@/features/product-analysis/domain/types"
import { createAnalysisLogger } from "@/features/product-analysis/infra/logger"
import { getItem, getPriceToWin, getVisitsBatch } from "@/features/product-analysis/infra/ml-api"
import { dateRange } from "@/features/product-analysis/utils/dates"
import { buildCatalogSection } from "@/features/product-analysis/application/build-catalog-section"
import { discoverCompetitors } from "@/features/product-analysis/application/discover-competitors"
import { aggregateCompetitors } from "@/features/product-analysis/application/aggregate-competitors"

export async function getProductAnalysis(token: string, itemId: string): Promise<FullAnalysis> {
  const logger = createAnalysisLogger()
  logger.log("start", `Analysing item ${itemId}`)

  const t0 = Date.now()

  // Step 1: Load base item (own listing only)
  const item = await getItem(token, itemId)
  logger.log("item", `Loaded ${item.id}: "${item.title}"`)

  // Step 2: Catalog enrichment (parallel)
  const range7 = dateRange(7)
  const range30 = dateRange(30)

  const catalogT0 = Date.now()
  const [ptw, visits7, visits30] = await Promise.all([
    getPriceToWin(token, item.id),
    getVisitsBatch(token, [item.id], range7.from, range7.to).then((m) => m.get(item.id) ?? null),
    getVisitsBatch(token, [item.id], range30.from, range30.to).then((m) => m.get(item.id) ?? null),
  ])
  const catalogMs = Date.now() - catalogT0
  logger.log("catalog", `PriceToWin status=${ptw?.status ?? "N/A"}, visits7d=${visits7}, visits30d=${visits30}`, catalogMs)

  const catalog = buildCatalogSection(item, visits7, visits30, ptw)

  // Step 3: Discover competitors (direct mapping, no enrichment)
  const compT0 = Date.now()
  const { competitors, strategy, rawCount } = await discoverCompetitors(token, item, logger)
  logger.log("discover_done", `Strategy: ${strategy}, raw: ${rawCount}, final: ${competitors.length}`, competitors.length)

  // Step 4: Aggregate
  const summary = aggregateCompetitors(competitors, item.price)
  const competitorsMs = Date.now() - compT0
  logger.log("done", `Total competitors: ${competitors.length}, total time: ${Date.now() - t0}ms`)

  return {
    catalog,
    competitors: {
      strategy,
      totalCandidatesRaw: rawCount,
      totalAfterFilters: competitors.length,
      competitors,
      summary,
    },
    logs: logger.entries,
    fetchedAt: new Date().toISOString(),
    timings: {
      totalMs: Date.now() - t0,
      catalogMs,
      competitorsMs,
    },
  }
}
