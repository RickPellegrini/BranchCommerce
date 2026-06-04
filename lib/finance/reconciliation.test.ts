import { describe, expect, it } from "vitest"
import { buildFinancialReconciliation } from "./reconciliation"

const base = {
  periodsAligned: true,
  filterPeriodLabel: "jun/26",
  drePeriodLabel: "jun/26",
  revenueFromOrders: 180,
  dreRevenue: 180,
  dreGrossProfit: 50,
  dreNetProfit: 30,
  ordersNetProfit: 50,
  abcRevenueTotal: 180,
  abcProfitTotal: 50,
  filterExpensesAll: 20,
  dreOperationalExpenses: 15,
  dreFixedCosts: 5,
  dreIncludeMovements: true,
}

describe("buildFinancialReconciliation", () => {
  it("returns ok when aligned metrics match", () => {
    const result = buildFinancialReconciliation(base)
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it("flags period mismatch", () => {
    const result = buildFinancialReconciliation({
      ...base,
      periodsAligned: false,
      drePeriodLabel: "mai/26",
    })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === "period_mismatch")).toBe(true)
  })

  it("flags revenue drift between ABC and orders", () => {
    const result = buildFinancialReconciliation({
      ...base,
      abcRevenueTotal: 200,
    })
    expect(result.issues.some((i) => i.code === "revenue_abc_orders")).toBe(true)
  })
})
