import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import { encryptToken, decryptToken, isEncrypted } from "@/lib/crypto/token-cipher"
import { refreshMpAccessToken } from "@/lib/mercadopago/oauth"
import type { MpTokenResponse } from "@/lib/mercadopago/types"

type MpConnection = Awaited<ReturnType<typeof getMpConnectionByAppUser>>

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  return new ConvexHttpClient(convexUrl)
}

function safeDecrypt(value: string): string {
  if (!value) return value
  return isEncrypted(value) ? decryptToken(value) : value
}

function safeEncrypt(value: string): string {
  if (!value) return value
  return isEncrypted(value) ? value : encryptToken(value)
}

export async function getMpConnectionByAppUser(appUserId: string) {
  const client = getConvexClient()
  return client.query(api.mercadopago.getConnectionByAppUser, { appUserId })
}

export async function upsertMpConnection(params: {
  appUserId: string
  mpUserId: string
  accessToken: string
  refreshToken: string
  tokenType?: string
  scope?: string
  publicKey?: string
  liveMode?: boolean
  expiresIn: number
  expiresAt: number
}) {
  const client = getConvexClient()
  await client.mutation(api.mercadopago.upsertConnection, {
    ...params,
    accessToken: safeEncrypt(params.accessToken),
    refreshToken: safeEncrypt(params.refreshToken),
  })
}

export async function updateMpTokens(params: {
  appUserId: string
  accessToken: string
  refreshToken: string
  tokenType?: string
  scope?: string
  expiresIn: number
  expiresAt: number
}) {
  const client = getConvexClient()
  await client.mutation(api.mercadopago.updateTokens, {
    ...params,
    accessToken: safeEncrypt(params.accessToken),
    refreshToken: safeEncrypt(params.refreshToken),
  })
}

export async function disconnectMpConnection(appUserId: string) {
  const client = getConvexClient()
  return client.mutation(api.mercadopago.disconnectConnection, { appUserId })
}

function decryptConnection<T extends { accessToken: string; refreshToken: string }>(conn: T): T {
  return {
    ...conn,
    accessToken: safeDecrypt(conn.accessToken),
    refreshToken: safeDecrypt(conn.refreshToken),
  }
}

const REFRESH_THRESHOLD_MS = 600_000

async function refreshConnection(connection: Exclude<MpConnection, null>) {
  const refreshed = await refreshMpAccessToken(connection.refreshToken)
  const expiresAt = Date.now() + refreshed.expires_in * 1000

  await updateMpTokens({
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

export async function getValidMpConnection(appUserId: string) {
  const raw = await getMpConnectionByAppUser(appUserId)
  if (!raw) return null

  const connection = decryptConnection(raw)
  if (connection.expiresAt <= Date.now() + REFRESH_THRESHOLD_MS) {
    return refreshConnection(connection)
  }
  return connection
}

export function parseTokenToMpConnection(params: { appUserId: string; token: MpTokenResponse }) {
  const expiresAt = Date.now() + params.token.expires_in * 1000
  return {
    appUserId: params.appUserId,
    mpUserId: String(params.token.user_id),
    accessToken: params.token.access_token,
    refreshToken: params.token.refresh_token,
    tokenType: params.token.token_type,
    scope: params.token.scope,
    publicKey: params.token.public_key,
    liveMode: params.token.live_mode,
    expiresIn: params.token.expires_in,
    expiresAt,
  }
}
