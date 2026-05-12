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
  seller_custom_field?: string
  secure_thumbnail?: string
  thumbnail?: string
  shipping?: { logistic_type?: string }
}

const KNOWN_COSTS: Array<{ mlItemId: string; unitCost: number }> = [
  { mlItemId: "MLB15792371", unitCost: 131.0 },
  { mlItemId: "MLB46063324", unitCost: 140.0 },
  { mlItemId: "MLB10661113", unitCost: 246.9 },
  { mlItemId: "MLB30426654", unitCost: 101.56 },
  { mlItemId: "MLB6507663864", unitCost: 220.47 },
  { mlItemId: "MLB6507360718", unitCost: 220.09 },
  { mlItemId: "MLB6507360716", unitCost: 128.52 },
  { mlItemId: "MLB4540738683", unitCost: 117.77 },
  { mlItemId: "MLB6507339982", unitCost: 92.02 },
]

export async function POST() {
  try {
    const userId = await requireAuthenticatedAppUserId()
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")

    const client = new ConvexHttpClient(convexUrl)

    const resetResult = await client.mutation(api.stock.resetStockToReality, {
      userId,
    })
    console.log("[reset] Limpeza concluída:", resetResult)

    let syncResult = null
    let enrichResult = null
    try {
      const { connection } = await requireMlConnection()
      const allIds = await fetchAllUserItemIds(connection.accessToken, connection.mlUserId)

      const rawDetails = await fetchItemDetailsBatched<MlItem>(allIds, connection.accessToken)
      const items = rawDetails.map((r) => r.body).filter((b): b is MlItem => Boolean(b))

      console.log(`[reset] ML sync: ${items.length} items encontrados`)

      const mappedItems = items.map((item) => ({
        mlItemId: normalizeMercadoLibreItemId(item.id),
        title: item.title,
        sku: item.seller_custom_field ?? undefined,
        imageUrl: item.secure_thumbnail ?? item.thumbnail ?? undefined,
        availableQuantity: item.available_quantity,
        price: item.price,
        logisticType: item.shipping?.logistic_type ?? undefined,
      }))

      syncResult = await client.mutation(api.stock.reconcileWithMlData, {
        userId,
        items: mappedItems,
      })
      console.log("[reset] ML reconcile:", syncResult)

      enrichResult = await client.mutation(api.stock.enrichPhotosFromMl, {
        userId,
        mlItems: mappedItems.map((i) => ({
          mlItemId: i.mlItemId,
          title: i.title,
          imageUrl: i.imageUrl,
          sku: i.sku,
        })),
      })
      console.log("[reset] Fotos enriquecidas:", enrichResult)

      const mergeResult = await client.mutation(api.stock.mergeProductDuplicates, {
        userId,
      })
      console.log("[reset] Duplicatas mergeadas:", mergeResult)
    } catch (mlError) {
      console.warn("[reset] ML sync falhou (itens físicos foram criados):", mlError)
    }

    const costsResult = await client.mutation(api.stock.bulkSetCosts, {
      userId,
      costs: KNOWN_COSTS,
    })
    console.log("[reset] Custos aplicados:", costsResult)

    return Response.json({
      ok: true,
      data: {
        reset: resetResult,
        mlSync: syncResult,
        photos: enrichResult,
        costs: costsResult,
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
