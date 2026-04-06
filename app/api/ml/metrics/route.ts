import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { searchUserItemsIncludingPaused } from "@/lib/mercadolivre/user-items-search"

type MlOrdersResponse = {
  results: Array<{
    total_amount?: number
    status?: string
    date_created?: string
  }>
  paging?: { total?: number }
}

export async function GET() {
  try {
    const { connection } = await requireMlConnection()

    const [listingsPayload, ordersPayload] = await Promise.all([
      searchUserItemsIncludingPaused(connection.accessToken, connection.mlUserId, 1, 0),
      fetchMlApi<MlOrdersResponse>(
        `/orders/search?seller=${connection.mlUserId}&sort=date_desc&limit=50&offset=0`,
        connection.accessToken,
      ),
    ])

    const grossAmount = ordersPayload.results.reduce(
      (total, order) => total + (order.total_amount ?? 0),
      0,
    )
    const completedOrders = ordersPayload.results.filter(
      (order) => order.status === "paid" || order.status === "confirmed",
    ).length
    const cancelledOrders = ordersPayload.results.filter(
      (order) => order.status === "cancelled",
    ).length
    const averageTicket =
      ordersPayload.results.length > 0 ? grossAmount / ordersPayload.results.length : 0
    const lastOrderDate = ordersPayload.results[0]?.date_created ?? null

    return jsonOk({
      listingsTotal: listingsPayload.paging?.total ?? 0,
      ordersTotal: ordersPayload.paging?.total ?? 0,
      grossAmountSample: grossAmount,
      sampleSize: ordersPayload.results.length,
      completedOrdersSample: completedOrders,
      cancelledOrdersSample: cancelledOrders,
      averageTicketSample: averageTicket,
      lastOrderDate,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao buscar metricas do Mercado Livre.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
