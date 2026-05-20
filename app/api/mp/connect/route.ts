import { randomUUID } from "crypto"

import { NextResponse } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { getMercadoPagoConfig } from "@/lib/mercadopago/config"
import { buildMpAuthorizationUrl, generateMpPkce } from "@/lib/mercadopago/oauth"

const STATE_COOKIE = "mp_oauth_state"
const PKCE_COOKIE = "mp_oauth_pkce_verifier"

/** Logs sem expor segredos. Mostra prefixo + tamanho dos valores criticos. */
function maskedEnvSnapshot() {
  const config = getMercadoPagoConfig()
  const mask = (value: string) =>
    value ? `${value.slice(0, 4)}…(${value.length} chars)` : "(empty)"
  return {
    authUrl: config.authUrl,
    clientId: config.clientId,
    clientIdLooksValid: /^\d+$/.test(config.clientId),
    clientSecretPreview: mask(config.clientSecret),
    redirectUri: config.redirectUri,
    notificationUrl: config.notificationUrl || "(nao definido)",
    hasAppAccessToken: Boolean(config.appAccessToken),
    appAccessTokenPreview: mask(config.appAccessToken),
    hasPublicKey: Boolean(config.publicKey),
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const debug = url.searchParams.get("debug") === "1"

  try {
    await requireAuthenticatedAppUserId()

    const envSnapshot = maskedEnvSnapshot()
    const state = randomUUID()
    const pkce = generateMpPkce()
    const authorizationUrl = buildMpAuthorizationUrl(state, pkce.challenge)
    const isHttps = url.protocol === "https:"

    console.log("[mp/connect] env snapshot:", envSnapshot)
    console.log("[mp/connect] authorizationUrl:", authorizationUrl)
    console.log("[mp/connect] expected callback:", envSnapshot.redirectUri)
    console.log("[mp/connect] request host:", url.host, "protocol:", url.protocol)

    if (debug) {
      return NextResponse.json({
        ok: true,
        env: envSnapshot,
        authorizationUrl,
        state,
        pkceChallenge: pkce.challenge,
        request: { host: url.host, protocol: url.protocol },
      })
    }

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
    const message = error instanceof Error ? error.message : String(error)
    console.error("[mp/connect] falha ao montar OAuth:", message)

    if (debug) {
      return NextResponse.json(
        { ok: false, error: message, env: maskedEnvSnapshot() },
        { status: 500 },
      )
    }
    if (message.includes("nao autenticado")) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }
    if (
      message.includes("Variavel de ambiente obrigatoria ausente") ||
      message.includes("MERCADO_PAGO_CLIENT_ID invalido") ||
      message.includes("MERCADO_PAGO_CLIENT_ID parece")
    ) {
      return NextResponse.redirect(new URL("/dashboard?mp_error=configuracao_oauth", request.url))
    }
    return NextResponse.redirect(new URL("/dashboard?mp_error=falha_conexao", request.url))
  }
}
