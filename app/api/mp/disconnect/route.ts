import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { disconnectMpConnection } from "@/lib/mercadopago/storage"

export async function POST() {
  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const result = await disconnectMpConnection(appUserId)
    return jsonOk({
      disconnected: Boolean((result as { removed?: boolean } | null)?.removed ?? true),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Nao foi possivel desconectar a conta do Mercado Pago.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
