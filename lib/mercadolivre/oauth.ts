import { createHash, randomBytes } from "crypto"

import { getMercadoLivreConfig } from "@/lib/mercadolivre/config"
import type { MlTokenResponse } from "@/lib/mercadolivre/types"

type OAuthGrantType = "authorization_code" | "refresh_token"

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function generatePkce() {
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
) {
  const body = new URLSearchParams({
    grant_type: grantType,
    client_id: getMercadoLivreConfig().clientId,
    client_secret: getMercadoLivreConfig().clientSecret,
  })

  if (grantType === "authorization_code") {
    if (!payload.code) throw new Error("Codigo OAuth ausente para autenticacao.")
    body.set("code", payload.code)
    body.set("redirect_uri", getMercadoLivreConfig().redirectUri)
    if (payload.codeVerifier) {
      body.set("code_verifier", payload.codeVerifier)
    }
  } else {
    if (!payload.refreshToken) throw new Error("Refresh token ausente para renovacao.")
    body.set("refresh_token", payload.refreshToken)
  }

  const response = await fetch(`${getMercadoLivreConfig().apiUrl}/oauth/token`, {
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
    throw new Error(`Falha no OAuth Mercado Livre: ${errorPayload}`)
  }

  return (await response.json()) as MlTokenResponse
}

export function buildMlAuthorizationUrl(state: string, codeChallenge?: string) {
  const config = getMercadoLivreConfig()
  const url = new URL(config.authUrl)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("state", state)

  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge)
    url.searchParams.set("code_challenge_method", "S256")
  }

  const extraScope = process.env.MERCADO_LIVRE_OAUTH_SCOPE?.trim()
  if (extraScope) {
    url.searchParams.set("scope", extraScope)
  }
  return url.toString()
}

export async function exchangeCodeForTokens(code: string, codeVerifier?: string) {
  return requestToken("authorization_code", { code, codeVerifier })
}

export async function refreshMlAccessToken(refreshToken: string) {
  return requestToken("refresh_token", { refreshToken })
}
