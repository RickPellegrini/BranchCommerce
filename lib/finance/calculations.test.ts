import { describe, expect, it } from "vitest"

import type { FinancialCategory, FinancialTransaction } from "@/lib/finance/types"

import {
  calculateCostBreakdown,
  calculateProductChampions,
  cashFlowByPeriod,
  expensesByCategory,
  filterTransactions,
  forecastFinancialTrend,
  formatCurrency,
  formatDate,
  monthlyEvolution,
  summarizeTransactions,
} from "./calculations"

function tx(
  overrides: Partial<FinancialTransaction> & { kind: "income" | "expense" },
): FinancialTransaction {
  return {
    id: "t1",
    amount: 100,
    date: "2025-06-15",
    description: "test",
    categoryId: "cat1",
    ...overrides,
  }
}

// ── formatCurrency ──────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats positive value as BRL", () => {
    const result = formatCurrency(1234.5)
    expect(result).toContain("1.234,50")
    expect(result).toContain("R$")
  })

  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("0,00")
  })

  it("formats negative value", () => {
    const result = formatCurrency(-50)
    expect(result).toContain("50,00")
  })

  it("rounds to 2 decimal places", () => {
    const result = formatCurrency(9.999)
    expect(result).toContain("10,00")
  })
})

// ── formatDate ──────────────────────────────────────────────────────

describe("formatDate", () => {
  it("converts YYYY-MM-DD to pt-BR format", () => {
    expect(formatDate("2025-01-05")).toBe("05/01/2025")
  })

  it("handles month and day boundaries", () => {
    expect(formatDate("2025-12-31")).toBe("31/12/2025")
  })
})

// ── filterTransactions ──────────────────────────────────────────────

