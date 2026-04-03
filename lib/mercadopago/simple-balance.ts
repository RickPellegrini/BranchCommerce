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

export async function getBalance(
  accessToken: string,
  mlUserId: string,
): Promise<MpBalance> {
  const raw = await mpFetch<MpBalanceResponse>(
    `/users/${mlUserId}/mercadopago_account/balance`,
    accessToken,
  )

  return {
    availableBalance: raw.available_balance,
    unavailableBalance: raw.unavailable_balance,
    totalAmount: raw.total_amount,
    currencyId: raw.currency_id,
  }
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
