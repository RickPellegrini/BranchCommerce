import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"

type MlOrdersResponse = {
  results: Array<Record<string, unknown>>
  paging?: {
    total?: number
    offset?: number
    limit?: number
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") ?? "20")
    const offset = Number(url.searchParams.get("offset") ?? "0")

    const { connection } = await requireMlConnection()
    const payload = await fetchMlApi<MlOrdersResponse>(
      `/orders/search?seller=${connection.mlUserId}&sort=date_desc&limit=${limit}&offset=${offset}`,
      connection.accessToken,
    )

    return jsonOk({
      total: payload.paging?.total ?? payload.results.length,
      limit: payload.paging?.limit ?? limit,
      offset: payload.paging?.offset ?? offset,
      orders: payload.results,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao buscar pedidos do Mercado Livre.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
