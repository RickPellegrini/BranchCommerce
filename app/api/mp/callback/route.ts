import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { exchangeMpCodeForTokens } from "@/lib/mercadopago/oauth"
import { parseTokenToMpConnection, upsertMpConnection } from "@/lib/mercadopago/storage"

const STATE_COOKIE = "mp_oauth_state"
const PKCE_COOKIE = "mp_oauth_pkce_verifier"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  if (oauthError) {
    return NextResponse.redirect(new URL(`/dashboard?mp_error=${oauthError}`, request.url))
  }
  if (!code) {
    return NextResponse.redirect(new URL("/dashboard?mp_error=callback_sem_code", request.url))
  }

  try {
    const appUserId = await requireAuthenticatedAppUserId()
    const cookieStore = await cookies()
    const expectedState = cookieStore.get(STATE_COOKIE)?.value
    if (!expectedState || !state || state !== expectedState) {
      return NextResponse.redirect(new URL("/dashboard?mp_error=state_invalido", request.url))
    }

    const codeVerifier = cookieStore.get(PKCE_COOKIE)?.value
    const token = await exchangeMpCodeForTokens(code, codeVerifier)
    const connection = parseTokenToMpConnection({ appUserId, token })
    await upsertMpConnection(connection)

    const response = NextResponse.redirect(new URL("/dashboard?mp_connected=1", request.url))
    response.cookies.delete(STATE_COOKIE)
    response.cookies.delete(PKCE_COOKIE)
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }
    console.error("[mp/callback] falha:", error)
    return NextResponse.redirect(new URL("/dashboard?mp_error=falha_callback", request.url))
  }
}
