import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"

type MlOrdersResponse = {
  results: Array<{
    id: number | string
    status?: string
    status_detail?: string
    date_created?: string
    date_closed?: string
    total_amount?: number
    currency_id?: string
    buyer?: {
      nickname?: string
      first_name?: string
      last_name?: string
    }
    shipping?: {
      id?: number
      status?: string
      shipping_mode?: string
      date_delivered?: string
      cost?: number
    }
    payments?: Array<{
      payment_method_id?: string
      status?: string
      total_paid_amount?: number
      taxes_amount?: number
    }>
    order_items?: Array<{
      item?: {
        id?: string
        title?: string
        seller_sku?: string
      }
      quantity?: number
      unit_price?: number
      sale_fee?: number
    }>
  }>
  paging?: {
    total?: number
    offset?: number
    limit?: number
  }
}

type MlItemsMultiResponse = Array<{
  body?: {
    id: string
    thumbnail?: string
    secure_thumbnail?: string
    catalog_listing?: boolean
  }
}>

type MlShipmentResponse = {
  id: number
  status?: string
  logistic_type?: string
  date_delivered?: string
  date_first_printed?: string
  date_created?: string
  receiver_address?: {
    city?: { name?: string }
    state?: { name?: string }
    street_name?: string
    street_number?: string
  }
}

type MlShipmentCostResponse = {
  senders?: Array<{
    cost?: number
  }>
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

    const uniqueItemIds = Array.from(
      new Set(
        payload.results
          .flatMap((order) => order.order_items?.map((orderItem) => orderItem.item?.id ?? "") ?? [])
          .filter(Boolean),
      ),
    )

    const itemDetailsMap = new Map<
      string,
      { thumbnail?: string; catalogListing?: boolean }
    >()
    if (uniqueItemIds.length > 0) {
      const itemDetails = await fetchMlApi<MlItemsMultiResponse>(
        `/items?ids=${uniqueItemIds.join(",")}`,
        connection.accessToken,
      )
      for (const item of itemDetails) {
        if (!item.body?.id) continue
        itemDetailsMap.set(item.body.id, {
          thumbnail: item.body.secure_thumbnail ?? item.body.thumbnail,
          catalogListing: item.body.catalog_listing,
        })
      }
    }

    const uniqueShipmentIds = Array.from(
      new Set(payload.results.map((order) => order.shipping?.id).filter((id): id is number => Boolean(id))),
    )

    const shipmentDetailsMap = new Map<number, MlShipmentResponse>()
    const shipmentCostsMap = new Map<number, number>()
    if (uniqueShipmentIds.length > 0) {
      const shipmentsAndCosts = await Promise.all(
        uniqueShipmentIds.map(async (shipmentId) => {
          try {
            const [shipment, shipmentCosts] = await Promise.all([
              fetchMlApi<MlShipmentResponse>(`/shipments/${shipmentId}`, connection.accessToken),
              fetchMlApi<MlShipmentCostResponse>(`/shipments/${shipmentId}/costs`, connection.accessToken),
            ])
            return {
              shipment,
              senderCost:
                shipmentCosts.senders?.reduce((total, sender) => total + (sender.cost ?? 0), 0) ?? 0,
            }
          } catch {
            return null
          }
        }),
      )
      for (const entry of shipmentsAndCosts) {
        if (!entry) continue
        shipmentDetailsMap.set(entry.shipment.id, entry.shipment)
        shipmentCostsMap.set(entry.shipment.id, entry.senderCost)
      }
    }

    const orders = payload.results.map((order) => {
      const buyerName =
        [order.buyer?.first_name, order.buyer?.last_name].filter(Boolean).join(" ") || "Sem comprador"
      const shipmentId = order.shipping?.id
      const shipmentDetails = shipmentId ? shipmentDetailsMap.get(shipmentId) : undefined
      const firstItemId = order.order_items?.[0]?.item?.id ?? ""
      const itemDetails = firstItemId ? itemDetailsMap.get(firstItemId) : undefined

      const receiverCity = shipmentDetails?.receiver_address?.city?.name ?? ""
      const receiverState = shipmentDetails?.receiver_address?.state?.name ?? ""
      const streetName = shipmentDetails?.receiver_address?.street_name ?? ""
      const streetNumber = shipmentDetails?.receiver_address?.street_number ?? ""
      const mlFeeAmount =
        order.order_items?.reduce((total, orderItem) => total + (orderItem.sale_fee ?? 0), 0) ?? 0
      const shippingCostAmount =
        (shipmentId ? shipmentCostsMap.get(shipmentId) : undefined) ?? order.shipping?.cost ?? 0
      const taxesAmount =
        order.payments?.reduce((total, payment) => total + (payment.taxes_amount ?? 0), 0) ?? 0
      const productAmount =
        order.order_items?.reduce(
          (total, orderItem) =>
            total + (orderItem.unit_price ?? 0) * (orderItem.quantity ?? 0),
          0,
        ) ?? order.total_amount ?? 0

      return {
        id: String(order.id),
        status: order.status ?? "unknown",
        statusDetail: order.status_detail ?? "",
        dateCreated: order.date_created ?? "",
        dateClosed: order.date_closed ?? "",
        totalAmount: order.total_amount ?? 0,
        currency: order.currency_id ?? "BRL",
        buyerNickname: order.buyer?.nickname ?? buyerName,
        shippingStatus: order.shipping?.status ?? "unknown",
        shippingMode: order.shipping?.shipping_mode ?? "unknown",
        shippingLogisticType: shipmentDetails?.logistic_type ?? "unknown",
        shippingId: shipmentId ? String(shipmentId) : "",
        dateDelivered:
          shipmentDetails?.date_delivered ?? order.shipping?.date_delivered ?? "",
        dateFirstPrinted: shipmentDetails?.date_first_printed ?? "",
        paymentMethod: order.payments?.[0]?.payment_method_id ?? "N/A",
        paymentStatus: order.payments?.[0]?.status ?? "unknown",
        totalPaidAmount: order.payments?.[0]?.total_paid_amount ?? order.total_amount ?? 0,
        productAmount,
        mlFeeAmount,
        shippingCostAmount,
        taxesAmount,
        itemThumbnail: itemDetails?.thumbnail ?? "",
        isCatalogListing: Boolean(itemDetails?.catalogListing),
        receiverAddressLine: [streetName, streetNumber].filter(Boolean).join(", "),
        receiverCityState: [receiverCity, receiverState].filter(Boolean).join(" - "),
        items:
          order.order_items?.map((orderItem) => ({
            id: orderItem.item?.id ?? "",
            title: orderItem.item?.title ?? "Item sem titulo",
            sku: orderItem.item?.seller_sku ?? "",
            quantity: orderItem.quantity ?? 0,
            unitPrice: orderItem.unit_price ?? 0,
          })) ?? [],
      }
    })

    return jsonOk({
      total: payload.paging?.total ?? payload.results.length,
      limit: payload.paging?.limit ?? limit,
      offset: payload.paging?.offset ?? offset,
      orders,
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
