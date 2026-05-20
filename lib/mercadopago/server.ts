import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { getMercadoPagoConfig } from "@/lib/mercadopago/config"
import { getValidMpConnection } from "@/lib/mercadopago/storage"
import { requireMlConnection } from "@/lib/mercadolivre/server"

export type MpConnectionSource = "mp_oauth" | "mp_app_token" | "ml_token_fallback"

export type MpResolvedConnection = {
  appUserId: string
  accessToken: string
  /** Identificador MP. Para fallback ML, e o mlUserId (precisa ser resolvido). */
  accountUserId: string
  source: MpConnectionSource
}

/**
 * Resolve um token utilizavel para chamar a API do Mercado Pago. Ordem:
 * 1) Conexao OAuth dedicada do usuario (preferida).
 * 2) Token de aplicacao do .env (MERCADO_PAGO_APP_ACCESS_TOKEN) — funciona
 *    apenas para a conta do dono do aplicativo.
 * 3) Fallback no token do Mercado Livre, que ainda funciona para a maioria
 *    dos endpoints publicos de pagamentos.
 */
export async function requireMpConnection(): Promise<MpResolvedConnection> {
  const appUserId = await requireAuthenticatedAppUserId()

  const mpConnection = await getValidMpConnection(appUserId)
  if (mpConnection) {
    return {
      appUserId,
      accessToken: mpConnection.accessToken,
      accountUserId: mpConnection.mpUserId,
      source: "mp_oauth",
    }
  }

  const appToken = getMercadoPagoConfig().appAccessToken
  if (appToken) {
    return {
      appUserId,
      accessToken: appToken,
      accountUserId: "",
      source: "mp_app_token",
    }
  }

  const { connection } = await requireMlConnection()
  return {
    appUserId,
    accessToken: connection.accessToken,
    accountUserId: connection.mlUserId,
    source: "ml_token_fallback",
  }
}

export async function requireMpOAuthConnection(): Promise<MpResolvedConnection> {
  const appUserId = await requireAuthenticatedAppUserId()
  const mpConnection = await getValidMpConnection(appUserId)

  if (!mpConnection) {
    throw new Error("mercado_pago_oauth_required")
  }

  return {
    appUserId,
    accessToken: mpConnection.accessToken,
    accountUserId: mpConnection.mpUserId,
    source: "mp_oauth",
  }
}
