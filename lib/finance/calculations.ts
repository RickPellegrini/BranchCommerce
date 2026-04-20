import type {
  FinancialCategory,
  FinancialPeriod,
  FinancialTransaction,
  MonthlyEvolutionPoint,
  TransactionFilters,
} from "@/lib/finance/types"

type StockInsightProduct = {
  id: string
  name: string
  unitCost: number
  sellingPrice?: number
}

type StockInsightMovement = {
  productId: string
  type: "in" | "out" | "adjustment" | "sale"
  quantity: number
  unitPrice?: number
  date: string
}

export type ProductChampionPoint = {
  productId: string
  productName: string
  unitsSold: number
  revenue: number
  cogs: number
  profit: number
  marginPercent: number
}

export type CostBreakdown = {
  operationalCost: number
  fixedCost: number
  variableCost: number
  toolsFixedCost: number
}

export type ForecastPoint = {
  monthLabel: string
  incomeForecast: number
  expenseForecast: number
  profitForecast: number
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(value: string) {
  return parseDate(value).toLocaleDateString("pt-BR")
}

export function filterTransactions(
  transactions: FinancialTransaction[],
  filters: TransactionFilters,
) {
  return transactions.filter((transaction) => {
    if (filters.kind && filters.kind !== "all" && transaction.kind !== filters.kind) {
      return false
    }

    if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
      return false
    }

    if (filters.startDate && transaction.date < filters.startDate) {
      return false
    }

    if (filters.endDate && transaction.date > filters.endDate) {
      return false
    }

    return true
  })
}

export function summarizeTransactions(transactions: FinancialTransaction[]) {
  const income = transactions
    .filter((item) => item.kind === "income")
    .reduce((total, item) => total + item.amount, 0)
  const expense = transactions
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + item.amount, 0)

  return {
    income,
    expense,
    balance: income - expense,
  }
}

export function expensesByCategory(
  transactions: FinancialTransaction[],
  categories: FinancialCategory[],
) {
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const totals = new Map<string, number>()

  transactions
    .filter((item) => item.kind === "expense")
    .forEach((item) => {
      const current = totals.get(item.categoryId) ?? 0
      totals.set(item.categoryId, current + item.amount)
    })

  return Array.from(totals.entries())
    .map(([categoryId, total]) => ({
      categoryId,
      categoryName: categoryMap.get(categoryId) ?? "Sem categoria",
      total,
    }))
    .sort((a, b) => b.total - a.total)
}

export function monthlyEvolution(
  transactions: FinancialTransaction[],
  monthsToShow = 6,
): MonthlyEvolutionPoint[] {
  const now = new Date()
  const keys: string[] = []
  const map = new Map<string, { income: number; expense: number }>()

  for (let index = monthsToShow - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    keys.push(key)
    map.set(key, { income: 0, expense: 0 })
  }

  transactions.forEach((item) => {
    const key = item.date.slice(0, 7)
    if (!map.has(key)) {
      return
    }
    const monthBucket = map.get(key)
    if (!monthBucket) {
      return
    }
    if (item.kind === "income") {
      monthBucket.income += item.amount
    } else {
      monthBucket.expense += item.amount
    }
  })

  return keys.map((key) => {
    const date = parseDate(`${key}-01`)
    const monthBucket = map.get(key) ?? { income: 0, expense: 0 }
    return {
      monthLabel: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      income: monthBucket.income,
      expense: monthBucket.expense,
      result: monthBucket.income - monthBucket.expense,
    }
  })
}

