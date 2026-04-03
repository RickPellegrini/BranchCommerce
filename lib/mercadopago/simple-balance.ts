import { getMercadoLivreConfig } from "@/lib/mercadolivre/config"

import { mpFetch } from "./http"

type MpBalanceResponse = {
  available_balance: number
  unavailable_balance: number
  total_amount: number
  currency_id: string
}

export type MpBalance = {
  availableBalance: number
  unavailableBalance: number
  totalAmount: number
  currencyId: string
}

export type MpTransaction = {
  id: string
  date: string
  description: string
  amount: number
  type: "credit" | "debit"
  status: string
}

function mapBalance(raw: MpBalanceResponse): MpBalance {
  return {
    availableBalance: raw.available_balance,
    unavailableBalance: raw.unavailable_balance,
    totalAmount: raw.total_amount,
    currencyId: raw.currency_id,
  }
}

/**
 * O endpoint de saldo do MP costuma aceitar access_token na query (doc antiga).
 * Com Bearer sozinho, tokens OAuth Mercado Livre as vezes retornam 403 ForbiddenApiError.
 */
async function tryBalance(
  label: string,
  url: string,
  headers: Record<string, string>,
): Promise<MpBalanceResponse | null> {
  try {
    console.log(`[mp-balance] ${label} GET ${url.split("?")[0]}${url.includes("?") ? "?..." : ""}`)
    const res = await fetch(url, { headers, cache: "no-store" })
    if (!res.ok) {
      const t = await res.text()
      console.warn(`[mp-balance] ${label} → ${res.status} ${t.slice(0, 200)}`)
      return null
    }
    const text = await res.text()
    return JSON.parse(text) as MpBalanceResponse
  } catch (e) {
    console.warn(`[mp-balance] ${label} falhou:`, e)
    return null
  }
}

/** Tenta descobrir o user_id correto no ecossistema MP (pode coincidir com ML, mas garantimos). */
async function resolveMpUserId(accessToken: string, mlUserId: string): Promise<string> {
  const enc = encodeURIComponent(accessToken)
  const candidates = [
    `https://api.mercadopago.com/users/me?access_token=${enc}`,
    `https://api.mercadopago.com/v1/users/me?access_token=${enc}`,
  ]
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
      if (!res.ok) continue
      const u = (await res.json()) as { id?: number }
      if (typeof u.id === "number") {
        console.log(`[mp-balance] users/me → id=${u.id}`)
        return String(u.id)
      }
    } catch {
      /* next */
    }
  }
  return mlUserId
}

export async function getBalance(
  accessToken: string,
  mlUserId: string,
): Promise<MpBalance> {
  const mpBase = "https://api.mercadopago.com"
  const mlBase = getMercadoLivreConfig().apiUrl.replace(/\/$/, "")
  const userId = await resolveMpUserId(accessToken, mlUserId)
  const enc = encodeURIComponent(accessToken)

  const paths = [
    `/users/${userId}/mercadopago_account/balance`,
    `/v1/users/${userId}/mercadopago_account/balance`,
  ]

  const attempts: Array<{ label: string; url: string; headers: Record<string, string> }> = []

  for (const base of [mpBase, mlBase]) {
    for (const path of paths) {
      attempts.push({
        label: `${base} query${path}`,
        url: `${base}${path}?access_token=${enc}`,
        headers: { Accept: "application/json" },
      })
      attempts.push({
        label: `${base} bearer${path}`,
        url: `${base}${path}`,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
    }
  }

  for (const a of attempts) {
    const raw = await tryBalance(a.label, a.url, a.headers)
    if (raw && typeof raw.available_balance === "number") {
      console.log(`[mp-balance] OK via ${a.label}`)
      return mapBalance(raw)
    }
  }

  throw new Error(
    `Mercado Pago API error: 403 — {"error":"ForbiddenApiError","cause":"forbidden","message":"forbidden"} — todas as variantes (query/bearer, /users e /v1/users, api.mercadopago e api.mercadolibre) falharam para userId=${userId}`,
  )
}

type MpSearchResponse = {
  paging: { total: number; offset: number; limit: number }
  results: Array<{
    id: number
    date_created: string
    description: string
    transaction_amount: number
    net_received_amount: number
    fee_details: Array<{ type: string; amount: number }>
    status: string
    status_detail: string
    operation_type: string
    payment_type_id: string
  }>
}

export async function getTransactions(
  accessToken: string,
  limit = 30,
): Promise<MpTransaction[]> {
  const raw = await mpFetch<MpSearchResponse>(
    `/v1/payments/search?sort=date_created&criteria=desc&limit=${limit}`,
    accessToken,
  )

  return raw.results.map((p) => ({
    id: String(p.id),
    date: p.date_created,
    description: p.description ?? `${p.operation_type} - ${p.payment_type_id}`,
    amount: p.transaction_amount,
    type: p.status === "approved" ? ("credit" as const) : ("debit" as const),
    status: p.status,
  }))
}
