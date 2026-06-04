const TOLERANCE = 0.02

export type FinancialReconciliationInput = {
  periodsAligned: boolean
  filterPeriodLabel: string
  drePeriodLabel: string
  revenueFromOrders: number
  dreRevenue: number
  dreGrossProfit: number
  dreNetProfit: number
  ordersNetProfit: number
  abcRevenueTotal: number
  abcProfitTotal: number
  filterExpensesAll: number
  dreOperationalExpenses: number
  dreFixedCosts: number
  commerceFlowSales?: number
  evolutionIncomeForPeriod?: number
  dreIncludeMovements: boolean
}

export type FinancialReconciliationIssue = {
  code: string
  message: string
}

export function buildFinancialReconciliation(input: FinancialReconciliationInput): {
  ok: boolean
  issues: FinancialReconciliationIssue[]
} {
  const issues: FinancialReconciliationIssue[] = []

  if (!input.periodsAligned) {
    issues.push({
      code: "period_mismatch",
      message: `Periodo do filtro (${input.filterPeriodLabel}) e da DRE (${input.drePeriodLabel}) sao diferentes. Alinhe as datas ou compare o mesmo mes em cada tela.`,
    })
    return { ok: false, issues }
  }

  if (input.revenueFromOrders > 0 || input.dreRevenue > 0) {
    if (Math.abs(input.revenueFromOrders - input.dreRevenue) > TOLERANCE) {
      issues.push({
        code: "revenue_orders_dre",
        message: `Vendas brutas: pedidos ML ${fmt(input.revenueFromOrders)} vs DRE ${fmt(input.dreRevenue)}.`,
      })
    }
  }

  if (input.abcRevenueTotal > 0 && input.revenueFromOrders > 0) {
    if (Math.abs(input.abcRevenueTotal - input.revenueFromOrders) > TOLERANCE) {
      issues.push({
        code: "revenue_abc_orders",
        message: `Receita ABC somada ${fmt(input.abcRevenueTotal)} vs vendas ML ${fmt(input.revenueFromOrders)}.`,
      })
    }
  }

  if (
    input.commerceFlowSales != null &&
    input.revenueFromOrders > 0 &&
    Math.abs(input.commerceFlowSales - input.revenueFromOrders) > TOLERANCE
  ) {
    issues.push({
      code: "revenue_flow_orders",
      message: `Vendas no fluxo de caixa ${fmt(input.commerceFlowSales)} vs pedidos ML ${fmt(input.revenueFromOrders)}.`,
    })
  }

  if (
    input.evolutionIncomeForPeriod != null &&
    input.revenueFromOrders > 0 &&
    input.evolutionIncomeForPeriod + TOLERANCE < input.revenueFromOrders
  ) {
    issues.push({
      code: "revenue_evolution_low",
      message: `Entradas na evolucao mensal ${fmt(input.evolutionIncomeForPeriod)} estao abaixo das vendas ML ${fmt(input.revenueFromOrders)} no mesmo mes.`,
    })
  }

  if (input.ordersNetProfit !== 0 || input.dreGrossProfit !== 0) {
    if (Math.abs(input.ordersNetProfit - input.dreGrossProfit) > TOLERANCE) {
      issues.push({
        code: "profit_orders_dre_gross",
        message: `Lucro operacional ML ${fmt(input.ordersNetProfit)} vs lucro bruto DRE ${fmt(input.dreGrossProfit)} (CMV, taxas, frete e Centralize devem coincidir).`,
      })
    }
  }

  if (input.dreIncludeMovements) {
    const dreManualCosts = input.dreOperationalExpenses + input.dreFixedCosts
    if (
      input.filterExpensesAll > 0 &&
      Math.abs(dreManualCosts - input.filterExpensesAll) > TOLERANCE
    ) {
      issues.push({
        code: "expenses_filter_dre",
        message: `Despesas no filtro ${fmt(input.filterExpensesAll)} vs DRE operacional+fixo ${fmt(dreManualCosts)} (parcelas pendentes entram na DRE mas nao no fluxo manual).`,
      })
    }

    const expectedNet = input.dreGrossProfit - input.dreOperationalExpenses - input.dreFixedCosts
    if (Math.abs(expectedNet - input.dreNetProfit) > TOLERANCE) {
      issues.push({
        code: "dre_net_internal",
        message: `Lucro liquido DRE ${fmt(input.dreNetProfit)} nao fecha com bruto menos despesas (${fmt(expectedNet)}).`,
      })
    }
  }

  return { ok: issues.length === 0, issues }
}

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value)
}