describe("filterTransactions", () => {
  const transactions: FinancialTransaction[] = [
    tx({ id: "1", kind: "income", date: "2025-03-01", categoryId: "catA" }),
    tx({ id: "2", kind: "expense", date: "2025-04-15", categoryId: "catB" }),
    tx({ id: "3", kind: "income", date: "2025-05-20", categoryId: "catA" }),
  ]

  it("returns all when no filters applied", () => {
    expect(filterTransactions(transactions, {})).toHaveLength(3)
  })

  it("filters by kind", () => {
    expect(filterTransactions(transactions, { kind: "income" })).toHaveLength(2)
    expect(filterTransactions(transactions, { kind: "expense" })).toHaveLength(1)
  })

  it("kind=all returns everything", () => {
    expect(filterTransactions(transactions, { kind: "all" })).toHaveLength(3)
  })

  it("filters by categoryId", () => {
    expect(filterTransactions(transactions, { categoryId: "catA" })).toHaveLength(2)
    expect(filterTransactions(transactions, { categoryId: "catB" })).toHaveLength(1)
  })

  it("filters by date range", () => {
    const result = filterTransactions(transactions, {
      startDate: "2025-04-01",
      endDate: "2025-04-30",
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("2")
  })

  it("combines multiple filters", () => {
    const result = filterTransactions(transactions, {
      kind: "income",
      startDate: "2025-04-01",
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("3")
  })
})

// ── summarizeTransactions ───────────────────────────────────────────

describe("summarizeTransactions", () => {
  it("sums income, expense, and computes balance", () => {
    const transactions = [
      tx({ kind: "income", amount: 500 }),
      tx({ kind: "income", amount: 300 }),
      tx({ kind: "expense", amount: 200 }),
    ]
    const summary = summarizeTransactions(transactions)
    expect(summary.income).toBe(800)
    expect(summary.expense).toBe(200)
    expect(summary.balance).toBe(600)
  })

  it("returns zeros for empty list", () => {
    const summary = summarizeTransactions([])
    expect(summary).toEqual({ income: 0, expense: 0, balance: 0 })
  })
})

// ── expensesByCategory ──────────────────────────────────────────────

describe("expensesByCategory", () => {
  const categories: FinancialCategory[] = [
    { id: "c1", name: "Operacional", kind: "expense" },
    { id: "c2", name: "Ferramentas", kind: "expense" },
  ]

  it("groups expenses by category sorted desc", () => {
    const transactions = [
      tx({ kind: "expense", categoryId: "c1", amount: 100 }),
      tx({ kind: "expense", categoryId: "c2", amount: 500 }),
      tx({ kind: "expense", categoryId: "c1", amount: 200 }),
    ]
    const result = expensesByCategory(transactions, categories)
    expect(result[0].categoryName).toBe("Ferramentas")
    expect(result[0].total).toBe(500)
    expect(result[1].categoryName).toBe("Operacional")
    expect(result[1].total).toBe(300)
  })

  it("ignores income transactions", () => {
    const transactions = [
      tx({ kind: "income", categoryId: "c1", amount: 1000 }),
      tx({ kind: "expense", categoryId: "c1", amount: 50 }),
    ]
    const result = expensesByCategory(transactions, categories)
    expect(result).toHaveLength(1)
    expect(result[0].total).toBe(50)
  })

  it("labels unknown category as 'Sem categoria'", () => {
    const transactions = [tx({ kind: "expense", categoryId: "unknown", amount: 10 })]
    const result = expensesByCategory(transactions, categories)
    expect(result[0].categoryName).toBe("Sem categoria")
  })
})

// ── monthlyEvolution ────────────────────────────────────────────────

describe("monthlyEvolution", () => {
  it("returns requested number of months", () => {
    const result = monthlyEvolution([], 3)
    expect(result).toHaveLength(3)
  })

  it("accumulates income and expense into correct months", () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const transactions = [
      tx({ kind: "income", amount: 100, date: `${currentMonth}-10` }),
      tx({ kind: "expense", amount: 40, date: `${currentMonth}-15` }),
    ]
    const result = monthlyEvolution(transactions, 1)
    expect(result[0].income).toBe(100)
    expect(result[0].expense).toBe(40)
    expect(result[0].result).toBe(60)
  })

  it("ignores transactions outside the window", () => {
    const transactions = [tx({ kind: "income", amount: 999, date: "2020-01-01" })]
    const result = monthlyEvolution(transactions, 3)
    expect(result.every((m) => m.income === 0)).toBe(true)
  })
})

// ── cashFlowByPeriod ────────────────────────────────────────────────

describe("cashFlowByPeriod", () => {
  it("groups by day", () => {
    const transactions = [
      tx({ kind: "income", amount: 100, date: "2025-06-10" }),
      tx({ kind: "expense", amount: 30, date: "2025-06-10" }),
      tx({ kind: "income", amount: 50, date: "2025-06-11" }),
    ]
    const result = cashFlowByPeriod(transactions, "day")
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe("2025-06-10")
    expect(result[0].income).toBe(100)
    expect(result[0].expense).toBe(30)
    expect(result[0].net).toBe(70)
  })

  it("groups by month", () => {
    const transactions = [
      tx({ kind: "income", amount: 100, date: "2025-06-01" }),
      tx({ kind: "income", amount: 200, date: "2025-06-30" }),
    ]
    const result = cashFlowByPeriod(transactions, "month")
    expect(result).toHaveLength(1)
    expect(result[0].income).toBe(300)
  })

  it("groups by week (Monday-start)", () => {
    // 2025-06-09 is Monday, 2025-06-15 is Sunday
    const transactions = [
      tx({ kind: "income", amount: 100, date: "2025-06-09" }),
      tx({ kind: "income", amount: 50, date: "2025-06-15" }),
      tx({ kind: "income", amount: 200, date: "2025-06-16" }), // next Monday
    ]
    const result = cashFlowByPeriod(transactions, "week")
    expect(result).toHaveLength(2)
    expect(result[0].income).toBe(150) // Mon-Sun
    expect(result[1].income).toBe(200) // next week
  })

  it("sorts by label ascending", () => {
    const transactions = [
      tx({ kind: "income", amount: 1, date: "2025-06-20" }),
      tx({ kind: "income", amount: 1, date: "2025-06-01" }),
    ]
    const result = cashFlowByPeriod(transactions, "day")
    expect(result[0].label).toBe("2025-06-01")
    expect(result[1].label).toBe("2025-06-20")
  })
})

// ── calculateCostBreakdown ──────────────────────────────────────────

describe("calculateCostBreakdown", () => {
  const categories: FinancialCategory[] = [
    { id: "c1", name: "Operacional", kind: "expense" },
    { id: "c2", name: "Ferramentas e Software", kind: "expense" },
    { id: "c3", name: "Vendas", kind: "income" },
  ]

  it("separates fixed, variable, and tools costs", () => {
    const transactions = [
      tx({ kind: "expense", amount: 100, categoryId: "c1", expenseType: "fixed" }),
      tx({ kind: "expense", amount: 50, categoryId: "c2", expenseType: "fixed" }),
      tx({ kind: "expense", amount: 200, categoryId: "c1", expenseType: "variable" }),
    ]
    const result = calculateCostBreakdown(transactions, categories)
    expect(result.operationalCost).toBe(350)
    expect(result.fixedCost).toBe(150)
    expect(result.variableCost).toBe(200)
    expect(result.toolsFixedCost).toBe(50)
  })

  it("ignores income transactions", () => {
    const transactions = [
      tx({ kind: "income", amount: 1000, categoryId: "c3" }),
      tx({ kind: "expense", amount: 10, categoryId: "c1" }),
    ]
    const result = calculateCostBreakdown(transactions, categories)
    expect(result.operationalCost).toBe(10)
  })
})

// ── calculateProductChampions ───────────────────────────────────────

describe("calculateProductChampions", () => {
  const products = [
    { id: "p1", name: "Widget A", unitCost: 10, sellingPrice: 50 },
    { id: "p2", name: "Widget B", unitCost: 20, sellingPrice: 40 },
  ]

  it("computes champions from sale movements", () => {
    const movements = [
      { productId: "p1", type: "sale" as const, quantity: 5, date: "2025-06-01" },
      { productId: "p2", type: "sale" as const, quantity: 3, date: "2025-06-01" },
    ]
    const result = calculateProductChampions(products, movements)
    expect(result[0].productId).toBe("p1")
    expect(result[0].revenue).toBe(250)
    expect(result[0].cogs).toBe(50)
    expect(result[0].profit).toBe(200)
  })

  it("ignores non-sale movements", () => {
    const movements = [
      { productId: "p1", type: "in" as const, quantity: 10, date: "2025-06-01" },
      { productId: "p1", type: "sale" as const, quantity: 1, date: "2025-06-01" },
    ]
    const result = calculateProductChampions(products, movements)
    expect(result).toHaveLength(1)
    expect(result[0].unitsSold).toBe(1)
  })

  it("filters out products with profit <= 0", () => {
    const lossProducts = [{ id: "p1", name: "Loss", unitCost: 100, sellingPrice: 50 }]
    const movements = [{ productId: "p1", type: "sale" as const, quantity: 1, date: "2025-06-01" }]
    const result = calculateProductChampions(lossProducts, movements)
    expect(result).toHaveLength(0)
  })

  it("respects topN limit", () => {
    const manyProducts = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      name: `Prod ${i}`,
      unitCost: 1,
      sellingPrice: 100,
    }))
    const movements = manyProducts.map((p) => ({
      productId: p.id,
      type: "sale" as const,
      quantity: 1,
      date: "2025-06-01",
    }))
    const result = calculateProductChampions(manyProducts, movements, 3)
    expect(result).toHaveLength(3)
  })

  it("uses unitPrice from movement when available", () => {
    const movements = [
      { productId: "p1", type: "sale" as const, quantity: 2, unitPrice: 80, date: "2025-06-01" },
    ]
    const result = calculateProductChampions(products, movements)
    expect(result[0].revenue).toBe(160)
  })
})

// ── forecastFinancialTrend ──────────────────────────────────────────

describe("forecastFinancialTrend", () => {
  it("returns forecast even with no transactions (zero values)", () => {
    const result = forecastFinancialTrend([], 4, 6)
    expect(result).toHaveLength(4)
    result.forEach((point) => {
      expect(point.incomeForecast).toBe(0)
      expect(point.expenseForecast).toBe(0)
      expect(point.profitForecast).toBe(0)
    })
  })

  it("returns requested months ahead", () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const transactions = [tx({ kind: "income", amount: 1000, date: `${currentMonth}-01` })]
    const result = forecastFinancialTrend(transactions, 3, 1)
    expect(result).toHaveLength(3)
  })

  it("forecast income and expense are non-negative", () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const transactions = [
      tx({ kind: "income", amount: 100, date: `${currentMonth}-01` }),
      tx({ kind: "expense", amount: 50, date: `${currentMonth}-01` }),
    ]
    const result = forecastFinancialTrend(transactions, 2, 1)
    result.forEach((point) => {
      expect(point.incomeForecast).toBeGreaterThanOrEqual(0)
      expect(point.expenseForecast).toBeGreaterThanOrEqual(0)
    })
  })
})
