import { fetchMpPaymentDetailsForIds, paymentNetReceivedFromDetail } from "./future-releases"
import { MP_API, mpFetch } from "./http"

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

export type OfficialBalanceProbe = {
  url: string
  status: number | null
  ok: boolean
  /** Body completo da resposta (truncado em 1500 chars). */
  bodyPreview: string
  /** Codigo de erro retornado pelo MP quando aplicavel. */
  errorCode: string | null
}

export type OfficialBalanceReason =
  | "ok"
  | "forbidden"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "no_user_id"
  | "unknown"

export type OfficialBalanceResult = {
  balance: MpBalance | null
  resolvedUserId: string
  probes: OfficialBalanceProbe[]
  reason: OfficialBalanceReason
}

function mapBalance(raw: MpBalanceResponse): MpBalance {
  return {
    availableBalance: raw.available_balance,
    unavailableBalance: raw.unavailable_balance,
    totalAmount: raw.total_amount,
    currencyId: raw.currency_id,
  }
}

function classifyHttpReason(status: number | null): OfficialBalanceReason {
  if (status === 401) return "unauthorized"
  if (status === 403) return "forbidden"
  if (status === 404) return "not_found"
  if (status === 429) return "rate_limited"
  return "unknown"
}

function extractErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      error?: string
      message?: string
      cause?: Array<{ code?: number | string }>
    }
    if (parsed.error) return parsed.error
    if (parsed.cause && parsed.cause[0]?.code != null) return String(parsed.cause[0].code)
    if (parsed.message) return parsed.message.slice(0, 80)
    return null
  } catch {
    return null
  }
}

