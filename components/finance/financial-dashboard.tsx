"use client";

import { UserButton } from "@clerk/nextjs";
import { BarChart3, Landmark, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  cashFlowByPeriod,
  expensesByCategory,
  filterTransactions,
  formatCurrency,
  formatDate,
  monthlyEvolution,
  summarizeTransactions,
} from "@/lib/finance/calculations";
import { initialBills, initialCategories, initialTransactions } from "@/lib/finance/mock-data";
import type {
  BillStatus,
  ExpenseType,
  FinancialBill,
  FinancialCategory,
  FinancialPeriod,
  FinancialTransaction,
  TransactionFilters,
} from "@/lib/finance/types";
import { cn } from "@/lib/utils";

const today = new Date().toISOString().slice(0, 10);

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function statusBadgeVariant(status: BillStatus): "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  return "danger";
}

export function FinancialDashboard() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(initialTransactions);
  const [categories, setCategories] = useState<FinancialCategory[]>(initialCategories);
  const [bills, setBills] = useState<FinancialBill[]>(initialBills);
  const [period, setPeriod] = useState<FinancialPeriod>("month");
  const [filters, setFilters] = useState<TransactionFilters>({ kind: "all" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [incomeForm, setIncomeForm] = useState({
    amount: "",
    date: today,
    description: "",
    categoryId: initialCategories.find((item) => item.kind === "income")?.id ?? "",
    origin: "Vendas",
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    date: today,
    description: "",
    categoryId: initialCategories.find((item) => item.kind === "expense")?.id ?? "",
    expenseType: "variable" as ExpenseType,
  });

  const [billForm, setBillForm] = useState({
    title: "",
    amount: "",
    dueDate: today,
    status: "pending" as BillStatus,
    kind: "payable" as FinancialBill["kind"],
    categoryId: initialCategories.find((item) => item.kind === "expense")?.id ?? "",
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    kind: "expense" as FinancialCategory["kind"],
  });

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.kind === "income"),
    [categories],
  );
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories],
  );

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters],
  );
  const summary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions],
  );
  const monthlyReport = useMemo(() => {
    const currentMonth = today.slice(0, 7);
    return summarizeTransactions(
      transactions.filter((transaction) => transaction.date.startsWith(currentMonth)),
    );
  }, [transactions]);

  const flowData = useMemo(
    () => cashFlowByPeriod(filteredTransactions, period),
    [filteredTransactions, period],
  );
  const expensesReport = useMemo(
    () => expensesByCategory(filteredTransactions, categories),
    [filteredTransactions, categories],
  );
  const evolutionReport = useMemo(
    () => monthlyEvolution(transactions),
    [transactions],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const addIncome = () => {
    if (!incomeForm.amount || !incomeForm.description || !incomeForm.categoryId) return;
    setTransactions((previous) => [
      {
        id: buildId("tx"),
        kind: "income",
        amount: Number(incomeForm.amount),
        date: incomeForm.date,
        description: incomeForm.description,
        categoryId: incomeForm.categoryId,
        origin: incomeForm.origin,
      },
      ...previous,
    ]);
    setIncomeForm((previous) => ({
      ...previous,
      amount: "",
      description: "",
      origin: "Vendas",
    }));
  };

  const addExpense = () => {
    if (!expenseForm.amount || !expenseForm.description || !expenseForm.categoryId) return;
    setTransactions((previous) => [
      {
        id: buildId("tx"),
        kind: "expense",
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        description: expenseForm.description,
        categoryId: expenseForm.categoryId,
        expenseType: expenseForm.expenseType,
      },
      ...previous,
    ]);
    setExpenseForm((previous) => ({
      ...previous,
      amount: "",
      description: "",
      expenseType: "variable",
    }));
  };

  const addBill = () => {
    if (!billForm.title || !billForm.amount || !billForm.categoryId) return;
    setBills((previous) => [
      {
        id: buildId("bill"),
        title: billForm.title,
        amount: Number(billForm.amount),
        dueDate: billForm.dueDate,
        status: billForm.status,
        kind: billForm.kind,
        categoryId: billForm.categoryId,
      },
      ...previous,
    ]);
    setBillForm((previous) => ({
      ...previous,
      title: "",
      amount: "",
      status: "pending",
    }));
  };

  const addCategory = () => {
    const name = newCategory.name.trim();
    if (!name) return;
    setCategories((previous) => [
      ...previous,
      { id: buildId("cat"), name, kind: newCategory.kind },
    ]);
    setNewCategory({ name: "", kind: "expense" });
  };

  const saveCategoryEdit = () => {
    const name = editingCategoryName.trim();
    if (!editingCategoryId || !name) return;
    setCategories((previous) =>
      previous.map((category) =>
        category.id === editingCategoryId ? { ...category, name } : category,
      ),
    );
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const maxBarValue = Math.max(summary.income, summary.expense, 1);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Dashboard financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle completo de receitas, despesas, fluxo de caixa e relatorios.
          </p>
        </div>
        <UserButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine os dados por data, categoria e tipo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, startDate: event.target.value || undefined }))
            }
          />
          <Input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, endDate: event.target.value || undefined }))
            }
          />
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={filters.categoryId ?? ""}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                categoryId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Todas categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={filters.kind ?? "all"}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                kind: event.target.value as TransactionFilters["kind"],
              }))
            }
          >
            <option value="all">Entradas e saidas</option>
            <option value="income">Somente entradas</option>
            <option value="expense">Somente saidas</option>
          </select>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Saldo atual</CardDescription>
            <CardTitle>{formatCurrency(summary.balance)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total de entradas</CardDescription>
            <CardTitle className="text-success">{formatCurrency(summary.income)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total de saidas</CardDescription>
            <CardTitle className="text-danger">{formatCurrency(summary.expense)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Lucro/prejuizo mensal</CardDescription>
            <CardTitle>{formatCurrency(monthlyReport.balance)}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Entradas vs saidas
            </CardTitle>
            <CardDescription>Visualizacao comparativa no periodo filtrado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Entradas</div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-success"
                    style={{ width: `${(summary.income / maxBarValue) * 100}%` }}
                  />
                </div>
                <p className="text-sm font-medium">{formatCurrency(summary.income)}</p>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Saidas</div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-danger"
                    style={{ width: `${(summary.expense / maxBarValue) * 100}%` }}
                  />
                </div>
                <p className="text-sm font-medium">{formatCurrency(summary.expense)}</p>
              </div>
            </div>
            <Badge variant={summary.balance >= 0 ? "success" : "danger"}>
              {summary.balance >= 0 ? "Resultado positivo" : "Resultado negativo"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumo mensal</CardTitle>
            <CardDescription>Consolidado do mes atual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Receitas</span>
              <span>{formatCurrency(monthlyReport.income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Despesas</span>
              <span>{formatCurrency(monthlyReport.expense)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 font-medium">
              <span>Resultado</span>
              <span>{formatCurrency(monthlyReport.balance)}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Cadastro de entradas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              placeholder="Valor"
              value={incomeForm.amount}
              onChange={(event) =>
                setIncomeForm((previous) => ({ ...previous, amount: event.target.value }))
              }
            />
            <Input
              type="date"
              value={incomeForm.date}
              onChange={(event) =>
                setIncomeForm((previous) => ({ ...previous, date: event.target.value }))
              }
            />
            <Input
              placeholder="Descricao"
              className="md:col-span-2"
              value={incomeForm.description}
              onChange={(event) =>
                setIncomeForm((previous) => ({ ...previous, description: event.target.value }))
              }
            />
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={incomeForm.categoryId}
              onChange={(event) =>
                setIncomeForm((previous) => ({ ...previous, categoryId: event.target.value }))
              }
            >
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Origem da receita (ex: vendas)"
              value={incomeForm.origin}
              onChange={(event) =>
                setIncomeForm((previous) => ({ ...previous, origin: event.target.value }))
              }
            />
            <Button className="md:col-span-2" onClick={addIncome}>
              Adicionar entrada
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Cadastro de gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              placeholder="Valor"
              value={expenseForm.amount}
              onChange={(event) =>
                setExpenseForm((previous) => ({ ...previous, amount: event.target.value }))
              }
            />
            <Input
              type="date"
              value={expenseForm.date}
              onChange={(event) =>
                setExpenseForm((previous) => ({ ...previous, date: event.target.value }))
              }
            />
            <Input
              placeholder="Descricao"
              className="md:col-span-2"
              value={expenseForm.description}
              onChange={(event) =>
                setExpenseForm((previous) => ({ ...previous, description: event.target.value }))
              }
            />
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={expenseForm.categoryId}
              onChange={(event) =>
                setExpenseForm((previous) => ({ ...previous, categoryId: event.target.value }))
              }
            >
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={expenseForm.expenseType}
              onChange={(event) =>
                setExpenseForm((previous) => ({
                  ...previous,
                  expenseType: event.target.value as ExpenseType,
                }))
              }
            >
              <option value="fixed">Fixo</option>
              <option value="variable">Variavel</option>
            </select>
            <Button className="md:col-span-2" onClick={addExpense}>
              Adicionar gasto
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Fluxo de caixa
          </CardTitle>
          <CardDescription>Visualizacao por dia, semana ou mes, com historico completo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month"] as FinancialPeriod[]).map((value) => (
              <Button
                key={value}
                variant={period === value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(value)}
              >
                {value === "day" ? "Dia" : value === "week" ? "Semana" : "Mes"}
              </Button>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead>Entradas</TableHead>
                <TableHead>Saidas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flowData.map((item) => (
                <TableRow key={item.label}>
                  <TableCell>{item.label}</TableCell>
                  <TableCell>{formatCurrency(item.income)}</TableCell>
                  <TableCell>{formatCurrency(item.expense)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.net)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Contas a pagar e receber
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Descricao da conta"
              className="md:col-span-2"
              value={billForm.title}
              onChange={(event) =>
                setBillForm((previous) => ({ ...previous, title: event.target.value }))
              }
            />
            <Input
              type="number"
              placeholder="Valor"
              value={billForm.amount}
              onChange={(event) =>
                setBillForm((previous) => ({ ...previous, amount: event.target.value }))
              }
            />
            <Input
              type="date"
              value={billForm.dueDate}
              onChange={(event) =>
                setBillForm((previous) => ({ ...previous, dueDate: event.target.value }))
              }
            />
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={billForm.kind}
              onChange={(event) =>
                setBillForm((previous) => ({
                  ...previous,
                  kind: event.target.value as FinancialBill["kind"],
                }))
              }
            >
              <option value="payable">Conta a pagar</option>
              <option value="receivable">Conta a receber</option>
            </select>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={billForm.status}
              onChange={(event) =>
                setBillForm((previous) => ({
                  ...previous,
                  status: event.target.value as BillStatus,
                }))
              }
            >
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Atrasado</option>
            </select>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm md:col-span-2"
              value={billForm.categoryId}
              onChange={(event) =>
                setBillForm((previous) => ({ ...previous, categoryId: event.target.value }))
              }
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <Button className="md:col-span-2" onClick={addBill}>
              Adicionar conta
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historico de contas</CardTitle>
            <CardDescription>Status de vencimentos e pagamentos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>
                      <p className="font-medium">{bill.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {bill.kind === "payable" ? "A pagar" : "A receber"} -{" "}
                        {categoryMap.get(bill.categoryId)?.name ?? "Sem categoria"}
                      </p>
                    </TableCell>
                    <TableCell>{formatDate(bill.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(bill.status)}>
                        {bill.status === "paid"
                          ? "Pago"
                          : bill.status === "pending"
                            ? "Pendente"
                            : "Atrasado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(bill.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Categorias financeiras</CardTitle>
            <CardDescription>Crie e edite categorias para despesas e receitas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
              <Input
                placeholder="Nova categoria"
                value={newCategory.name}
                onChange={(event) =>
                  setNewCategory((previous) => ({ ...previous, name: event.target.value }))
                }
              />
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={newCategory.kind}
                onChange={(event) =>
                  setNewCategory((previous) => ({
                    ...previous,
                    kind: event.target.value as FinancialCategory["kind"],
                  }))
                }
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
              <Button onClick={addCategory}>Adicionar</Button>
            </div>

            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                >
                  {editingCategoryId === category.id ? (
                    <>
                      <Input
                        value={editingCategoryName}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                        className="max-w-xs"
                      />
                      <Button size="sm" onClick={saveCategoryEdit}>
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setEditingCategoryName("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{category.name}</span>
                      <Badge variant={category.kind === "income" ? "success" : "warning"}>
                        {category.kind === "income" ? "Receita" : "Despesa"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditingCategoryName(category.name);
                        }}
                      >
                        Editar
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relatorios</CardTitle>
            <CardDescription>Lucro/prejuizo, despesas por categoria e evolucao mensal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">Lucro / Prejuizo no filtro atual</p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  summary.balance >= 0 ? "text-success" : "text-danger",
                )}
              >
                {formatCurrency(summary.balance)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Despesas por categoria</p>
              {expensesReport.map((item) => (
                <div key={item.categoryId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{item.categoryName}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${(item.total / Math.max(expensesReport[0]?.total ?? 1, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Evolucao mensal</p>
              {evolutionReport.map((item) => (
                <div key={item.monthLabel} className="flex items-center justify-between text-sm">
                  <span>{item.monthLabel}</span>
                  <span>{formatCurrency(item.result)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Historico financeiro completo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.kind === "income"
                          ? `Origem: ${transaction.origin ?? "Nao informado"}`
                          : `Despesa: ${transaction.expenseType === "fixed" ? "Fixa" : "Variavel"}`}
                      </p>
                    </TableCell>
                    <TableCell>
                      {categoryMap.get(transaction.categoryId)?.name ?? "Sem categoria"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.kind === "income" ? "success" : "warning"}>
                        {transaction.kind === "income" ? "Entrada" : "Saida"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
