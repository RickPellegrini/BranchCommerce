import { describe, expect, it, vi } from "vitest"

/**
 * classifyMpTransactionType and amountForBalanceLine are not exported.
 * We test them indirectly via getTransactions, or we test the exported
 * getTransactions function with mocked mpFetch and fetchMpPaymentDetailsForIds.
 *
 * For thorough unit testing of the classification logic we re-implement
 * a local copy of the classifier by importing the module internals through
 * a dynamic re-export approach. Since the functions are private, we use
 * a test-focused strategy: import the whole module source via vitest's
 * module execution and test through getTransactions with controlled inputs.
 */

// We need to make these private functions testable.
// The cleanest approach: we test via the exported getTransactions with mocks.

vi.mock("./http", () => ({
  MP_API: "https://api.mercadopago.com",
  mpFetch: vi.fn(),
}))

vi.mock("./future-releases", () => ({
  fetchMpPaymentDetailsForIds: vi.fn().mockResolvedValue(new Map()),
  paymentNetReceivedFromDetail: vi.fn((d: { transaction_amount: number }) => d.transaction_amount),
}))

import { fetchMpPaymentDetailsForIds } from "./future-releases"
import { mpFetch } from "./http"
import { getTransactions } from "./simple-balance"

type PaymentRow = {
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
  payer?: { id?: number }
  collector?: { id?: number }
}

function payment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 1,
    date_created: "2025-06-15T10:00:00Z",
    description: "Test payment",
    transaction_amount: 100,
    net_received_amount: 90,
    fee_details: [],
    status: "approved",
    status_detail: "accredited",
    operation_type: "regular_payment",
    payment_type_id: "credit_card",
    ...overrides,
  }
}

describe("getTransactions (classifyMpTransactionType + amountForBalanceLine)", () => {
  const accountUserId = "12345"

  it("classifies as credit when user is collector and status is approved", async () => {
    const p = payment({ collector: { id: 12345 }, payer: { id: 99999 } })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("credit")
  })

  it("classifies as debit when user is payer and not collector", async () => {
    const p = payment({ payer: { id: 12345 }, collector: { id: 99999 } })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("debit")
  })

  it("classifies as debit for money_transfer when user is payer", async () => {
    const p = payment({
      payer: { id: 12345 },
      collector: undefined,
      operation_type: "money_transfer",
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("debit")
  })

  it("classifies regular_payment as credit when approved (no payer/collector match)", async () => {
    const p = payment({
      payer: { id: 77777 },
      collector: { id: 88888 },
      operation_type: "regular_payment",
      status: "approved",
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("credit")
  })

  it("classifies payout as debit regardless", async () => {
    const p = payment({
      payer: { id: 77777 },
      collector: { id: 88888 },
      operation_type: "payout",
      status: "approved",
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("debit")
  })

  it("uses transaction_amount for debit", async () => {
    const p = payment({
      payer: { id: 12345 },
      collector: { id: 99999 },
      transaction_amount: 200,
      net_received_amount: 180,
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].amount).toBe(200)
  })

  it("uses net_received_amount for credit via fallback", async () => {
    const p = payment({
      collector: { id: 12345 },
      payer: { id: 99999 },
      transaction_amount: 100,
      net_received_amount: 90,
      transaction_details: undefined,
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })
    vi.mocked(fetchMpPaymentDetailsForIds).mockResolvedValue(new Map())

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].amount).toBe(90)
  })

  it("uses transaction_details.net_received_amount when available", async () => {
    const p = payment({
      collector: { id: 12345 },
      payer: { id: 99999 },
      transaction_amount: 100,
      net_received_amount: 85,
      transaction_details: { net_received_amount: 88 },
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })
    vi.mocked(fetchMpPaymentDetailsForIds).mockResolvedValue(new Map())

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].amount).toBe(88)
  })

  it("falls back to fee_details calculation for credit", async () => {
    const p = payment({
      collector: { id: 12345 },
      payer: { id: 99999 },
      transaction_amount: 100,
      net_received_amount: 0,
      transaction_details: undefined,
      fee_details: [{ type: "mercadopago_fee", amount: 8, fee_payer: "collector" }],
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })
    vi.mocked(fetchMpPaymentDetailsForIds).mockResolvedValue(new Map())

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].amount).toBe(92)
  })

  it("returns correct structure", async () => {
    const p = payment({ id: 42, collector: { id: 12345 }, payer: { id: 99 } })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0]).toMatchObject({
      id: "42",
      date: "2025-06-15T10:00:00Z",
      description: "Test payment",
      status: "approved",
      type: "credit",
    })
  })

  it("non-approved collector transaction is debit", async () => {
    const p = payment({
      collector: { id: 12345 },
      payer: { id: 99999 },
      status: "rejected",
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("debit")
  })

  it("refund is classified as debit even when user is collector", async () => {
    // Refund: dinheiro volta pro comprador, sai do saldo do vendedor.
    const p = payment({
      collector: { id: 12345 },
      payer: { id: 99999 },
      operation_type: "refund",
      status: "approved",
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("debit")
  })

  it("chargeback is classified as debit", async () => {
    const p = payment({
      collector: { id: 12345 },
      payer: { id: 99999 },
      operation_type: "chargeback",
      status: "approved",
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("debit")
  })

  it("reservation_release is classified as credit when user is collector", async () => {
    // Liberacao de reserva: dinheiro previamente bloqueado vira saldo livre.
    const p = payment({
      collector: { id: 12345 },
      payer: { id: 99999 },
      operation_type: "reservation_release",
      status: "approved",
    })
    vi.mocked(mpFetch).mockResolvedValue({ paging: { total: 1 }, results: [p] })

    const result = await getTransactions("token", accountUserId, 10)
    expect(result[0].type).toBe("credit")
  })
})

describe("getTransactionsWindow summary", () => {
  it("aggregates totals correctly", async () => {
    const accountUserId = "12345"
    const todayIso = new Date().toISOString()
    const credit1 = payment({
      id: 1,
      date_created: todayIso,
      collector: { id: 12345 },
      payer: { id: 999 },
      transaction_amount: 100,
      transaction_details: { net_received_amount: 90 },
    })
    const credit2 = payment({
      id: 2,
      date_created: todayIso,
      collector: { id: 12345 },
      payer: { id: 999 },
      transaction_amount: 50,
      transaction_details: { net_received_amount: 45 },
    })
    const debitRefund = payment({
      id: 3,
      date_created: todayIso,
      collector: { id: 12345 },
      payer: { id: 999 },
      operation_type: "refund",
      transaction_amount: 20,
    })

    vi.mocked(mpFetch).mockResolvedValue({
      paging: { total: 3, offset: 0, limit: 50 },
      results: [credit1, credit2, debitRefund],
    })
    vi.mocked(fetchMpPaymentDetailsForIds).mockResolvedValue(new Map())

    const { getTransactionsWindow } = await import("./simple-balance")
    const result = await getTransactionsWindow("token", accountUserId, {
      maxItems: 100,
      windowDays: 180,
    })

    expect(result.totalCredits).toBe(90 + 45)
    expect(result.totalDebits).toBe(20)
    expect(result.transactions).toHaveLength(3)
  })
})
