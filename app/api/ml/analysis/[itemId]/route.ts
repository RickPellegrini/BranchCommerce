export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

import { requireMlConnection } from "@/lib/mercadolivre/server"
import { jsonOk, jsonError } from "@/lib/mercadolivre/http"
import { getProductAnalysis } from "@/features/product-analysis/application/get-product-analysis"
import { MlUpstreamError } from "@/features/product-analysis/infra/ml-api"

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  if (!itemId) return jsonError("Missing itemId", 400)

  console.log(`\n${"=".repeat(60)}`)
  console.log(`[analysis route] START itemId=${itemId}`)
  console.log(`${"=".repeat(60)}`)

  let token: string
  try {
    const { connection } = await requireMlConnection()
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

      return jsonError(
        `Erro Mercado Livre (${err.mlStatus})`,
        err.mlStatus,
        {
          source: "mercadolivre_api",
          authMode: err.authMode,
          mlStatus: err.mlStatus,
          endpoint: err.endpoint,
          mlResponse: err.toJSON().body,
        },
      )
    }

    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[analysis route] ✗ App error: ${msg}`)
    console.log(`${"=".repeat(60)}\n`)
    return jsonError(msg, 500, { source: "application" })
  }
}
