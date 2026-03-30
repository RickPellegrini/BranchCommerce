import type {
  FinancialCategory,
  FinancialPeriod,
  FinancialTransaction,
  MonthlyEvolutionPoint,
  TransactionFilters,
} from "@/lib/finance/types";

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string) {
  return parseDate(value).toLocaleDateString("pt-BR");
}

export function filterTransactions(
  transactions: FinancialTransaction[],
  filters: TransactionFilters,
) {
  return transactions.filter((transaction) => {
    if (filters.kind && filters.kind !== "all" && transaction.kind !== filters.kind) {
      return false;
    }

    if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.startDate && transaction.date < filters.startDate) {
      return false;
    }

    if (filters.endDate && transaction.date > filters.endDate) {
      return false;
    }

    return true;
  });
}

export function summarizeTransactions(transactions: FinancialTransaction[]) {
  const income = transactions
    .filter((item) => item.kind === "income")
    .reduce((total, item) => total + item.amount, 0);
  const expense = transactions
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + item.amount, 0);

  return {
    income,
    expense,
    balance: income - expense,
  };
}

export function expensesByCategory(
  transactions: FinancialTransaction[],
  categories: FinancialCategory[],
) {
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, number>();

  transactions
    .filter((item) => item.kind === "expense")
    .forEach((item) => {
      const current = totals.get(item.categoryId) ?? 0;
      totals.set(item.categoryId, current + item.amount);
    });

  return Array.from(totals.entries())
    .map(([categoryId, total]) => ({
      categoryId,
      categoryName: categoryMap.get(categoryId) ?? "Sem categoria",
      total,
    }))
    .sort((a, b) => b.total - a.total);
}

export function monthlyEvolution(
  transactions: FinancialTransaction[],
  monthsToShow = 6,
): MonthlyEvolutionPoint[] {
  const now = new Date();
  const keys: string[] = [];
  const map = new Map<string, { income: number; expense: number }>();

  for (let index = monthsToShow - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
    map.set(key, { income: 0, expense: 0 });
  }

  transactions.forEach((item) => {
    const key = item.date.slice(0, 7);
    if (!map.has(key)) {
      return;
    }
    const monthBucket = map.get(key);
    if (!monthBucket) {
      return;
    }
    if (item.kind === "income") {
      monthBucket.income += item.amount;
    } else {
      monthBucket.expense += item.amount;
    }
  });

  return keys.map((key) => {
    const date = parseDate(`${key}-01`);
    const monthBucket = map.get(key) ?? { income: 0, expense: 0 };
    return {
      monthLabel: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      income: monthBucket.income,
      expense: monthBucket.expense,
      result: monthBucket.income - monthBucket.expense,
    };
  });
}

function periodKey(date: Date, period: FinancialPeriod) {
  if (period === "day") {
    return date.toISOString().slice(0, 10);
  }

  if (period === "week") {
    const start = new Date(date);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(date.getDate() + diff);
    return start.toISOString().slice(0, 10);
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function cashFlowByPeriod(
  transactions: FinancialTransaction[],
  period: FinancialPeriod,
) {
  const map = new Map<string, { income: number; expense: number }>();

  transactions.forEach((transaction) => {
    const key = periodKey(parseDate(transaction.date), period);
    const current = map.get(key) ?? { income: 0, expense: 0 };
    if (transaction.kind === "income") {
      current.income += transaction.amount;
    } else {
      current.expense += transaction.amount;
    }
    map.set(key, current);
  });

  return Array.from(map.entries())
    .map(([key, values]) => ({
      label: key,
      income: values.income,
      expense: values.expense,
      net: values.income - values.expense,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
