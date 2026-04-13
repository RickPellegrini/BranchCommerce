import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { getMercadoLivreConfig } from "@/lib/mercadolivre/config"
import { refreshMlAccessToken } from "@/lib/mercadolivre/oauth"
import type { MlTokenResponse } from "@/lib/mercadolivre/types"
import { encryptToken, decryptToken, isEncrypted } from "@/lib/crypto/token-cipher"

function safeDecrypt(value: string): string {
  if (!value) return value
  return isEncrypted(value) ? decryptToken(value) : value
}

function safeEncrypt(value: string): string {
  if (!value) return value
  return isEncrypted(value) ? value : encryptToken(value)
}

type MlConnection = Awaited<
  ReturnType<typeof getMlConnectionByAppUser>
>

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  return new ConvexHttpClient(convexUrl)
}

export async function getMlConnectionByAppUser(appUserId: string) {
  const client = getConvexClient()
  return client.query(api.mercadolivre.getConnectionByAppUser, { appUserId })
}

export async function getMlConnectionByMlUserId(mlUserId: string) {
  const client = getConvexClient()
  return client.query(api.mercadolivre.getConnectionByMlUser, { mlUserId })
}

export async function getAnyMlConnection() {
  const client = getConvexClient()
  return client.query(api.mercadolivre.getAnyConnection, {})
}

export async function upsertMlConnection(params: {
  appUserId: string
  mlUserId: string
  accessToken: string
  refreshToken: string
  tokenType?: string
  scope?: string
  expiresIn: number
  expiresAt: number
}) {
  const client = getConvexClient()
  await client.mutation(api.mercadolivre.upsertConnection, {
    ...params,
    accessToken: safeEncrypt(params.accessToken),
    refreshToken: safeEncrypt(params.refreshToken),
  })
}

export async function updateMlTokens(params: {
  appUserId: string
  accessToken: string
  refreshToken: string
  tokenType?: string
  scope?: string
  expiresIn: number
  expiresAt: number
}) {
  const client = getConvexClient()
  await client.mutation(api.mercadolivre.updateTokens, {
    ...params,
    accessToken: safeEncrypt(params.accessToken),
    refreshToken: safeEncrypt(params.refreshToken),
  })
}

export async function disconnectMlConnection(appUserId: string) {
  const client = getConvexClient()
  // Convex codegen may be out-of-date until next `npx convex dev`.
  return client.mutation((api as any).mercadolivre.disconnectConnection, { appUserId })
}

function decryptConnection<T extends { accessToken: string; refreshToken: string }>(
  conn: T,
): T {
  return {
    ...conn,
    accessToken: safeDecrypt(conn.accessToken),
    refreshToken: safeDecrypt(conn.refreshToken),
  }
}

async function refreshConnection(connection: Exclude<MlConnection, null>) {
  const refreshed = await refreshMlAccessToken(connection.refreshToken)
  const expiresAt = Date.now() + refreshed.expires_in * 1000

  await updateMlTokens({
    appUserId: connection.appUserId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenType: refreshed.token_type,
    scope: refreshed.scope,
    expiresIn: refreshed.expires_in,
    expiresAt,
  })

  return {
    ...connection,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenType: refreshed.token_type,
    scope: refreshed.scope,
    expiresIn: refreshed.expires_in,
    expiresAt,
  }
}

const REFRESH_THRESHOLD_MS = 600_000

export async function getValidMlConnection(appUserId: string) {
  const raw = await getMlConnectionByAppUser(appUserId)
  if (!raw) {
    throw new Error("Conta do Mercado Livre nao conectada.")
  }

  const connection = decryptConnection(raw)
  if (connection.expiresAt <= Date.now() + REFRESH_THRESHOLD_MS) {
    return refreshConnection(connection)
  }

  return connection
}

export async function getValidMlConnectionByMlUserId(mlUserId: string) {
  const raw = await getMlConnectionByMlUserId(mlUserId)
  if (!raw) {
    throw new Error("Conta do Mercado Livre nao conectada.")
  }

  const connection = decryptConnection(raw)
  if (connection.expiresAt <= Date.now() + REFRESH_THRESHOLD_MS) {
    return refreshConnection(connection)
  }

  return connection
}

export async function getAnyValidMlConnection() {
  const raw = await getAnyMlConnection()
  if (!raw) {
    throw new Error("Conta do Mercado Livre nao conectada.")
  }

  const connection = decryptConnection(raw)
  if (connection.expiresAt <= Date.now() + REFRESH_THRESHOLD_MS) {
    return refreshConnection(connection)
  }

  return connection
}

export async function fetchMlApi<T>(path: string, accessToken: string): Promise<T> {
  return requestMlApi<T>(path, accessToken, { method: "GET" })
}

async function doMlRequest<T>(
  path: string,
  accessToken: string,
  init?: {
    method?: "GET" | "PUT" | "POST"
    body?: unknown
  },
): Promise<T> {
  const response = await fetch(`${getMercadoLivreConfig().apiUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    cache: "no-store",
  })

  if (!response.ok) {
    const errorPayload = await response.text()
    throw new MlApiError(response.status, errorPayload)
  }

  return (await response.json()) as T
}

export class MlApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Erro Mercado Livre (${status}): ${body}`)
    this.name = "MlApiError"
  }
}

export async function requestMlApi<T>(
  path: string,
  accessToken: string,
  init?: {
    method?: "GET" | "PUT" | "POST"
    body?: unknown
  },
): Promise<T> {
  return doMlRequest<T>(path, accessToken, init)
}

export function parseTokenToConnection(params: {
  appUserId: string
  token: MlTokenResponse
}) {
  const expiresAt = Date.now() + params.token.expires_in * 1000
  return {
    appUserId: params.appUserId,
    mlUserId: String(params.token.user_id),
    accessToken: params.token.access_token,
    refreshToken: params.token.refresh_token,
    tokenType: params.token.token_type,
    scope: params.token.scope,
    expiresIn: params.token.expires_in,
    expiresAt,
  }
}
