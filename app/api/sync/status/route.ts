import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { jsonError, jsonOk } from "@/lib/mercadolivre/http"

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  return new ConvexHttpClient(convexUrl)
}

export async function GET() {
  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const client = getConvexClient()
    const statuses = await client.query(api.mercadopago.getSyncStatuses, { appUserId })
    return jsonOk(statuses)
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Erro ao consultar status de sincronizacao.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
