import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { jsonError } from "@/lib/mercadolivre/http"
import { exchangeCodeForTokens } from "@/lib/mercadolivre/oauth"
import { parseTokenToConnection, upsertMlConnection } from "@/lib/mercadolivre/storage"

const STATE_COOKIE = "ml_oauth_state"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  if (oauthError) {
    return NextResponse.redirect(new URL(`/dashboard?ml_error=${oauthError}`, request.url))
  }

  if (!code) {
    return jsonError("Parametro code ausente no callback do Mercado Livre.", 400)
  }

  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const cookieStore = await cookies()
    const expectedState = cookieStore.get(STATE_COOKIE)?.value
    if (!expectedState || !state || state !== expectedState) {
      return jsonError("State OAuth invalido.", 400)
    }

    const token = await exchangeCodeForTokens(code)
    const connection = parseTokenToConnection({ appUserId, token })
    await upsertMlConnection(connection)

    const response = NextResponse.redirect(new URL("/dashboard?ml_connected=1", request.url))
    response.cookies.delete(STATE_COOKIE)
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return jsonError("Usuario nao autenticado.", 401)
    }
    return jsonError(
      "Falha ao concluir autenticacao com Mercado Livre.",
      500,
      error instanceof Error ? error.message : "Erro desconhecido",
    )
  }
}
