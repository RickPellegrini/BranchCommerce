import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { fetchMlApi } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import type { MlUser } from "@/lib/mercadolivre/types"

export async function GET() {
  try {
    const { appUserId, connection } = await requireMlConnection()
    const account = await fetchMlApi<MlUser>("/users/me", connection.accessToken)

    return jsonOk({
      appUserId,
      connected: true,
      mlUserId: connection.mlUserId,
      mlNickname: account.nickname ?? null,
      expiresAt: connection.expiresAt,
      updatedAt: connection.updatedAt,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    if (error instanceof Error && error.message.includes("nao conectada")) {
      return jsonOk({ connected: false })
    }

    return jsonError(
      "Erro ao consultar conta conectada do Mercado Livre.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