async function probeBalance(url: string, accessToken: string): Promise<OfficialBalanceProbe> {
  try {
    console.log(`[mp-balance] GET ${url}`)
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    })
    const body = await res.text()
    if (!res.ok) {
      console.warn(`[mp-balance] ${res.status} from ${url} — ${body.slice(0, 300)}`)
    } else {
      console.log(`[mp-balance] OK ${res.status} from ${url}`)
    }
    return {
      url,
      status: res.status,
      ok: res.ok,
      bodyPreview: body.slice(0, 1500),
      errorCode: res.ok ? null : extractErrorCode(body),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[mp-balance] network error for ${url}: ${message}`)
    return { url, status: null, ok: false, bodyPreview: message, errorCode: "network_error" }
  }
}

async function resolveMpUserId(accessToken: string, hintUserId: string): Promise<string> {
  if (hintUserId) return hintUserId

  const urls = [`${MP_API}/users/me`, `${MP_API}/v1/users/me`]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      })
      if (!res.ok) {
        const body = await res.text()
        console.warn(`[mp-balance] users/me ${res.status} from ${url}: ${body.slice(0, 200)}`)
        continue
      }
      const u = (await res.json()) as { id?: number }
      if (typeof u.id === "number") {
        console.log(`[mp-balance] users/me → id=${u.id}`)
        return String(u.id)
      }
    } catch (err) {
      console.warn(`[mp-balance] users/me network error: ${String(err)}`)
    }
  }
  return ""
}

/**
 * Fetches the wallet balance directly from Mercado Pago. Tries the v1 path
 * first, then the legacy path. Never throws — instead returns a rich result
 * with the probes and reason so callers can decide whether to fall back to
 * the computed-from-extract source.
 */
export async function fetchOfficialBalance(
  accessToken: string,
  hintUserId: string,
): Promise<OfficialBalanceResult> {
  const userId = await resolveMpUserId(accessToken, hintUserId)
  if (!userId) {
    return {
      balance: null,
      resolvedUserId: "",
      probes: [],
      reason: "no_user_id",
    }
  }

  const candidates = [
    `${MP_API}/v1/users/${userId}/mercadopago_account/balance`,
    `${MP_API}/users/${userId}/mercadopago_account/balance`,
  ]

  const probes: OfficialBalanceProbe[] = []
  for (const url of candidates) {
    const probeResult = await probeBalance(url, accessToken)
    probes.push(probeResult)
    if (probeResult.ok) {
      try {
        const parsed = JSON.parse(probeResult.bodyPreview) as MpBalanceResponse
        if (typeof parsed.available_balance === "number") {
          return {
            balance: mapBalance(parsed),
            resolvedUserId: userId,
            probes,
            reason: "ok",
          }
        }
      } catch (err) {
        console.warn(`[mp-balance] body parsing failed for ${url}: ${String(err)}`)
      }
    }
  }

  // Pega a razao do PRIMEIRO erro (geralmente o mais informativo).
  const firstFailure = probes.find((p) => !p.ok)
  const reason = firstFailure ? classifyHttpReason(firstFailure.status) : "unknown"
  return { balance: null, resolvedUserId: userId, probes, reason }
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
  /** Presente em /v1/payments/search; usado pelo computed balance. */
  money_release_status?: string
  money_release_date?: string | null
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
  windowSinceIso: string
  pagesFetched: number
}

const PAGE_SIZE = 50
const MAX_PAGES = 20

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
    maxItems?: number
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

export type ComputedBalanceResult = {
  balance: MpBalance
  /** Janela usada para varrer o extrato (ISO oldest). */
  windowSinceIso: string
  /** Total de pagamentos varridos (paginados). */
  itemsScanned: number
  /** Total de creditos ja liberados (entram em `availableBalance`). */
  releasedCredits: number
  /** Total de creditos ainda pendentes de release (entram em `unavailableBalance`). */
  pendingCredits: number
  /** Total de debitos no periodo. */
  debits: number
  /** Numero de paginas consumidas. */
  pagesFetched: number
}

const COMPUTED_BALANCE_MAX_PAGES = 60
const COMPUTED_BALANCE_PAGE_SIZE = 100

/**
 * Reconstroi um proxy auditavel do saldo MP a partir do extrato real
 * (`/v1/payments/search`) quando o endpoint oficial de balance retorna 403.
 *
 * available_balance = soma dos creditos liquidos ja liberados − soma de debitos
 *                     (incluindo refunds, chargebacks, transfers para banco e
 *                     payouts no periodo).
 * unavailable_balance = soma dos creditos liquidos ainda nao liberados
 *                       (money_release_status != "released").
 *
 * Importante: a janela e finita (default 365 dias, 60 paginas de 100 = 6000
 * items max). Para contas com mais movimento que isso, o numero subestima o
 * saldo real, mas continua sendo a fonte auditavel mais proxima.
 */
export async function computeBalanceFromExtract(
  accessToken: string,
  accountUserId: string,
  opts: { windowDays?: number; maxItems?: number; currencyId?: string } = {},
): Promise<ComputedBalanceResult> {
  const windowDays = opts.windowDays ?? 365
  const maxItems = opts.maxItems ?? COMPUTED_BALANCE_MAX_PAGES * COMPUTED_BALANCE_PAGE_SIZE
  const currencyId = opts.currencyId ?? "BRL"

  const sinceDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const sinceIso = sinceDate.toISOString()
  const nowIso = new Date().toISOString()

  const rows: MpPaymentSearchRow[] = []
  let offset = 0
  let pagesFetched = 0
  let reachedWindowEdge = false

  while (
    pagesFetched < COMPUTED_BALANCE_MAX_PAGES &&
    rows.length < maxItems &&
    !reachedWindowEdge
  ) {
    const pageSize = Math.min(COMPUTED_BALANCE_PAGE_SIZE, maxItems - rows.length)
    const url =
      `/v1/payments/search?sort=date_created&criteria=desc` +
      `&limit=${pageSize}&offset=${offset}` +
      `&range=date_created&begin_date=${encodeURIComponent(sinceIso)}&end_date=${encodeURIComponent(nowIso)}`
    const page = await mpFetch<MpSearchResponse>(url, accessToken)
    pagesFetched += 1
    if (page.results.length === 0) break
    for (const row of page.results) {
      if (row.date_created && new Date(row.date_created) < sinceDate) {
        reachedWindowEdge = true
        break
      }
      rows.push(row)
      if (rows.length >= maxItems) break
    }
    if (page.results.length < pageSize) break
    if (offset + page.results.length >= page.paging.total) break
    offset += page.results.length
  }

  const classified = rows.map((p) => ({ p, type: classifyMpTransactionType(p, accountUserId) }))

  // Para creditos liberados queremos o `net_received_amount` real — buscamos
  // detail para os approved+released. Limita a 200 detalhes por seguranca; o
  // restante usa amountForBalanceLine (fallback bom-o-suficiente).
  const releasedCreditIds = classified
    .filter(
      (r) =>
        r.type === "credit" && r.p.status === "approved" && r.p.money_release_status === "released",
    )
    .map((r) => r.p.id)
  const uniqueReleased = [...new Set(releasedCreditIds)].slice(0, 200)
  const detailsById =
    uniqueReleased.length > 0
      ? await fetchMpPaymentDetailsForIds(uniqueReleased, accessToken)
      : new Map()

  let releasedCredits = 0
  let pendingCredits = 0
  let debits = 0

  for (const { p, type } of classified) {
    if (type === "debit") {
      debits += amountForBalanceLine(p, type)
      continue
    }
    if (p.status !== "approved") continue
    const detail = detailsById.get(p.id)
    const amount = detail ? paymentNetReceivedFromDetail(detail) : amountForBalanceLine(p, "credit")
    if (p.money_release_status === "released") {
      releasedCredits += amount
    } else {
      pendingCredits += amount
    }
  }

  const availableBalance = releasedCredits - debits
  const unavailableBalance = pendingCredits

  return {
    balance: {
      availableBalance,
      unavailableBalance,
      totalAmount: availableBalance + unavailableBalance,
      currencyId,
    },
    windowSinceIso: sinceIso,
    itemsScanned: rows.length,
    releasedCredits,
    pendingCredits,
    debits,
    pagesFetched,
  }
}
