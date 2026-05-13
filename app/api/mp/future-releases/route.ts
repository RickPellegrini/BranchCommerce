import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { getFutureReleases } from "@/lib/mercadopago/future-releases"
import { requireMpConnection } from "@/lib/mercadopago/server"

export async function GET() {
  try {
    const mp = await requireMpConnection()
    const releases = await getFutureReleases(mp.accessToken)
    return jsonOk(releases)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error("[mp/future-releases] falha:", detail)
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError("Erro ao consultar lancamentos futuros.", 500, detail)
  }
}
