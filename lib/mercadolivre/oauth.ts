import { getMercadoLivreConfig } from "@/lib/mercadolivre/config"
import type { MlTokenResponse } from "@/lib/mercadolivre/types"

type OAuthGrantType = "authorization_code" | "refresh_token"

async function requestToken(
  grantType: OAuthGrantType,
  payload: {
    code?: string
    refreshToken?: string
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

export function buildMlAuthorizationUrl(state: string) {
  const config = getMercadoLivreConfig()
  const url = new URL(config.authUrl)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("state", state)
  return url.toString()
}

export async function exchangeCodeForTokens(code: string) {
  return requestToken("authorization_code", { code })
}

export async function refreshMlAccessToken(refreshToken: string) {
  return requestToken("refresh_token", { refreshToken })
}
