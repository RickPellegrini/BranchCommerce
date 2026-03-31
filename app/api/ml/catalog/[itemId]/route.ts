import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"

type MlItemResponse = {
  id: string
  title: string
  site_id?: string
  catalog_product_id?: string
}

type MlSearchResponse = {
  results: Array<{
    id: string
    title: string
    price: number
    permalink?: string
    thumbnail?: string
    available_quantity?: number
    seller?: {
      id?: number
      nickname?: string
    }
  }>
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await context.params
    const { connection } = await requireMlConnection()

    const item = await fetchMlApi<MlItemResponse>(`/items/${itemId}`, connection.accessToken)
    const catalogProductId = item.catalog_product_id
    if (!catalogProductId) {
      return jsonOk({
        itemId,
        itemTitle: item.title,
        catalogProductId: null,
        sellers: [],
        listings: [],
        message: "Este anuncio nao esta vinculado a um produto de catalogo.",
      })
    }

    const siteId = item.site_id ?? "MLB"
    const search = await fetchMlApi<MlSearchResponse>(
      `/sites/${siteId}/search?catalog_product_id=${catalogProductId}&limit=50`,
      connection.accessToken,
    )

    const listings = search.results.map((result) => ({
      id: result.id,
      title: result.title,
      price: result.price,
      permalink: result.permalink,
      thumbnail: result.thumbnail,
      availableQuantity: result.available_quantity ?? 0,
      sellerId: result.seller?.id ? String(result.seller.id) : "unknown",
      sellerNickname: result.seller?.nickname ?? "Sem nome",
    }))

    const sellerMap = new Map<string, { sellerId: string; sellerNickname: string; listingsCount: number }>()
    for (const listing of listings) {
      const previous = sellerMap.get(listing.sellerId)
      if (!previous) {
        sellerMap.set(listing.sellerId, {
          sellerId: listing.sellerId,
          sellerNickname: listing.sellerNickname,
          listingsCount: 1,
        })
      } else {
        previous.listingsCount += 1
      }
    }

    return jsonOk({
      itemId,
      itemTitle: item.title,
      catalogProductId,
      sellers: Array.from(sellerMap.values()),
      listings,
      totalListings: listings.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao consultar catalogo e vendedores do anuncio.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
