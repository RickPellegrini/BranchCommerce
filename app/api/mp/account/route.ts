import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { getMercadoPagoConfig } from "@/lib/mercadopago/config"
import { getValidMpConnection } from "@/lib/mercadopago/storage"

export async function GET() {
  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const connection = await getValidMpConnection(appUserId)

    if (connection) {
      return jsonOk({
        connected: true as const,
        source: "mp_oauth" as const,
        mpUserId: connection.mpUserId,
        liveMode: connection.liveMode ?? null,
        expiresAt: connection.expiresAt,
        updatedAt: connection.updatedAt,
      })
    }

    if (getMercadoPagoConfig().appAccessToken) {
      return jsonOk({
        connected: true as const,
        source: "mp_app_token" as const,
        mpUserId: null,
        liveMode: null,
        expiresAt: null,
        updatedAt: null,
      })
    }

    return jsonOk({ connected: false as const })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Erro ao consultar conexao Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
