import { randomUUID } from "crypto"

import { NextResponse } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { buildMlAuthorizationUrl } from "@/lib/mercadolivre/oauth"

const STATE_COOKIE = "ml_oauth_state"

export async function GET(request: Request) {
  try {
    await requireAuthenticatedAppUserId()

    const state = randomUUID()
    const authorizationUrl = buildMlAuthorizationUrl(state)
    const isHttps = new URL(request.url).protocol === "https:"

    const response = NextResponse.redirect(authorizationUrl)
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    })
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
