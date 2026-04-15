import { describe, expect, it } from "vitest"

import { paymentNetReceivedFromDetail } from "./future-releases"
import type { MpPaymentDetail } from "./future-releases"

function detail(overrides: Partial<MpPaymentDetail> = {}): MpPaymentDetail {
  return {
    id: 1,
    transaction_amount: 100,
    net_received_amount: 0,
    money_release_date: "2025-06-20T10:00:00Z",
    fee_details: null,
    ...overrides,
  }
}

describe("paymentNetReceivedFromDetail (getNetAmount)", () => {
  it("prefers transaction_details.net_received_amount", () => {
    const d = detail({
      transaction_amount: 100,
      net_received_amount: 85,
      transaction_details: { net_received_amount: 90 },
    })
    expect(paymentNetReceivedFromDetail(d)).toBe(90)
  })

  it("falls back to net_received_amount", () => {
    const d = detail({
      transaction_amount: 100,
      net_received_amount: 88,
      transaction_details: undefined,
    })
    expect(paymentNetReceivedFromDetail(d)).toBe(88)
  })

  it("calculates from fee_details when no net amounts", () => {
    const d = detail({
      transaction_amount: 100,
      net_received_amount: 0,
      transaction_details: undefined,
      fee_details: [
        { type: "mercadopago_fee", amount: 5, fee_payer: "collector" },
        { type: "financing_fee", amount: 3, fee_payer: "collector" },
      ],
    })
    expect(paymentNetReceivedFromDetail(d)).toBe(92)
  })

  it("ignores fees not paid by collector", () => {
    const d = detail({
      transaction_amount: 100,
      net_received_amount: 0,
      transaction_details: undefined,
      fee_details: [
        { type: "mercadopago_fee", amount: 5, fee_payer: "collector" },
        { type: "buyer_fee", amount: 10, fee_payer: "payer" },
      ],
    })
    expect(paymentNetReceivedFromDetail(d)).toBe(95)
  })

  it("returns transaction_amount as last fallback", () => {
    const d = detail({
      transaction_amount: 200,
      net_received_amount: 0,
      transaction_details: undefined,
      fee_details: null,
    })
    expect(paymentNetReceivedFromDetail(d)).toBe(200)
  })

  it("returns transaction_amount for empty fee_details", () => {
    const d = detail({
      transaction_amount: 150,
      net_received_amount: 0,
      transaction_details: undefined,
      fee_details: [],
    })
    expect(paymentNetReceivedFromDetail(d)).toBe(150)
  })

  it("skips transaction_details when value is 0", () => {
    const d = detail({
      transaction_amount: 100,
      net_received_amount: 80,
      transaction_details: { net_received_amount: 0 },
    })
    expect(paymentNetReceivedFromDetail(d)).toBe(80)
  })
})
