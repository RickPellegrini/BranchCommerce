import { randomUUID } from "crypto"

import { NextResponse } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { buildMlAuthorizationUrl, generatePkce } from "@/lib/mercadolivre/oauth"

const STATE_COOKIE = "ml_oauth_state"
const PKCE_COOKIE = "ml_oauth_pkce_verifier"

export async function GET(request: Request) {
  try {
    await requireAuthenticatedAppUserId()

    const state = randomUUID()
    const pkce = generatePkce()
    const authorizationUrl = buildMlAuthorizationUrl(state, pkce.challenge)
    const isHttps = new URL(request.url).protocol === "https:"

    const cookieOpts = {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 10,
    }

    const response = NextResponse.redirect(authorizationUrl)
    response.cookies.set(STATE_COOKIE, state, cookieOpts)
    response.cookies.set(PKCE_COOKIE, pkce.verifier, cookieOpts)
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes("nao autenticado")) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }

    if (
      error instanceof Error &&
      error.message.includes("Variavel de ambiente obrigatoria ausente")
    ) {
      return NextResponse.redirect(new URL("/dashboard?ml_error=configuracao_oauth", request.url))
    }

    return NextResponse.redirect(new URL("/dashboard?ml_error=falha_conexao", request.url))
  }
}