function periodKey(date: Date, period: FinancialPeriod) {
  if (period === "day") {
    return date.toISOString().slice(0, 10)
  }

  if (period === "week") {
    const start = new Date(date)
    const day = date.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(date.getDate() + diff)
    return start.toISOString().slice(0, 10)
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function cashFlowByPeriod(transactions: FinancialTransaction[], period: FinancialPeriod) {
  const map = new Map<string, { income: number; expense: number }>()

  transactions.forEach((transaction) => {
    const key = periodKey(parseDate(transaction.date), period)
    const current = map.get(key) ?? { income: 0, expense: 0 }
    if (transaction.kind === "income") {
      current.income += transaction.amount
    } else {
      current.expense += transaction.amount
    }
    map.set(key, current)
  })

  return Array.from(map.entries())
    .map(([key, values]) => ({
      label: key,
      income: values.income,
      expense: values.expense,
      net: values.income - values.expense,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function calculateCostBreakdown(
  transactions: FinancialTransaction[],
  categories: FinancialCategory[],
): CostBreakdown {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))

  return transactions
    .filter((transaction) => transaction.kind === "expense")
    .reduce<CostBreakdown>(
      (acc, transaction) => {
        const isFixed = transaction.expenseType === "fixed"
        const categoryName = categoryMap.get(transaction.categoryId)?.name.toLowerCase() ?? ""
        const isTools = categoryName.includes("ferrament")

        acc.operationalCost += transaction.amount
        if (isFixed) {
          acc.fixedCost += transaction.amount
          if (isTools) {
            acc.toolsFixedCost += transaction.amount
          }
        } else {
          acc.variableCost += transaction.amount
        }
        return acc
      },
      { operationalCost: 0, fixedCost: 0, variableCost: 0, toolsFixedCost: 0 },
    )
}

export function calculateProductChampions(
  products: StockInsightProduct[],
  movements: StockInsightMovement[],
  topN = 5,
): ProductChampionPoint[] {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const aggregateMap = new Map<
    string,
    { productName: string; unitsSold: number; revenue: number; cogs: number }
  >()

  movements
    .filter((movement) => movement.type === "sale" && movement.quantity > 0)
    .forEach((movement) => {
      const product = productMap.get(movement.productId)
      if (!product) return

      const revenuePerUnit = movement.unitPrice ?? product.sellingPrice ?? 0
      const cogsPerUnit = product.unitCost
      const current = aggregateMap.get(product.id) ?? {
        productName: product.name,
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
      }

      current.unitsSold += movement.quantity
      current.revenue += revenuePerUnit * movement.quantity
      current.cogs += cogsPerUnit * movement.quantity

      aggregateMap.set(product.id, current)
    })

  return Array.from(aggregateMap.entries())
    .map(([productId, aggregate]) => {
      const profit = aggregate.revenue - aggregate.cogs
      const marginPercent = aggregate.revenue > 0 ? (profit / aggregate.revenue) * 100 : 0
      return {
        productId,
        productName: aggregate.productName,
        unitsSold: aggregate.unitsSold,
        revenue: aggregate.revenue,
        cogs: aggregate.cogs,
        profit,
        marginPercent,
      }
    })
    .filter((row) => row.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, topN)
}

export function forecastFinancialTrend(
  transactions: FinancialTransaction[],
  monthsAhead = 4,
  monthsLookback = 6,
): ForecastPoint[] {
  const history = monthlyEvolution(transactions, monthsLookback)
  if (history.length === 0) return []

  const incomeAvg = history.reduce((sum, point) => sum + point.income, 0) / history.length
  const expenseAvg = history.reduce((sum, point) => sum + point.expense, 0) / history.length
  const first = history[0]
  const last = history[history.length - 1]
  const denominator = Math.max(1, history.length - 1)
  const incomeTrendPerMonth = (last.income - first.income) / denominator
  const expenseTrendPerMonth = (last.expense - first.expense) / denominator

  const forecast: ForecastPoint[] = []
  const baseDate = new Date()

  for (let monthOffset = 1; monthOffset <= monthsAhead; monthOffset += 1) {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1)
    const projectedIncome = Math.max(0, incomeAvg + incomeTrendPerMonth * monthOffset)
    const projectedExpense = Math.max(0, expenseAvg + expenseTrendPerMonth * monthOffset)
    forecast.push({
      monthLabel: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      incomeForecast: projectedIncome,
      expenseForecast: projectedExpense,
      profitForecast: projectedIncome - projectedExpense,
    })
  }

  return forecast
}
