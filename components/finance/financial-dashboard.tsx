"use client"

import { UserButton, useUser } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  FolderTree,
  LayoutDashboard,
  PackagePlus,
  ReceiptText,
  Repeat,
  TrendingDown,
  Wallet,
} from "lucide-react"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  cashFlowByPeriod,
  filterTransactions,
  formatCurrency,
  formatDate,
  monthlyEvolution,
  summarizeTransactions,
} from "@/lib/finance/calculations"
import type {
  ExpenseType,
  FinancialCategory,
  FinancialPeriod,
  FinancialTransaction,
  TransactionFilters,
} from "@/lib/finance/types"
import { cn } from "@/lib/utils"

type ModuleKey = "home" | "finance" | "stock" | "mercadolivre" | "branchhunter"
type FinanceSection = "overview" | "expenses" | "categories" | "reports" | "history"
type StockSection = "overview" | "products" | "movements" | "history"

type StockProduct = {
  id: string
  name: string
  sku: string
  category: string
  quantity: number
  minStock: number
  unitCost: number
  sellingPrice?: number
}

type StockMovement = {
  id: string
  productId: string
  type: "in" | "out" | "adjustment" | "sale"
  quantity: number
  date: string
  unitPrice?: number
  note?: string
}

type MlConnectionStatus =
  | { connected: false }
  | {
      connected: true
      mlUserId: string
      mlNickname: string | null
      expiresAt: number
      updatedAt: number
    }

const today = new Date().toISOString().slice(0, 10)

function movementLabel(type: StockMovement["type"]) {
  if (type === "in") return "Entrada"
  if (type === "out") return "Saida"
  if (type === "sale") return "Venda"
  return "Ajuste"
}

