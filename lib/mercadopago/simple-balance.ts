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

async function resolveMpUserId(accessToken: string, mlUserId: string): Promise<string> {
  const urls = ["https://api.mercadopago.com/users/me", "https://api.mercadopago.com/v1/users/me"]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
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

export async function getBalance(accessToken: string, mlUserId: string): Promise<MpBalance> {
  const mpBase = "https://api.mercadopago.com"
  const mlBase = getMercadoLivreConfig().apiUrl.replace(/\/$/, "")
  const userId = await resolveMpUserId(accessToken, mlUserId)

  const paths = [
    `/users/${userId}/mercadopago_account/balance`,
    `/v1/users/${userId}/mercadopago_account/balance`,
  ]

  const attempts: Array<{ label: string; url: string; headers: Record<string, string> }> = []

  for (const base of [mpBase, mlBase]) {
    for (const path of paths) {
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
 * Refund / chargeback / reservation_release entram aqui: reembolso para o
 * comprador, contestacao paga ao comprador, e devolucao de reserva — todos
 * causam saida do saldo do vendedor.
 * Antes: qualquer `approved` virava credito — Pix enviado tambem e approved, gerando o bug.
 */
export function classifyMpTransactionType(
  p: MpPaymentSearchRow,
  accountUserId: string,
): "credit" | "debit" {
  const me = String(accountUserId).trim()
  const op = (p.operation_type ?? "").toLowerCase()

  // Refund/chargeback: dinheiro sai do collector (voce) para o payer (comprador).
  // Mesmo se voce e o collector original, o efeito no saldo e negativo.
  if (op === "refund" || op === "chargeback") {
    return "debit"
  }

  const { payerId, collectorId } = mpPartyIds(p)
  const imCollector = collectorId !== null && collectorId === me
  const imPayer = payerId !== null && payerId === me

  if (imPayer && !imCollector) {
    return "debit"
  }
  if (imCollector) {
    if (op === "reservation_release") return "credit"
    return p.status === "approved" ? "credit" : "debit"
  }

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
function amountForBalanceLine(p: MpPaymentSearchRow, type: "credit" | "debit"): number {
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

export type MpTransactionsResult = {
  transactions: MpTransaction[]
  totalCredits: number
  totalDebits: number
  /** Filtro inicial (oldest aceito). Util pra UI explicar a janela usada. */
  windowSinceIso: string
  /** Numero de paginas consumidas. */
  pagesFetched: number
}

const PAGE_SIZE = 50
const MAX_PAGES = 20 // hard cap pra nao explodir em conta antiga

/**
 * Busca pagamentos do MP em uma janela de dias com paginacao. Para o nome
 * "limit" retornar mais que 50, percorremos pages com `offset`.
 * Quando `limit` e suficientemente pequeno (legado), pula a paginacao.
 */
export async function getTransactions(
  accessToken: string,
  accountUserId: string,
  limit = 30,
): Promise<MpTransaction[]> {
  const result = await getTransactionsWindow(accessToken, accountUserId, {
    maxItems: limit,
    windowDays: limit > PAGE_SIZE ? 180 : null,
  })
  return result.transactions
}

export async function getTransactionsWindow(
  accessToken: string,
  accountUserId: string,
  opts: {
    /** Limite total de items retornados (default 1000). */
    maxItems?: number
    /** Quantos dias para tras filtrar. Null = sem filtro de data. Default 180. */
    windowDays?: number | null
  } = {},
): Promise<MpTransactionsResult> {
  const maxItems = opts.maxItems ?? 1000
  const windowDays = opts.windowDays === undefined ? 180 : opts.windowDays

  const sinceDate =
    windowDays === null ? null : new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const sinceIso = sinceDate ? sinceDate.toISOString() : new Date(0).toISOString()
  const nowIso = new Date().toISOString()

  const all: MpPaymentSearchRow[] = []
  let offset = 0
  let pagesFetched = 0
  let reachedWindowEdge = false

  while (pagesFetched < MAX_PAGES && all.length < maxItems && !reachedWindowEdge) {
    const pageSize = Math.min(PAGE_SIZE, maxItems - all.length)
    const dateRange = sinceDate
      ? `&range=date_created&begin_date=${encodeURIComponent(sinceIso)}&end_date=${encodeURIComponent(nowIso)}`
      : ""
    const url =
      `/v1/payments/search?sort=date_created&criteria=desc` +
      `&limit=${pageSize}&offset=${offset}` +
      dateRange
    const page = await mpFetch<MpSearchResponse>(url, accessToken)
    pagesFetched += 1
    if (page.results.length === 0) break
    for (const row of page.results) {
      if (sinceDate && row.date_created && new Date(row.date_created) < sinceDate) {
        reachedWindowEdge = true
        break
      }
      all.push(row)
      if (all.length >= maxItems) break
    }
    if (page.results.length < pageSize) break
    if (offset + page.results.length >= page.paging.total) break
    offset += page.results.length
  }

  const classified = all.map((p) => ({
    p,
    type: classifyMpTransactionType(p, accountUserId),
  }))

  const creditIds = [...new Set(classified.filter((r) => r.type === "credit").map((r) => r.p.id))]
  const detailsById =
    creditIds.length > 0 ? await fetchMpPaymentDetailsForIds(creditIds, accessToken) : new Map()

  const transactions: MpTransaction[] = classified.map(({ p, type }) => {
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

  let totalCredits = 0
  let totalDebits = 0
  for (const t of transactions) {
    if (t.type === "credit") totalCredits += t.amount
    else totalDebits += t.amount
  }

  return {
    transactions,
    totalCredits,
    totalDebits,
    windowSinceIso: sinceIso,
    pagesFetched,
  }
}
