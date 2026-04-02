export const dynamic = "force-dynamic"
export const revalidate = 0

import { requireMlConnection } from "@/lib/mercadolivre/server"
import { jsonOk, jsonError } from "@/lib/mercadolivre/http"
import { getProductAnalysis } from "@/features/product-analysis/application/get-product-analysis"

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params
    if (!itemId) return jsonError("Missing itemId", 400)

    const { connection } = await requireMlConnection()
    const analysis = await getProductAnalysis(connection.accessToken, itemId)

    return jsonOk(analysis)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[analysis route]", msg)
    return jsonError(msg, 500)
  }
}
