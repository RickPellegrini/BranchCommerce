import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import { normalizeMercadoLibreItemId } from "@/lib/mercadolivre/item-id"
import { fetchAllUserItemIds, fetchItemDetailsBatched } from "@/lib/mercadolivre/batch-fetch"

type MlItem = {
  id: string
  title: string
  price: number
  available_quantity: number
  status?: string
  seller_id?: number
  seller_custom_field?: string
  catalog_product_id?: string
  catalog_listing?: boolean
  secure_thumbnail?: string
  thumbnail?: string
  shipping?: { logistic_type?: string }
}

/** Anuncio classico espelhado de um catalogo — nao vira produto novo no estoque. */
function isClassicCatalogMirror(item: MlItem) {
  return Boolean(item.catalog_product_id) && item.catalog_listing === false
}

export async function POST() {
  try {
    const userId = await requireAuthenticatedAppUserId()
    const { connection } = await requireMlConnection()

    const allIds = await fetchAllUserItemIds(connection.accessToken, connection.mlUserId)

    const rawDetails = await fetchItemDetailsBatched<MlItem>(allIds, connection.accessToken)
    const sellerId = Number(connection.mlUserId)
    const items = rawDetails
      .map((r) => r.body)
      .filter((b): b is MlItem => Boolean(b))
      .filter(
        (item) =>
          !Number.isFinite(sellerId) || item.seller_id == null || item.seller_id === sellerId,
      )

    console.log(
      `[sync-ml] mlUserId=${connection.mlUserId} items=${items.length} ids=${allIds.length}`,
    )

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
    const client = new ConvexHttpClient(convexUrl)

    const mappedItems = items.map((item) => ({
      mlItemId: normalizeMercadoLibreItemId(item.id),
      title: item.title,
      sku: item.seller_custom_field ?? undefined,
      imageUrl: item.secure_thumbnail ?? item.thumbnail ?? undefined,
      availableQuantity: item.available_quantity,
      price: item.price,
      logisticType: item.shipping?.logistic_type ?? undefined,
      status: item.status ?? "active",
      skipAutoCreate: isClassicCatalogMirror(item),
    }))

    const reconcileResult = await client.mutation(api.stock.reconcileWithMlData, {
      userId,
      items: mappedItems,
    })

    const enrichResult = await client.mutation(api.stock.enrichPhotosFromMl, {
      userId,
      mlItems: mappedItems.map((i) => ({
        mlItemId: i.mlItemId,
        title: i.title,
        imageUrl: i.imageUrl,
        sku: i.sku,
      })),
    })

    const mergeResult = await client.mutation(api.stock.mergeProductDuplicates, {
      userId,
    })

    return Response.json({
      ok: true,
      data: {
        mlUserId: connection.mlUserId,
        totalMlItems: items.length,
        totalMlIdsSearched: allIds.length,
        ...reconcileResult,
        photosEnriched: enrichResult.enriched,
        mlIdsLinked: enrichResult.linked,
        mlAliasesAdded: enrichResult.aliasesAdded,
        duplicatesMerged: mergeResult.merged,
        duplicatesRemoved: mergeResult.removed,
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
