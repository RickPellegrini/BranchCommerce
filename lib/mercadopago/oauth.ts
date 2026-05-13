import { createHash, randomBytes } from "crypto"

import { getMercadoPagoConfig } from "@/lib/mercadopago/config"
import type { MpTokenResponse } from "@/lib/mercadopago/types"

type OAuthGrantType = "authorization_code" | "refresh_token"

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function generateMpPkce() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

async function requestToken(
  grantType: OAuthGrantType,
  payload: {
    code?: string
    refreshToken?: string
    codeVerifier?: string
  },
): Promise<MpTokenResponse> {
  const config = getMercadoPagoConfig()
  const body = new URLSearchParams({
    grant_type: grantType,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  if (grantType === "authorization_code") {
    if (!payload.code) throw new Error("Codigo OAuth ausente para autenticacao.")
    body.set("code", payload.code)
    body.set("redirect_uri", config.redirectUri)
    if (payload.codeVerifier) body.set("code_verifier", payload.codeVerifier)
  } else {
    if (!payload.refreshToken) throw new Error("Refresh token ausente para renovacao.")
    body.set("refresh_token", payload.refreshToken)
  }

  const response = await fetch(`${config.apiUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  })

  if (!response.ok) {
    const errorPayload = await response.text()
    throw new Error(`Falha no OAuth Mercado Pago: ${errorPayload}`)
  }

  return (await response.json()) as MpTokenResponse
}

/**
 * Monta a URL de autorizacao do Mercado Pago.
 * Spec: https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation
 *   GET https://auth.mercadopago.com.br/authorization
 *     ?client_id=APP_ID
 *     &response_type=code
 *     &platform_id=mp           <-- obrigatorio para a tela de consent MP
 *     &state=...
 *     &redirect_uri=...         <-- exatamente igual ao registrado no painel
 *     &code_challenge / code_challenge_method=S256 (PKCE opcional)
 */
export function buildMpAuthorizationUrl(state: string, codeChallenge?: string) {
  const config = getMercadoPagoConfig()
  if (!config.clientId || !/^\d+$/.test(config.clientId)) {
    throw new Error(
      `MERCADO_PAGO_CLIENT_ID invalido (esperado o ID numerico do app, recebi: '${config.clientId}').`,
    )
  }
  if (config.clientId.startsWith("APP_USR") || config.clientId.startsWith("TEST-")) {
    throw new Error(
      "MERCADO_PAGO_CLIENT_ID parece ser um access_token ou public_key. Use o ID numerico do app.",
    )
  }
  const url = new URL(config.authUrl)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("platform_id", "mp")
  url.searchParams.set("state", state)
  url.searchParams.set("redirect_uri", config.redirectUri)
  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge)
    url.searchParams.set("code_challenge_method", "S256")
  }
  return url.toString()
}

export async function exchangeMpCodeForTokens(code: string, codeVerifier?: string) {
  return requestToken("authorization_code", { code, codeVerifier })
}

export async function refreshMpAccessToken(refreshToken: string) {
  return requestToken("refresh_token", { refreshToken })
}
