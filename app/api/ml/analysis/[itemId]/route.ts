export const dynamic = "force-dynamic"
export const revalidate = 0

import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { jsonOk, jsonError } from "@/lib/mercadolivre/http"
import { getProductAnalysis } from "@/features/product-analysis/application/get-product-analysis"
import { MlUpstreamError } from "@/features/product-analysis/infra/ml-api"
import type { FullAnalysis } from "@/features/product-analysis/domain/types"

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  return new ConvexHttpClient(convexUrl)
}

async function saveAnalysisSnapshot(appUserId: string, analysis: FullAnalysis) {
  const client = getConvexClient()
  const stockFoundCount = analysis.competitors.competitors.filter(
    (competitor) => competitor.scrapedStock != null,
  ).length
  const stockTotalCount = analysis.competitors.competitors.length
  const summary = analysis.competitors.summary
  const dataSourcesJson = JSON.stringify(
    analysis.dataSources.map((source) => ({
      key: source.key,
      status: source.status,
      used: source.used,
      count: source.count,
      error: source.error,
    })),
  )

  await client.mutation(api.productAnalysis.addSnapshot, {
    userId: appUserId,
    receivedId: analysis.receivedId,
    itemId: analysis.catalog.item.id,
    title: analysis.catalog.item.title,
    catalogProductId: analysis.catalog.catalogProductId ?? undefined,
    resolvedInputType: analysis.resolvedInputType,
    primaryItemSource: analysis.primaryItemSource,
    analysisStatus: analysis.analysisStatus,
    price: analysis.catalog.item.price,
    minPrice: summary.count > 0 ? summary.minPrice : undefined,
    avgPrice: summary.count > 0 ? summary.avgPrice : undefined,
    buyBoxWinnerItemId: analysis.competitors.buyBoxWinnerItemId ?? undefined,
    buyBoxConfirmed: analysis.competitors.buyBoxWinnerItemId != null,
    competitorCount: analysis.competitors.competitors.length,
    stockFoundCount,
    stockTotalCount,
    totalMs: analysis.timings.totalMs,
    dataSourcesJson,
  })
}

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  if (!itemId) return jsonError("Missing itemId", 400)

  console.log(`\n${"=".repeat(60)}`)
  console.log(`[analysis route] START itemId=${itemId}`)
  console.log(`${"=".repeat(60)}`)

  let token: string
  let appUserId: string
  try {
    const { appUserId: userId, connection } = await requireMlConnection()
    appUserId = userId
    token = connection.accessToken
    const prefix = token.length > 12 ? `${token.slice(0, 6)}…${token.slice(-4)}` : "***"
    console.log(`[analysis route] Token loaded: ${prefix} (len=${token.length})`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[analysis route] ✗ Auth failed: ${msg}`)
    return jsonError(`Erro de autenticacao: ${msg}`, 401)
  }

  try {
    const analysis = await getProductAnalysis(token, itemId)
    try {
      await saveAnalysisSnapshot(appUserId, analysis)
    } catch (snapshotErr) {
      console.warn(
        "[analysis route] snapshot skipped:",
        snapshotErr instanceof Error ? snapshotErr.message : String(snapshotErr),
      )
    }
    console.log(`[analysis route] ✓ Done in ${analysis.timings.totalMs}ms`)
    console.log(`${"=".repeat(60)}\n`)
    return jsonOk(analysis)
  } catch (err: unknown) {
    if (err instanceof MlUpstreamError) {
      console.error(`[analysis route] ✗ ML ${err.authMode} error:`)
      console.error(`  endpoint: ${err.endpoint}`)
      console.error(`  status:   ${err.mlStatus}`)
      console.error(`  body:     ${err.bodyText.slice(0, 500)}`)
      console.log(`${"=".repeat(60)}\n`)

      return jsonError(`Erro Mercado Livre (${err.mlStatus})`, err.mlStatus, {
        source: "mercadolivre_api",
        authMode: err.authMode,
        mlStatus: err.mlStatus,
        endpoint: err.endpoint,
        mlResponse: err.toJSON().body,
      })
    }

    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[analysis route] ✗ App error: ${msg}`)
    console.log(`${"=".repeat(60)}\n`)
    return jsonError(msg, 500, { source: "application" })
  }
}
