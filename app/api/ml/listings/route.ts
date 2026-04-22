import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { normalizeMercadoLibreItemId } from "@/lib/mercadolivre/item-id"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { searchUserItemsIncludingPaused } from "@/lib/mercadolivre/user-items-search"

type MlListingDetail = {
  id: string
  title: string
  price: number
  available_quantity: number
  sold_quantity: number
  status: string
  seller_custom_field?: string
  catalog_product_id?: string
  /** true = publicacao na vitrine de catalogo (buy box); false = anuncio classico sincronizado */
  catalog_listing?: boolean
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
    const payload = await searchUserItemsIncludingPaused(
      connection.accessToken,
      connection.mlUserId,
      limit,
      offset,
    )

    let listings: MlListingDetail[] = []
    if (payload.results.length > 0) {
      const ids = payload.results.join(",")
      const rawDetails = await fetchMlApi<
        Array<{
          body?: MlListingDetail
        }>
      >(`/items?ids=${ids}`, connection.accessToken)

      const mapped = rawDetails
        .map((item) => item.body)
        .filter((item): item is MlListingDetail => Boolean(item))
        .map((item) => ({
          ...item,
          id: normalizeMercadoLibreItemId(item.id),
          thumbnail: item.secure_thumbnail ?? item.thumbnail,
          sku: item.seller_custom_field ?? undefined,
          catalogProductId: item.catalog_product_id ?? null,
          catalogListing: item.catalog_listing === undefined ? null : Boolean(item.catalog_listing),
        }))
      const byId = new Map<string, (typeof mapped)[0]>()
      for (const row of mapped) {
        if (!byId.has(row.id)) byId.set(row.id, row)
      }
      listings = [...byId.values()]
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
