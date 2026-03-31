import { jsonError, jsonOk } from "@/lib/mercadolivre/http"
import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { fetchMlApi, getMlConnectionByAppUser } from "@/lib/mercadolivre/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"
import type { MlUser } from "@/lib/mercadolivre/types"

export async function GET() {
  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const connection = await getMlConnectionByAppUser(appUserId)

    if (!connection) {
      return jsonOk({ connected: false })
    }

    const hasMlConfig =
      Boolean(process.env.MERCADO_LIVRE_CLIENT_ID) &&
      Boolean(process.env.MERCADO_LIVRE_CLIENT_SECRET) &&
      Boolean(process.env.MERCADO_LIVRE_REDIRECT_URI)

    if (!hasMlConfig) {
      return jsonOk({
        connected: true,
        mlUserId: connection.mlUserId,
        mlNickname: null,
        expiresAt: connection.expiresAt,
        updatedAt: connection.updatedAt,
        warning:
          "Configuracao OAuth do Mercado Livre incompleta no ambiente. Preencha CLIENT_ID, CLIENT_SECRET e REDIRECT_URI.",
      })
    }

    const { connection: validConnection } = await requireMlConnection()
    const account = await fetchMlApi<MlUser>("/users/me", validConnection.accessToken)

    return jsonOk({
      appUserId,
      connected: true,
      mlUserId: validConnection.mlUserId,
      mlNickname: account.nickname ?? null,
      expiresAt: validConnection.expiresAt,
      updatedAt: validConnection.updatedAt,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }

    return jsonError(
      "Erro ao consultar conta conectada do Mercado Livre.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
