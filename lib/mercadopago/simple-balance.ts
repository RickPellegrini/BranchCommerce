import { getMercadoLivreConfig } from "@/lib/mercadolivre/config"

import { fetchMpPaymentDetailsForIds, paymentNetReceivedFromDetail } from "./future-releases"
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

type MpPaymentSearchRow = {
  id: number
  date_created: string
  description: string
  transaction_amount: number
  net_received_amount: number
  transaction_details?: { net_received_amount?: number }
  fee_details: Array<{ type: string; amount: number; fee_payer?: string }>
  status: string
  status_detail: string
  operation_type: string
  payment_type_id: string
  payer?: { id?: string | number }
  collector?: { id?: string | number }
  payer_id?: number
  collector_id?: number
}

type MpSearchResponse = {
  paging: { total: number; offset: number; limit: number }
  results: MpPaymentSearchRow[]
}

function mpPartyIds(p: MpPaymentSearchRow): { payerId: string | null; collectorId: string | null } {
  const payerId =
    p.payer?.id != null ? String(p.payer.id) : p.payer_id != null ? String(p.payer_id) : null
  const collectorId =
    p.collector?.id != null
      ? String(p.collector.id)
      : p.collector_id != null
        ? String(p.collector_id)
        : null
  return { payerId, collectorId }
}

/**
 * Credito = dinheiro entra na sua conta (voce e o collector do pagamento).
 * Debito = dinheiro sai (voce e o payer e nao e o collector), ex.: Pix enviado, ou cobranca nao aprovada.
 * Antes: qualquer `approved` virava credito — Pix enviado tambem e approved, gerando o bug.
 */
function classifyMpTransactionType(p: MpPaymentSearchRow, accountUserId: string): "credit" | "debit" {
  const me = String(accountUserId).trim()
  const { payerId, collectorId } = mpPartyIds(p)
  const imCollector = collectorId !== null && collectorId === me
  const imPayer = payerId !== null && payerId === me

  if (imPayer && !imCollector) {
    return "debit"
  }
  if (imCollector) {
    return p.status === "approved" ? "credit" : "debit"
  }

  const op = (p.operation_type ?? "").toLowerCase()
  if (imPayer && collectorId === null && (op === "money_transfer" || op === "account_fund")) {
    return "debit"
  }

  if (!imPayer && !imCollector) {
    if (
      op === "regular_payment" ||
      op === "pos_payment" ||
      op === "ticket" ||
      op === "digital_currency" ||
      op === "atm"
    ) {
      return p.status === "approved" ? "credit" : "debit"
    }
    if (op === "money_transfer" || op === "payout") {
      return "debit"
    }
  }

  if (p.status !== "approved") {
    return "debit"
  }
  console.warn(
    "[mp-transactions] Fallback credito (sem payer/collector claro):",
    p.id,
    op,
    "payer=",
    payerId,
    "collector=",
    collectorId,
  )
  return "credit"
}

/**
 * Saldo do MP reflete valor liquido nas vendas (apos taxas). O extrato usava
 * `transaction_amount` (bruto), inflando o "saldo estimado" vs app oficial.
 */
function amountForBalanceLine(
  p: MpPaymentSearchRow,
  type: "credit" | "debit",
): number {
  if (type === "debit") {
    return p.transaction_amount
  }
  const fromDetails = p.transaction_details?.net_received_amount
  if (typeof fromDetails === "number" && fromDetails > 0) return fromDetails
  if (typeof p.net_received_amount === "number" && p.net_received_amount > 0) {
    return p.net_received_amount
  }
  const fd = p.fee_details
  if (fd && fd.length > 0) {
    const fees = fd
      .filter((f) => f.fee_payer === undefined || f.fee_payer === "collector")
      .reduce((s, f) => s + f.amount, 0)
    return Math.max(0, p.transaction_amount - fees)
  }
  return p.transaction_amount
}

export async function getTransactions(
  accessToken: string,
  accountUserId: string,
  limit = 30,
): Promise<MpTransaction[]> {
  const raw = await mpFetch<MpSearchResponse>(
    `/v1/payments/search?sort=date_created&criteria=desc&limit=${limit}`,
    accessToken,
  )

  const classified = raw.results.map((p) => ({
    p,
    type: classifyMpTransactionType(p, accountUserId),
  }))

  const creditIds = [
    ...new Set(classified.filter((r) => r.type === "credit").map((r) => r.p.id)),
  ]
  const detailsById =
    creditIds.length > 0
      ? await fetchMpPaymentDetailsForIds(creditIds, accessToken)
      : new Map()

  return classified.map(({ p, type }) => {
    let amount: number
    if (type === "debit") {
      amount = p.transaction_amount
    } else {
      const detail = detailsById.get(p.id)
      amount = detail ? paymentNetReceivedFromDetail(detail) : amountForBalanceLine(p, type)
    }
    return {
      id: String(p.id),
      date: p.date_created,
      description: p.description ?? `${p.operation_type} - ${p.payment_type_id}`,
      amount,
      type,
      status: p.status,
    }
  })
}
