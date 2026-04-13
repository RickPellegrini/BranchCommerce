import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { exchangeCodeForTokens } from "@/lib/mercadolivre/oauth"
import { parseTokenToConnection, upsertMlConnection } from "@/lib/mercadolivre/storage"

const STATE_COOKIE = "ml_oauth_state"
const PKCE_COOKIE = "ml_oauth_pkce_verifier"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  if (oauthError) {
    return NextResponse.redirect(new URL(`/dashboard?ml_error=${oauthError}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard?ml_error=callback_sem_code", request.url))
  }

  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const cookieStore = await cookies()
    const expectedState = cookieStore.get(STATE_COOKIE)?.value
    if (!expectedState || !state || state !== expectedState) {
      return NextResponse.redirect(new URL("/dashboard?ml_error=state_invalido", request.url))
    }

    const codeVerifier = cookieStore.get(PKCE_COOKIE)?.value
    const token = await exchangeCodeForTokens(code, codeVerifier)
    const connection = parseTokenToConnection({ appUserId, token })
    await upsertMlConnection(connection)

    const response = NextResponse.redirect(new URL("/dashboard?ml_connected=1", request.url))
    response.cookies.delete(STATE_COOKIE)
    response.cookies.delete(PKCE_COOKIE)
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }
    return NextResponse.redirect(new URL("/dashboard?ml_error=falha_callback", request.url))
  }
}
