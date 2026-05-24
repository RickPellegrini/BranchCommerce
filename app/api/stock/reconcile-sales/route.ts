import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { normalizeMercadoLibreItemId } from "@/lib/mercadolivre/item-id"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { fetchMlOrdersSearchPages } from "@/lib/mercadolivre/orders-pagination"

type MlOrdersResponse = {
  results: Array<{
    id: number | string
    status?: string
    date_created?: string
    date_closed?: string
    payments?: Array<{
      status?: string
    }>
    order_items?: Array<{
      item?: {
        id?: string
        title?: string
        seller_sku?: string
      }
      quantity?: number
      unit_price?: number
    }>
  }>
  paging?: {
    total?: number
    offset?: number
    limit?: number
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAuthenticatedAppUserId()
    const { connection } = await requireMlConnection()
    const url = new URL(request.url)
    const startDate = url.searchParams.get("startDate") ?? undefined
    const endDate = url.searchParams.get("endDate") ?? undefined

    const payload = await fetchMlOrdersSearchPages({
      sellerId: connection.mlUserId,
      loadAll: true,
      limit: 50,
      offset: 0,
      startDate,
      endDate,
      fetchPage: (path) => fetchMlApi<MlOrdersResponse>(path, connection.accessToken),
    })

    const orders = payload.results.map((order) => ({
      orderId: String(order.id),
      status: order.status ?? "unknown",
      paymentStatus: order.payments?.[0]?.status,
      date: order.date_closed ?? order.date_created ?? "",
      items:
        order.order_items?.map((orderItem, index) => {
          const mlItemId = orderItem.item?.id ? normalizeMercadoLibreItemId(orderItem.item.id) : ""
          return {
            itemKey: `${mlItemId || "sem-item"}:${index}`,
            mlItemId,
            title: orderItem.item?.title ?? "Item sem titulo",
            sku: orderItem.item?.seller_sku ?? undefined,
            quantity: orderItem.quantity ?? 0,
            unitPrice: orderItem.unit_price ?? 0,
          }
        }) ?? [],
    }))

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")

    const client = new ConvexHttpClient(convexUrl)
    const result = await client.mutation(api.stock.reconcileSalesFromMercadoLivre, {
      userId,
      orders,
    })

    return Response.json({
      ok: true,
      data: {
        ...result,
        totalMlOrdersFetched: payload.results.length,
      },
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
