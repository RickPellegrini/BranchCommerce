import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"

type MlItemsSearchResponse = {
  results: string[]
  paging?: {
    total?: number
    offset?: number
    limit?: number
  }
}

type MlListingDetail = {
  id: string
  title: string
  price: number
  available_quantity: number
  sold_quantity: number
  status: string
  seller_custom_field?: string
  catalog_product_id?: string
  permalink?: string
  thumbnail?: string
  secure_thumbnail?: string
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50)
    const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0)

    const { connection } = await requireMlConnection()
    const payload = await fetchMlApi<MlItemsSearchResponse>(
      `/users/${connection.mlUserId}/items/search?limit=${limit}&offset=${offset}`,
      connection.accessToken,
    )

    let listings: MlListingDetail[] = []
    if (payload.results.length > 0) {
      const ids = payload.results.join(",")
      const rawDetails = await fetchMlApi<
        Array<{
          body?: MlListingDetail
        }>
      >(`/items?ids=${ids}`, connection.accessToken)

      listings = rawDetails
        .map((item) => item.body)
        .filter((item): item is MlListingDetail => Boolean(item))
        .map((item) => ({
          ...item,
          thumbnail: item.secure_thumbnail ?? item.thumbnail,
          sku: item.seller_custom_field ?? undefined,
          catalogProductId: item.catalog_product_id ?? null,
        }))
    }

    return jsonOk({
      total: payload.paging?.total ?? payload.results.length,
      limit: payload.paging?.limit ?? limit,
      offset: payload.paging?.offset ?? offset,
      listings,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonError("Conta do Mercado Livre nao conectada.", 404)
    }
    return jsonError(
      "Erro ao buscar anuncios do Mercado Livre.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
