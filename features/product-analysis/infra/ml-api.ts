import { getMercadoLivreConfig } from "@/lib/mercadolivre/config"
import type {
  MlItemFull,
  MlProduct,
  MlSeller,
  MlSellerBatchEntry,
  MlPriceToWinResult,
  MlVisitsEntry,
  CatalogProductItemsResponse,
} from "@/features/product-analysis/domain/types"

// ─── Upstream error ────────────────────────────────────────────────

export class MlUpstreamError extends Error {
  constructor(
    public readonly mlStatus: number,
    public readonly endpoint: string,
    public readonly bodyText: string,
    public readonly authMode: "public" | "private",
  ) {
    super(`ML ${mlStatus} on ${endpoint}`)
    this.name = "MlUpstreamError"
  }

  toJSON() {
    return {
      name: this.name,
      mlStatus: this.mlStatus,
      endpoint: this.endpoint,
      authMode: this.authMode,
      body: this.tryParseBody(),
    }
  }

  private tryParseBody(): unknown {
    try { return JSON.parse(this.bodyText) } catch { return this.bodyText }
  }
}

// ─── Shared fetch helper ────────────────────────────────────────────
//
// Per ML docs: "Em toda chamada que voce realizar a API do Mercado Livre,
// envie o access token em todas elas para todos recursos tanto publico como privados."

const ML_BASE = () => getMercadoLivreConfig().apiUrl

function maskToken(token: string): string {
  if (token.length <= 12) return "***"
  return `${token.slice(0, 6)}…${token.slice(-4)}`
}

async function fetchMl<T = unknown>(
  path: string,
  label: string,
  token: string | null,
): Promise<T> {
  const url = `${ML_BASE()}${path}`
  const mode = token ? "auth" : "noauth"
  const prefix = token ? maskToken(token) : "none"
  console.log(`[ml-${mode}] ▶ ${label} | ${url}${token ? ` | token=${prefix}` : ""}`)
  const t0 = Date.now()

  const headers: Record<string, string> = { Accept: "application/json" }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(url, { method: "GET", headers, cache: "no-store" })

  const bodyText = await res.text()
  const ms = Date.now() - t0
  const preview = bodyText.length > 300 ? bodyText.slice(0, 300) + "…" : bodyText
  console.log(`[ml-${mode}] ${res.ok ? "✓" : "✗"} ${label} | ${res.status} | ${ms}ms | ${preview}`)

  if (!res.ok) {
    throw new MlUpstreamError(res.status, url, bodyText, token ? "private" : "public")
  }

  return JSON.parse(bodyText) as T
}

export async function fetchMlPrivate<T = unknown>(path: string, token: string, label: string): Promise<T> {
  return fetchMl<T>(path, label, token)
}

// ─── Endpoints that require token ────────────────────────────────────
// ML now requires a token on ALL calls (PolicyAgent 403 without it).
// /items/{id} with token returns 403 for third-party items (access_denied),
// so for third-party analysis we rely on /products/{id} + /products/{id}/items.

export async function getItem(itemId: string, token: string): Promise<MlItemFull> {
  return fetchMl<MlItemFull>(`/items/${itemId}`, `GET /items/${itemId}`, token)
}

export async function getProduct(productId: string, token: string): Promise<MlProduct> {
  return fetchMl<MlProduct>(`/products/${productId}`, `GET /products/${productId}`, token)
}

export async function getProductItems(productId: string, token: string): Promise<CatalogProductItemsResponse> {
  return fetchMl<CatalogProductItemsResponse>(
    `/products/${productId}/items`,
    `GET /products/${productId}/items`,
    token,
  )
}

/** Batch-fetch seller info: nicknames, reputation, power_seller_status. */
export async function getSellersBatch(
  token: string,
  sellerIds: number[],
): Promise<Map<number, MlSeller>> {
  const map = new Map<number, MlSeller>()
  if (sellerIds.length === 0) return map

  const settled = await Promise.allSettled(
    chunk(sellerIds, 20).map((batch) => {
      const ids = batch.join(",")
      return fetchMl<MlSellerBatchEntry[]>(
        `/users?ids=${ids}`,
        `GET /users?ids= (batch=${batch.length})`,
        token,
      )
    }),
  )
  for (const r of settled) {
    if (r.status !== "fulfilled") continue
    for (const entry of r.value) {
      if (entry.code === 200 && entry.body?.id) {
        map.set(entry.body.id, entry.body)
      }
    }
  }
  return map
}

// ─── PRIVATE endpoints (require seller token) ──────────────────────

/** GET /items/{id}/price_to_win — seller-specific, requires auth. */
export async function getPriceToWin(token: string, itemId: string): Promise<MlPriceToWinResult | null> {
  try {
    return await fetchMlPrivate<MlPriceToWinResult>(
      `/items/${itemId}/price_to_win?version=v2`,
      token,
      `GET /items/${itemId}/price_to_win`,
    )
  } catch (err) {
    if (err instanceof MlUpstreamError) {
      console.log(`[ml-private] ⚠ price_to_win skipped (${err.mlStatus})`)
    }
    return null
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

type VisitsTimeWindowResponse = {
  item_id: string
  total_visits: number
}

/**
 * Fetch 30-day visits for a list of item IDs (works for third-party items).
 * Uses /items/{id}/visits/time_window which allows individual item queries.
 * Runs in parallel batches of `concurrency`.
 */
export async function getCompetitorVisits(
  token: string,
  itemIds: string[],
  days: number = 30,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (itemIds.length === 0) return map

  const settled = await Promise.allSettled(
    itemIds.map((id) =>
      fetchMl<VisitsTimeWindowResponse>(
        `/items/${id}/visits/time_window?last=${days}&unit=day`,
        `GET visits ${id}`,
        token,
      ).then((r) => ({ id, visits: r.total_visits })),
    ),
  )
  for (const r of settled) {
    if (r.status === "fulfilled") {
      map.set(r.value.id, r.value.visits)
    }
  }
  return map
}

/** GET /items/visits — seller-specific, requires auth. */
export async function getVisitsBatch(
  token: string,
  ids: string[],
  dateFrom: string,
  dateTo: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (ids.length === 0) return map

  const settled = await Promise.allSettled(
    chunk(ids, 50).map((c) => {
      const path = `/items/visits?ids=${c.join(",")}&date_from=${dateFrom}&date_to=${dateTo}`
      return fetchMlPrivate<MlVisitsEntry[]>(path, token, `GET /items/visits (batch=${c.length})`)
    }),
  )
  for (const r of settled) {
    if (r.status !== "fulfilled") continue
    for (const e of r.value) {
      if (e.item_id) map.set(e.item_id, e.total_visits ?? 0)
    }
  }
  return map
}
