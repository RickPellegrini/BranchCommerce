import { mpFetch } from "./http"

export type FutureRelease = {
  sourceId: string
  releaseDate: string
  amount: number
  grossAmount: number
}

export type DayGroup = {
  date: string
  dayLabel: string
  total: number
  grossTotal: number
  releases: FutureRelease[]
}

type MpPaymentSearch = {
  id: number
  money_release_date: string | null
  money_release_status: string
  status: string
  transaction_amount: number
}

export type MpPaymentDetail = {
  id: number
  transaction_amount: number
  net_received_amount: number
  transaction_details?: { net_received_amount: number }
  money_release_date: string | null
  fee_details: Array<{ type: string; amount: number; fee_payer: string }> | null
}

type MpSearchResponse = {
  paging: { total: number; offset: number; limit: number }
  results: MpPaymentSearch[]
}

const DAY_NAMES: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
}

function localDate(iso: string): string {
  return iso.slice(0, 10)
}

function buildDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAY_NAMES[dt.getDay()] ?? ""}, ${d}`
}

function getNetAmount(p: MpPaymentDetail): number {
  const fromDetails = p.transaction_details?.net_received_amount
  if (fromDetails && fromDetails > 0) return fromDetails
  if (p.net_received_amount > 0) return p.net_received_amount

  if (p.fee_details && p.fee_details.length > 0) {
    const fees = p.fee_details
      .filter((f) => f.fee_payer === "collector")
      .reduce((s, f) => s + f.amount, 0)
    return p.transaction_amount - fees
  }

  return p.transaction_amount
}

async function fetchPaymentsBatch(
  ids: number[],
  accessToken: string,
  batchSize = 15,
): Promise<Map<number, MpPaymentDetail>> {
  const result = new Map<number, MpPaymentDetail>()
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const details = await Promise.all(
      batch.map((id) =>
        mpFetch<MpPaymentDetail>(`/v1/payments/${id}`, accessToken).catch((err) => {
          console.warn(`[release] Falha ao buscar payment ${id}:`, err)
          return null
        }),
      ),
    )
    for (const d of details) {
      if (d) result.set(d.id, d)
    }
  }
  return result
}

/** GET /v1/payments/:id em lote — o search nao traz net_received_amount confiavel. */
export async function fetchMpPaymentDetailsForIds(
  ids: number[],
  accessToken: string,
): Promise<Map<number, MpPaymentDetail>> {
  return fetchPaymentsBatch(ids, accessToken)
}

export function paymentNetReceivedFromDetail(p: MpPaymentDetail): number {
  return getNetAmount(p)
}

export async function getFutureReleases(accessToken: string): Promise<DayGroup[]> {
  console.log("[release] Buscando pagamentos aprovados...")

  const allPayments: MpPaymentSearch[] = []
  let offset = 0

  while (true) {
    const res = await mpFetch<MpSearchResponse>(
      `/v1/payments/search?status=approved&sort=money_release_date&criteria=asc&limit=100&offset=${offset}`,
      accessToken,
    )
    allPayments.push(...res.results)
    console.log(`[release] offset=${offset}: ${res.results.length} (total=${res.paging.total})`)
    if (offset + res.results.length >= res.paging.total || res.results.length === 0) break
    offset += 100
    if (offset >= 500) break
  }

  const nowTimestamp = Date.now()

  const pending = allPayments.filter((p) => {
    if (!p.money_release_date) return false
    if (p.money_release_status === "released") return false
    const releaseTimestamp = new Date(p.money_release_date).getTime()
    if (!Number.isFinite(releaseTimestamp)) return false
    return releaseTimestamp > nowTimestamp
  })

  console.log(`[release] ${pending.length} pagamentos pendentes. Buscando detalhes individuais...`)

  const details = await fetchPaymentsBatch(
    pending.map((p) => p.id),
    accessToken,
  )

  console.log(`[release] ${details.size} detalhes obtidos.`)

  const byDay = new Map<string, FutureRelease[]>()

  for (const p of pending) {
    const detail = details.get(p.id)
    const releaseDate = p.money_release_date!
    const dateKey = localDate(releaseDate)
    const netAmount = detail ? getNetAmount(detail) : p.transaction_amount
    const gross = detail ? detail.transaction_amount : p.transaction_amount

    const list = byDay.get(dateKey) ?? []
    list.push({ sourceId: String(p.id), releaseDate, amount: netAmount, grossAmount: gross })
    byDay.set(dateKey, list)
  }

  const groups: DayGroup[] = []
  for (const [date, releases] of byDay.entries()) {
    releases.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    groups.push({
      date,
      dayLabel: buildDayLabel(date),
      total: releases.reduce((s, r) => s + r.amount, 0),
      grossTotal: releases.reduce((s, r) => s + r.grossAmount, 0),
      releases,
    })
  }

  groups.sort((a, b) => a.date.localeCompare(b.date))

  for (const g of groups) {
    console.log(`[release] ${g.dayLabel}: ${g.releases.length} lib = R$ ${g.total.toFixed(2)}`)
  }

  return groups
}