export function FinancialDashboard() {
  const { user, isLoaded } = useUser()
  const userId = user?.id

  const [activeModule, setActiveModule] = useState<ModuleKey>("home")
  const [activeFinanceSection, setActiveFinanceSection] = useState<FinanceSection>("overview")
  const [activeStockSection, setActiveStockSection] = useState<StockSection>("overview")
  const [period, setPeriod] = useState<FinancialPeriod>("month")
  const [filters, setFilters] = useState<TransactionFilters>({ kind: "all" })
  const [isSetupDone, setIsSetupDone] = useState(false)

  const [launchForm, setLaunchForm] = useState({
    kind: "expense" as FinancialTransaction["kind"],
    amount: "",
    date: today,
    description: "",
    categoryId: "" as Id<"categories"> | "",
    origin: "",
    expenseType: "variable" as ExpenseType,
  })
  const [newCategory, setNewCategory] = useState({
    name: "",
    kind: "expense" as FinancialCategory["kind"],
  })
  const [editingCategoryId, setEditingCategoryId] = useState<Id<"categories"> | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const [editingTransactionId, setEditingTransactionId] = useState<Id<"transactions"> | null>(null)
  const [transactionEditForm, setTransactionEditForm] = useState({
    kind: "expense" as FinancialTransaction["kind"],
    amount: "",
    date: today,
    description: "",
    categoryId: "" as Id<"categories"> | "",
    origin: "",
    expenseType: "variable" as ExpenseType,
  })

  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    category: "",
    quantity: "",
    minStock: "",
    unitCost: "",
    sellingPrice: "",
  })
  const [editingProductId, setEditingProductId] = useState<Id<"stockProducts"> | null>(null)
  const [productEditForm, setProductEditForm] = useState({
    name: "",
    sku: "",
    category: "",
    quantity: "",
    minStock: "",
    unitCost: "",
    sellingPrice: "",
  })
  const [productFeedback, setProductFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [movementForm, setMovementForm] = useState({
    productId: "" as Id<"stockProducts"> | "",
    type: "sale" as StockMovement["type"],
    quantity: "",
    date: today,
    unitPrice: "",
    note: "",
  })
  const [mlConnectionStatus, setMlConnectionStatus] = useState<MlConnectionStatus | null>(null)
  const [mlLoading, setMlLoading] = useState(false)
  const [mlListingsCount, setMlListingsCount] = useState<number | null>(null)
  const [mlOrdersCount, setMlOrdersCount] = useState<number | null>(null)
  const [mlMetrics, setMlMetrics] = useState<{
    listingsTotal: number
    ordersTotal: number
    grossAmountSample: number
    sampleSize: number
  } | null>(null)
  const [mlError, setMlError] = useState<string | null>(null)

  const financeData = useQuery(
    api.finance.getDashboardData,
    userId
      ? {
          userId,
          startDate: filters.startDate,
          endDate: filters.endDate,
          kind: filters.kind,
          categoryId: filters.categoryId ? (filters.categoryId as Id<"categories">) : undefined,
        }
      : "skip",
  )

  const stockData = useQuery(api.stock.getDashboardData, userId ? { userId } : "skip")

  const ensureEcommerceSetup = useMutation(api.finance.ensureEcommerceSetup)
  const addCategory = useMutation(api.finance.addCategory)
  const updateCategory = useMutation(api.finance.updateCategory)
  const addTransaction = useMutation(api.finance.addTransaction)
  const updateTransaction = useMutation(api.finance.updateTransaction)
  const deleteTransaction = useMutation(api.finance.deleteTransaction)
  const addProduct = useMutation(api.stock.addProduct)
  const updateProduct = useMutation(api.stock.updateProduct)
  const deleteProduct = useMutation(api.stock.deleteProduct)
  const addMovement = useMutation(api.stock.addMovement)

  useEffect(() => {
    if (!userId || isSetupDone) return
    void ensureEcommerceSetup({ userId }).then(() => setIsSetupDone(true))
  }, [ensureEcommerceSetup, isSetupDone, userId])

  useEffect(() => {
    if (activeModule !== "mercadolivre") return

    const load = async () => {
      setMlLoading(true)
      setMlError(null)
      try {
        const response = await fetch("/api/ml/account", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Falha ao carregar status do Mercado Livre.")
        }
        setMlConnectionStatus(payload.data as MlConnectionStatus)
      } catch (error) {
        setMlError(error instanceof Error ? error.message : "Erro ao consultar conta Mercado Livre.")
      } finally {
        setMlLoading(false)
      }
    }

    void load()
  }, [activeModule])

  const categories = useMemo<FinancialCategory[]>(
    () =>
      (financeData?.categories ?? []).map((item) => ({
        id: item._id,
        name: item.name,
        kind: item.kind,
      })),
    [financeData?.categories],
  )

  const transactions = useMemo<FinancialTransaction[]>(
    () =>
      (financeData?.transactions ?? []).map((item) => ({
        id: item._id,
        kind: item.kind,
        amount: item.amount,
        date: item.date,
        description: item.description,
        categoryId: item.categoryId,
        origin: item.origin,
        expenseType: item.expenseType,
      })),
    [financeData?.transactions],
  )

  const products = useMemo<StockProduct[]>(
    () =>
      (stockData?.products ?? []).map((item) => ({
        id: item._id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        minStock: item.minStock,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
      })),
    [stockData?.products],
  )

  const movements = useMemo<StockMovement[]>(
    () =>
      (stockData?.movements ?? []).map((item) => ({
        id: item._id,
        productId: item.productId,
        type: item.type,
        quantity: item.quantity,
        date: item.date,
        unitPrice: item.unitPrice,
        note: item.note,
      })),
    [stockData?.movements],
  )

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const expenseCategories = categories.filter((category) => category.kind === "expense")
  const incomeCategories = categories.filter((category) => category.kind === "income")
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters],
  )
  const summary = useMemo(() => summarizeTransactions(filteredTransactions), [filteredTransactions])
  const monthlyReport = useMemo(() => {
    const currentMonth = today.slice(0, 7)
    return summarizeTransactions(
      transactions.filter((transaction) => transaction.date.startsWith(currentMonth)),
    )
  }, [transactions])
  const flowData = useMemo(
    () => cashFlowByPeriod(filteredTransactions, period),
    [filteredTransactions, period],
  )
  const evolutionReport = useMemo(() => monthlyEvolution(transactions), [transactions])
  const maxBarValue = Math.max(summary.income, summary.expense, 1)

  const salesInFilter = filteredTransactions
    .filter((item) => item.kind === "income" && item.origin === "Venda online")
    .reduce((total, item) => total + item.amount, 0)
  const expensesInFilter = filteredTransactions
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + item.amount, 0)
  const operatingResult = salesInFilter - expensesInFilter

  const stockSummary = useMemo(() => {
    const totalProducts = products.length
    const totalUnits = products.reduce((total, item) => total + item.quantity, 0)
    const lowStockCount = products.filter((item) => item.quantity <= item.minStock).length
    const stockValue = products.reduce((total, item) => total + item.quantity * item.unitCost, 0)
    return { totalProducts, totalUnits, lowStockCount, stockValue }
  }, [products])

  const saveLaunch = async () => {
    if (!userId || !launchForm.amount || !launchForm.description || !launchForm.categoryId) return
    await addTransaction({
      userId,
      kind: launchForm.kind,
      amount: Number(launchForm.amount),
      date: launchForm.date,
      description: launchForm.description,
      categoryId: launchForm.categoryId,
      origin: launchForm.kind === "income" ? launchForm.origin || undefined : undefined,
      expenseType: launchForm.kind === "expense" ? launchForm.expenseType : undefined,
    })
    setLaunchForm((previous) => ({
      ...previous,
      amount: "",
      description: "",
      origin: "",
      expenseType: "variable",
    }))
  }

  const saveCategory = async () => {
    const name = newCategory.name.trim()
    if (!userId || !name) return
    await addCategory({
      userId,
      name,
      kind: newCategory.kind,
    })
    setNewCategory({ name: "", kind: "expense" })
  }

  const saveCategoryEdit = async () => {
    const name = editingCategoryName.trim()
    if (!userId || !editingCategoryId || !name) return
    await updateCategory({
      userId,
      categoryId: editingCategoryId,
      name,
    })
    setEditingCategoryId(null)
    setEditingCategoryName("")
  }

  const startEditTransaction = (transaction: FinancialTransaction) => {
    setEditingTransactionId(transaction.id as Id<"transactions">)
    setTransactionEditForm({
      kind: transaction.kind,
      amount: String(transaction.amount),
      date: transaction.date,
      description: transaction.description,
      categoryId: transaction.categoryId as Id<"categories">,
      origin: transaction.origin ?? "",
      expenseType: transaction.expenseType ?? "variable",
    })
  }

  const saveTransactionEdit = async () => {
    if (
      !userId ||
      !editingTransactionId ||
      !transactionEditForm.amount ||
      !transactionEditForm.description ||
      !transactionEditForm.categoryId
    ) {
      return
    }

    await updateTransaction({
      userId,
      transactionId: editingTransactionId,
      kind: transactionEditForm.kind,
      amount: Number(transactionEditForm.amount),
      date: transactionEditForm.date,
      description: transactionEditForm.description,
      categoryId: transactionEditForm.categoryId,
      origin:
        transactionEditForm.kind === "income"
          ? transactionEditForm.origin || undefined
          : undefined,
      expenseType:
        transactionEditForm.kind === "expense"
          ? transactionEditForm.expenseType
          : undefined,
    })

    setEditingTransactionId(null)
  }

  const removeTransaction = async (transaction: FinancialTransaction) => {
    if (!userId) return
    const confirmed = window.confirm("Deseja realmente excluir este lancamento?")
    if (!confirmed) return

    await deleteTransaction({
      userId,
      transactionId: transaction.id as Id<"transactions">,
    })

    if (editingTransactionId === transaction.id) {
      setEditingTransactionId(null)
    }
  }

  const saveProduct = async () => {
    if (
      !userId ||
      !productForm.name ||
      !productForm.sku ||
      !productForm.category ||
      !productForm.quantity ||
      !productForm.minStock ||
      !productForm.unitCost
    ) {
      return
    }

    const quantity = Number(productForm.quantity)
    const minStock = Number(productForm.minStock)
    const unitCost = Number(productForm.unitCost)
    const sellingPrice = productForm.sellingPrice ? Number(productForm.sellingPrice) : undefined

    if (
      Number.isNaN(quantity) ||
      Number.isNaN(minStock) ||
      Number.isNaN(unitCost) ||
      (productForm.sellingPrice && Number.isNaN(sellingPrice))
    ) {
      setProductFeedback({ type: "error", message: "Use apenas numeros validos nos campos numericos." })
      return
    }

    try {
      await addProduct({
        userId,
        name: productForm.name,
        sku: productForm.sku,
        category: productForm.category,
        quantity,
        minStock,
        unitCost,
        sellingPrice,
      })

      setProductForm({
        name: "",
        sku: "",
        category: "",
        quantity: "",
        minStock: "",
        unitCost: "",
        sellingPrice: "",
      })
      setProductFeedback({ type: "success", message: "Produto adicionado com sucesso." })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel adicionar o produto.",
      })
    }
  }

  const startEditProduct = (product: StockProduct) => {
    setEditingProductId(product.id as Id<"stockProducts">)
    setProductEditForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      quantity: String(product.quantity),
      minStock: String(product.minStock),
      unitCost: String(product.unitCost),
      sellingPrice: product.sellingPrice ? String(product.sellingPrice) : "",
    })
  }

  const saveProductEdit = async () => {
    if (
      !userId ||
      !editingProductId ||
      !productEditForm.name ||
      !productEditForm.sku ||
      !productEditForm.category ||
      !productEditForm.quantity ||
      !productEditForm.minStock ||
      !productEditForm.unitCost
    ) {
      return
    }

    const quantity = Number(productEditForm.quantity)
    const minStock = Number(productEditForm.minStock)
    const unitCost = Number(productEditForm.unitCost)
    const sellingPrice = productEditForm.sellingPrice ? Number(productEditForm.sellingPrice) : undefined

    if (
      Number.isNaN(quantity) ||
      Number.isNaN(minStock) ||
      Number.isNaN(unitCost) ||
      (productEditForm.sellingPrice && Number.isNaN(sellingPrice))
    ) {
      setProductFeedback({ type: "error", message: "Use apenas numeros validos nos campos numericos." })
      return
    }

    try {
      await updateProduct({
        userId,
        productId: editingProductId,
        name: productEditForm.name,
        sku: productEditForm.sku,
        category: productEditForm.category,
        quantity,
        minStock,
        unitCost,
        sellingPrice,
      })
      setEditingProductId(null)
      setProductFeedback({ type: "success", message: "Produto atualizado com sucesso." })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar o produto.",
      })
    }
  }

  const removeProduct = async (product: StockProduct) => {
    if (!userId) return
    const confirmed = window.confirm(
      `Deseja excluir o produto "${product.name}"? Isso removera tambem o historico de movimentacoes deste item.`,
    )
    if (!confirmed) return

    try {
      await deleteProduct({
        userId,
        productId: product.id as Id<"stockProducts">,
      })
      if (editingProductId === product.id) {
        setEditingProductId(null)
      }
      setProductFeedback({ type: "success", message: "Produto removido com sucesso." })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel remover o produto.",
      })
    }
  }

  const saveMovement = async () => {
    if (!userId || !movementForm.productId || !movementForm.quantity) return
    await addMovement({
      userId,
      productId: movementForm.productId,
      type: movementForm.type,
      quantity: Number(movementForm.quantity),
      date: movementForm.date,
      unitPrice: movementForm.unitPrice ? Number(movementForm.unitPrice) : undefined,
      note: movementForm.note || undefined,
    })
    setMovementForm((previous) => ({ ...previous, quantity: "", unitPrice: "", note: "" }))
  }

  const loadMlListings = async () => {
    setMlError(null)
    try {
      const response = await fetch("/api/ml/listings?limit=1", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar anuncios.")
      }
      setMlListingsCount(payload.data.total ?? 0)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar anuncios.")
    }
  }

  const loadMlOrders = async () => {
    setMlError(null)
    try {
      const response = await fetch("/api/ml/orders?limit=1", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar pedidos.")
      }
      setMlOrdersCount(payload.data.total ?? 0)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar pedidos.")
    }
  }

  const loadMlMetrics = async () => {
    setMlError(null)
    try {
      const response = await fetch("/api/ml/metrics", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar metricas.")
      }
      setMlMetrics(payload.data)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar metricas.")
    }
  }

  if (!isLoaded) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Carregando dashboard</CardTitle>
            <CardDescription>Preparando ambiente de e-commerce.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 p-4 md:p-6">
      <aside className="hidden w-72 shrink-0 flex-col gap-2 rounded-none border bg-card p-4 lg:flex">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/branch_logo.jpeg"
              alt="BranchHub logo"
              width={28}
              height={28}
              className="rounded-none object-cover"
            />
            <h2 className="text-sm font-semibold">BranchHub</h2>
          </div>
          <UserButton />
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">Modulos</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={activeModule === "home" ? "default" : "outline"} size="sm" onClick={() => setActiveModule("home")}>
            Home
          </Button>
          <Button variant={activeModule === "finance" ? "default" : "outline"} size="sm" onClick={() => setActiveModule("finance")}>
            Financeiro
          </Button>
          <Button variant={activeModule === "stock" ? "default" : "outline"} size="sm" onClick={() => setActiveModule("stock")}>
            Estoque
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              activeModule === "mercadolivre"
                ? "border-warning bg-warning text-warning-foreground hover:bg-warning/90"
                : "border-warning text-warning hover:bg-warning/10",
            )}
            onClick={() => setActiveModule("mercadolivre")}
          >
            Mercado Livre
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              activeModule === "branchhunter"
                ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-emerald-600 text-emerald-700 hover:bg-emerald-50",
            )}
            onClick={() => setActiveModule("branchhunter")}
          >
            Branch Hunter
          </Button>
        </div>
        <Separator />
        {activeModule === "finance" && (
          <>
            <p className="text-xs text-muted-foreground">Financeiro</p>
            <SidebarButton icon={LayoutDashboard} label="Visao geral" isActive={activeFinanceSection === "overview"} onClick={() => setActiveFinanceSection("overview")} />
            <SidebarButton icon={TrendingDown} label="Lancamentos" isActive={activeFinanceSection === "expenses"} onClick={() => setActiveFinanceSection("expenses")} />
            <SidebarButton icon={FolderTree} label="Categorias" isActive={activeFinanceSection === "categories"} onClick={() => setActiveFinanceSection("categories")} />
            <SidebarButton icon={BarChart3} label="Relatorios" isActive={activeFinanceSection === "reports"} onClick={() => setActiveFinanceSection("reports")} />
            <SidebarButton icon={ReceiptText} label="Historico" isActive={activeFinanceSection === "history"} onClick={() => setActiveFinanceSection("history")} />
          </>
        )}
        {activeModule === "stock" && (
          <>
            <p className="text-xs text-muted-foreground">Estoque</p>
            <SidebarButton icon={Boxes} label="Visao geral" isActive={activeStockSection === "overview"} onClick={() => setActiveStockSection("overview")} />
            <SidebarButton icon={PackagePlus} label="Produtos" isActive={activeStockSection === "products"} onClick={() => setActiveStockSection("products")} />
            <SidebarButton icon={Repeat} label="Movimentacoes" isActive={activeStockSection === "movements"} onClick={() => setActiveStockSection("movements")} />
            <SidebarButton icon={ReceiptText} label="Historico" isActive={activeStockSection === "history"} onClick={() => setActiveStockSection("history")} />
          </>
        )}
      </aside>

      <section className="flex-1 space-y-4">
        {activeModule === "home" && (
          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Home do marketplace</CardTitle>
                <CardDescription>Panorama de vendas, despesas da empresa e estoque.</CardDescription>
              </CardHeader>
            </Card>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard title="Vendas (filtro)" value={salesInFilter} />
              <SummaryCard title="Despesas (filtro)" value={expensesInFilter} negative />
              <SummaryCard title="Resultado operacional" value={operatingResult} positive={operatingResult >= 0} negative={operatingResult < 0} />
              <SummaryCard title="Valor em estoque" value={stockSummary.stockValue} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Financeiro</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <LineItem label="Saldo geral" value={summary.balance} />
                  <LineItem label="Resultado do mes" value={monthlyReport.balance} />
                  <LineItem label="Lancamentos" value={transactions.length} format="number" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Estoque</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <LineItem label="Produtos cadastrados" value={stockSummary.totalProducts} format="number" />
                  <LineItem label="Unidades em estoque" value={stockSummary.totalUnits} format="number" />
                  <LineItem label="Abaixo do minimo" value={stockSummary.lowStockCount} format="number" />
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {activeModule === "finance" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Filtros financeiros</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Input type="date" value={filters.startDate ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value || undefined }))} />
                <Input type="date" value={filters.endDate ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value || undefined }))} />
                <Select value={filters.categoryId ?? "all-categories"} onValueChange={(value) => setFilters((prev) => ({ ...prev, categoryId: value === "all-categories" ? undefined : value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-categories">Todas categorias</SelectItem>
                    {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.kind ?? "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, kind: value as TransactionFilters["kind"] }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Entradas e saidas</SelectItem>
                    <SelectItem value="income">Entradas</SelectItem>
                    <SelectItem value="expense">Saidas</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {activeFinanceSection === "overview" && (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard title="Vendas online" value={salesInFilter} />
                  <SummaryCard title="Despesas empresa" value={expensesInFilter} negative />
                  <SummaryCard title="Resultado operacional" value={operatingResult} positive={operatingResult >= 0} negative={operatingResult < 0} />
                  <SummaryCard title="Saldo financeiro" value={summary.balance} />
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  <Card className="xl:col-span-2">
                    <CardHeader><CardTitle>Entradas vs saidas</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <ProgressBlock label="Entradas" value={summary.income} maxValue={maxBarValue} barClassName="bg-primary" />
                      <ProgressBlock label="Saidas" value={summary.expense} maxValue={maxBarValue} barClassName="bg-destructive" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Resumo mensal</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <LineItem label="Receitas" value={monthlyReport.income} />
                      <LineItem label="Despesas" value={monthlyReport.expense} />
                      <Separator />
                      <LineItem label="Resultado" value={monthlyReport.balance} strong />
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}

            {activeFinanceSection === "expenses" && (
              <Card>
                <CardHeader>
                  <CardTitle>Registrar lancamento</CardTitle>
                  <CardDescription>Lance despesas da empresa ou entradas de capital.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <Select
                    value={launchForm.kind}
                    onValueChange={(value) =>
                      setLaunchForm((prev) => ({
                        ...prev,
                        kind: value as FinancialTransaction["kind"],
                        categoryId: "",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Tipo do lancamento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Entrada de capital</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Valor" value={launchForm.amount} onChange={(event) => setLaunchForm((prev) => ({ ...prev, amount: event.target.value }))} />
                  <Input type="date" value={launchForm.date} onChange={(event) => setLaunchForm((prev) => ({ ...prev, date: event.target.value }))} />
                  <Input className="md:col-span-2" placeholder="Descricao" value={launchForm.description} onChange={(event) => setLaunchForm((prev) => ({ ...prev, description: event.target.value }))} />
                  <Select value={launchForm.categoryId || undefined} onValueChange={(value) => setLaunchForm((prev) => ({ ...prev, categoryId: value as Id<"categories"> }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      {(launchForm.kind === "income" ? incomeCategories : expenseCategories).map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {launchForm.kind === "expense" ? (
                    <Select value={launchForm.expenseType} onValueChange={(value) => setLaunchForm((prev) => ({ ...prev, expenseType: value as ExpenseType }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Tipo da despesa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixo</SelectItem>
                        <SelectItem value="variable">Variavel</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Origem da entrada (ex: aporte)"
                      value={launchForm.origin}
                      onChange={(event) => setLaunchForm((prev) => ({ ...prev, origin: event.target.value }))}
                    />
                  )}
                  <Button className="md:col-span-2" onClick={saveLaunch}>Salvar lancamento</Button>
                </CardContent>
              </Card>
            )}

            {activeFinanceSection === "categories" && (
              <Card>
                <CardHeader>
                  <CardTitle>Categorias de despesa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
                    <Input placeholder="Nome da categoria" value={newCategory.name} onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))} />
                    <Select value={newCategory.kind} onValueChange={(value) => setNewCategory((prev) => ({ ...prev, kind: value as FinancialCategory["kind"] }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={saveCategory}>Salvar categoria</Button>
                  </div>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex flex-wrap items-center gap-2 rounded-none border border-border p-2">
                        {editingCategoryId === category.id ? (
                          <>
                            <Input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} className="max-w-xs" />
                            <Button size="sm" onClick={saveCategoryEdit}>Salvar</Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingCategoryId(null); setEditingCategoryName("") }}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{category.name}</span>
                            <Badge variant={category.kind === "income" ? "default" : "secondary"}>{category.kind === "income" ? "Receita" : "Despesa"}</Badge>
                            <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setEditingCategoryId(category.id as Id<"categories">); setEditingCategoryName(category.name) }}>Editar</Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeFinanceSection === "reports" && (
              <section className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Fluxo de caixa (dia/semana/mes)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {(["day", "week", "month"] as FinancialPeriod[]).map((value) => (
                        <Button key={value} size="sm" variant={period === value ? "default" : "outline"} onClick={() => setPeriod(value)}>
                          {value === "day" ? "Dia" : value === "week" ? "Semana" : "Mes"}
                        </Button>
                      ))}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Periodo</TableHead><TableHead>Entradas</TableHead><TableHead>Saidas</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {flowData.map((item) => (
                          <TableRow key={item.label}>
                            <TableCell>{item.label}</TableCell>
                            <TableCell>{formatCurrency(item.income)}</TableCell>
                            <TableCell>{formatCurrency(item.expense)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.net)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Evolucao mensal</CardTitle></CardHeader>
                  <CardContent className="grid gap-2">
                    {evolutionReport.map((item) => (
                      <div key={item.monthLabel} className="flex items-center justify-between rounded-none border border-border p-2 text-sm">
                        <span>{item.monthLabel}</span>
                        <span>{formatCurrency(item.result)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
            )}

            {activeFinanceSection === "history" && (
              <Card>
                <CardHeader><CardTitle>Historico financeiro</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {editingTransactionId && (
                    <div className="grid gap-3 rounded-none border border-border p-3 md:grid-cols-2">
                      <Select
                        value={transactionEditForm.kind}
                        onValueChange={(value) =>
                          setTransactionEditForm((prev) => ({
                            ...prev,
                            kind: value as FinancialTransaction["kind"],
                            categoryId: "",
                          }))
                        }
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Entrada</SelectItem>
                          <SelectItem value="expense">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Valor"
                        value={transactionEditForm.amount}
                        onChange={(event) =>
                          setTransactionEditForm((prev) => ({ ...prev, amount: event.target.value }))
                        }
                      />
                      <Input
                        type="date"
                        value={transactionEditForm.date}
                        onChange={(event) =>
                          setTransactionEditForm((prev) => ({ ...prev, date: event.target.value }))
                        }
                      />
                      <Select
                        value={transactionEditForm.categoryId || undefined}
                        onValueChange={(value) =>
                          setTransactionEditForm((prev) => ({
                            ...prev,
                            categoryId: value as Id<"categories">,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
                        <SelectContent>
                          {(transactionEditForm.kind === "income"
                            ? incomeCategories
                            : expenseCategories
                          ).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="md:col-span-2"
                        placeholder="Descricao"
                        value={transactionEditForm.description}
                        onChange={(event) =>
                          setTransactionEditForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                      />
                      {transactionEditForm.kind === "income" ? (
                        <Input
                          className="md:col-span-2"
                          placeholder="Origem da receita"
                          value={transactionEditForm.origin}
                          onChange={(event) =>
                            setTransactionEditForm((prev) => ({
                              ...prev,
                              origin: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        <Select
                          value={transactionEditForm.expenseType}
                          onValueChange={(value) =>
                            setTransactionEditForm((prev) => ({
                              ...prev,
                              expenseType: value as ExpenseType,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full md:col-span-2"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixo</SelectItem>
                            <SelectItem value="variable">Variavel</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <div className="flex gap-2 md:col-span-2">
                        <Button onClick={saveTransactionEdit}>Salvar alteracoes</Button>
                        <Button variant="outline" onClick={() => setEditingTransactionId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Data</TableHead><TableHead>Descricao</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Acoes</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.slice().sort((a, b) => b.date.localeCompare(a.date)).map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.date)}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>{categoryMap.get(transaction.categoryId)?.name ?? "Sem categoria"}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.kind === "income" ? "default" : "secondary"}>
                              {transaction.kind === "income" ? "Entrada" : "Despesa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
                          <TableCell>
                            {transaction.origin === "Venda online" ? (
                              <Badge variant="secondary">Editar no estoque</Badge>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditTransaction(transaction)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => void removeTransaction(transaction)}
                                >
                                  Excluir
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeModule === "stock" && (
          <>
            {activeStockSection === "overview" && (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard title="Produtos cadastrados" value={stockSummary.totalProducts} format="number" />
                  <SummaryCard title="Unidades em estoque" value={stockSummary.totalUnits} format="number" />
                  <SummaryCard title="Abaixo do minimo" value={stockSummary.lowStockCount} format="number" />
                  <SummaryCard title="Valor em estoque" value={stockSummary.stockValue} />
                </div>
                <Card>
                  <CardHeader><CardTitle>Produtos criticos</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead>Atual</TableHead><TableHead>Minimo</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.filter((product) => product.quantity <= product.minStock).map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>{product.quantity}</TableCell>
                            <TableCell>{product.minStock}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Produtos em estoque</CardTitle>
                    <CardDescription>Edite ou exclua itens individualmente.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {productFeedback && (
                      <p
                        className={cn(
                          "text-sm",
                          productFeedback.type === "success" ? "text-primary" : "text-destructive",
                        )}
                      >
                        {productFeedback.message}
                      </p>
                    )}
                    {editingProductId && (
                      <div className="grid gap-3 rounded-none border border-border p-3 md:grid-cols-2">
                        <Input
                          placeholder="Nome do produto"
                          value={productEditForm.name}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                        <Input
                          placeholder="SKU"
                          value={productEditForm.sku}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, sku: event.target.value }))
                          }
                        />
                        <Input
                          placeholder="Categoria"
                          value={productEditForm.category}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, category: event.target.value }))
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Quantidade"
                          value={productEditForm.quantity}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, quantity: event.target.value }))
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Estoque minimo"
                          value={productEditForm.minStock}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, minStock: event.target.value }))
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Custo unitario"
                          value={productEditForm.unitCost}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, unitCost: event.target.value }))
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Preco de venda (opcional)"
                          className="md:col-span-2"
                          value={productEditForm.sellingPrice}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, sellingPrice: event.target.value }))
                          }
                        />
                        <div className="flex gap-2 md:col-span-2">
                          <Button onClick={saveProductEdit}>Salvar alteracoes</Button>
                          <Button variant="outline" onClick={() => setEditingProductId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Minimo</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell>{product.quantity}</TableCell>
                            <TableCell>{product.minStock}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditProduct(product)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => void removeProduct(product)}
                                >
                                  Excluir
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeStockSection === "products" && (
              <section className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Novo produto</CardTitle></CardHeader>
                  <CardContent className="grid gap-3">
                    <Input placeholder="Nome do produto" value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} />
                    <Input placeholder="SKU" value={productForm.sku} onChange={(event) => setProductForm((prev) => ({ ...prev, sku: event.target.value }))} />
                    <Input placeholder="Categoria" value={productForm.category} onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))} />
                    <Input type="number" placeholder="Quantidade inicial" value={productForm.quantity} onChange={(event) => setProductForm((prev) => ({ ...prev, quantity: event.target.value }))} />
                    <Input type="number" placeholder="Estoque minimo" value={productForm.minStock} onChange={(event) => setProductForm((prev) => ({ ...prev, minStock: event.target.value }))} />
                    <Input type="number" placeholder="Custo unitario" value={productForm.unitCost} onChange={(event) => setProductForm((prev) => ({ ...prev, unitCost: event.target.value }))} />
                    <Input type="number" placeholder="Preco de venda (opcional)" value={productForm.sellingPrice} onChange={(event) => setProductForm((prev) => ({ ...prev, sellingPrice: event.target.value }))} />
                    <Button onClick={saveProduct}>Salvar produto</Button>
                    {productFeedback && (
                      <p
                        className={cn(
                          "text-sm",
                          productFeedback.type === "success" ? "text-primary" : "text-destructive",
                        )}
                      >
                        {productFeedback.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Produtos cadastrados</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead>Categoria</TableHead><TableHead>Qtd</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell>
                              <Badge variant={product.quantity <= product.minStock ? "destructive" : "secondary"}>
                                {product.quantity}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeStockSection === "movements" && (
              <section className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Movimentacao de estoque</CardTitle>
                    <CardDescription>Use "Venda" para registrar a saida e refletir automaticamente no financeiro.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Select value={movementForm.productId || undefined} onValueChange={(value) => setMovementForm((prev) => ({ ...prev, productId: value as Id<"stockProducts"> }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name} ({product.sku})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={movementForm.type} onValueChange={(value) => setMovementForm((prev) => ({ ...prev, type: value as StockMovement["type"] }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Venda</SelectItem>
                        <SelectItem value="in">Entrada</SelectItem>
                        <SelectItem value="out">Saida</SelectItem>
                        <SelectItem value="adjustment">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Quantidade" value={movementForm.quantity} onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))} />
                    <Input type="date" value={movementForm.date} onChange={(event) => setMovementForm((prev) => ({ ...prev, date: event.target.value }))} />
                    {movementForm.type === "sale" && (
                      <Input type="number" placeholder="Preco unitario da venda" value={movementForm.unitPrice} onChange={(event) => setMovementForm((prev) => ({ ...prev, unitPrice: event.target.value }))} />
                    )}
                    <Input placeholder="Observacao" value={movementForm.note} onChange={(event) => setMovementForm((prev) => ({ ...prev, note: event.target.value }))} />
                    <Button onClick={saveMovement} disabled={products.length === 0}>Salvar movimentacao</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Ultimas movimentacoes</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Qtd</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>{formatDate(movement.date)}</TableCell>
                            <TableCell>{productMap.get(movement.productId)?.name ?? "Produto removido"}</TableCell>
                            <TableCell>{movementLabel(movement.type)}</TableCell>
                            <TableCell className="text-right">{movement.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeStockSection === "history" && (
              <Card>
                <CardHeader><CardTitle>Historico de estoque</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead>Qtd</TableHead><TableHead>Observacao</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.slice().sort((a, b) => b.date.localeCompare(a.date)).map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDate(movement.date)}</TableCell>
                          <TableCell>{productMap.get(movement.productId)?.name ?? "Produto removido"}</TableCell>
                          <TableCell>{movementLabel(movement.type)}</TableCell>
                          <TableCell>{movement.quantity}</TableCell>
                          <TableCell>{movement.note ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeModule === "mercadolivre" && (
          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-warning">Mercado Livre</CardTitle>
                <CardDescription>Conecte sua conta e consulte anuncios, pedidos e metricas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mlLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando status da conexao...</p>
                ) : mlConnectionStatus?.connected ? (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Status:</span>{" "}
                      <Badge variant="default">Conectado</Badge>
                    </p>
                    <p>
                      <span className="font-medium">Conta ML:</span>{" "}
                      {mlConnectionStatus.mlNickname ?? mlConnectionStatus.mlUserId}
                    </p>
                    <p className="text-muted-foreground">
                      Token expira em: {new Date(mlConnectionStatus.expiresAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Nenhuma conta conectada ao Mercado Livre.
                    </p>
                    <Button
                      className="bg-warning text-warning-foreground hover:bg-warning/90"
                      onClick={() => {
                        window.location.href = "/api/ml/connect"
                      }}
                    >
                      Conectar Mercado Livre
                    </Button>
                  </div>
                )}
                {mlError && <p className="text-sm text-destructive">{mlError}</p>}
              </CardContent>
            </Card>

            {mlConnectionStatus?.connected && (
              <Card>
                <CardHeader>
                  <CardTitle>Consultas rapidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void loadMlListings()}>
                      Buscar anuncios
                    </Button>
                    <Button variant="outline" onClick={() => void loadMlOrders()}>
                      Buscar pedidos
                    </Button>
                    <Button variant="outline" onClick={() => void loadMlMetrics()}>
                      Buscar metricas
                    </Button>
                  </div>
                  <div className="grid gap-2 text-sm">
                    {mlListingsCount !== null && <p>Anuncios totais: {mlListingsCount}</p>}
                    {mlOrdersCount !== null && <p>Pedidos totais: {mlOrdersCount}</p>}
                    {mlMetrics && (
                      <>
                        <p>Metricas - anuncios: {mlMetrics.listingsTotal}</p>
                        <p>Metricas - pedidos: {mlMetrics.ordersTotal}</p>
                        <p>
                          Faturamento amostral ({mlMetrics.sampleSize} pedidos):{" "}
                          {formatCurrency(mlMetrics.grossAmountSample)}
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {activeModule === "branchhunter" && (
          <Card className="border-emerald-600/40">
            <CardHeader>
              <CardTitle className="text-emerald-700">Branch Hunter</CardTitle>
              <CardDescription>
                Ferramenta de calculo de payout para anuncios e operacoes de marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Baixe o pacote da extensao para instalar no Chrome/Edge e usar a calculadora
                diretamente na pagina do anuncio.
              </p>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  window.location.href = "/api/branch-hunter/download"
                }}
              >
                Baixar extensao Branch Hunter (.zip)
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  )
}

function SidebarButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <Button variant={isActive ? "default" : "ghost"} className="justify-start" onClick={onClick}>
      <Icon className="size-4" />
      {label}
    </Button>
  )
}

function SummaryCard({
  title,
  value,
  positive,
  negative,
  format = "currency",
}: {
  title: string
  value: number
  positive?: boolean
  negative?: boolean
  format?: "currency" | "number"
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn(positive && "text-primary", negative && "text-destructive")}>
          {format === "currency" ? formatCurrency(value) : Math.trunc(value)}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function ProgressBlock({
  label,
  value,
  maxValue,
  barClassName,
}: {
  label: string
  value: number
  maxValue: number
  barClassName: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="h-3 rounded-none bg-muted">
        <div className={cn("h-3 rounded-none", barClassName)} style={{ width: `${(value / maxValue) * 100}%` }} />
      </div>
      <p className="text-sm font-medium">{formatCurrency(value)}</p>
    </div>
  )
}

function LineItem({
  label,
  value,
  strong,
  format = "currency",
}: {
  label: string
  value: number
  strong?: boolean
  format?: "currency" | "number"
}) {
  return (
    <div className={cn("flex items-center justify-between", strong && "font-semibold")}>
      <span className="text-muted-foreground">{label}</span>
      <span>{format === "currency" ? formatCurrency(value) : Math.trunc(value)}</span>
    </div>
  )
}
