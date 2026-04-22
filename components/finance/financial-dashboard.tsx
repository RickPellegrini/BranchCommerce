"use client"

import { Dialog } from "radix-ui"

import { UserButton, useUser } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Boxes,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  CircleDollarSign,
  Copy,
  Home,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  LineChart,
  MapPin,
  Package,
  FolderTree,
  LayoutDashboard,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Percent,
  PieChart,
  TrendingUp,
  X,
  PackagePlus,
  Printer,
  ReceiptText,
  Repeat,
  Trophy,
  TrendingDown,
  Wallet,
  Paperclip,
} from "lucide-react"
import Image from "next/image"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
} from "@/lib/finance/calculations"
import type {
  AnexoLancamento,
  ExpenseType,
  FinancialCategory,
  FinancialPeriod,
  FinancialTransaction,
  PaymentMethod,
  TransactionPeriodicity,
  TransactionFilters,
} from "@/lib/finance/types"
import { exportTransactionsToCsv } from "@/lib/finance/export-csv"
import {
  AnexosCountBadge,
  AnexosLancamentoModal,
  LancamentoFormAnexos,
} from "@/components/finance/anexos-lancamento-modal"
import { cn } from "@/lib/utils"
import { AnalysisModal } from "@/features/product-analysis/components/AnalysisModal"
import { HunterAnalysisPage } from "@/features/product-analysis/components/HunterAnalysisPage"
import { KanbanBoard } from "@/components/estoque/KanbanBoard"
import type { ProductKanbanEventRow } from "@/components/estoque/ProductDetailModal"
import { StockFeedbackAlert } from "@/components/estoque/stock-feedback-alert"
import type { KanbanColumnId, KanbanProduct, KanbanStatus } from "@/components/estoque/types"

/**
 * Valor fixo só quando a API de saldo está indisponível: referência de garantia.
 * Saldo estimado não usa complemento manual — alinha com líquido do MP (taxas).
 */
const MP_SALDO_ESTIMADO_GARANTIA_MANUAL_BRL = 250

type ModuleKey = "home" | "finance" | "stock" | "mercadolivre" | "branchhunter"
type FinanceSection =
  | "overview"
  | "abc"
  | "dre"
  | "expenses"
  | "categories"
  | "reports"
  | "history"
  | "cashflow"
type StockSection = "overview" | "products" | "movements" | "history"
type MlSection = "listings" | "orders" | "metrics"
type MlSidebarGroup = "anuncios" | "pedidos" | "metricas"
type HunterSection =
  | "padrao"
  | "analise-anuncio"
  | "quirografados"
  | "concorrentes"
  | "metricas-analise"

type StockProduct = {
  id: string
  name: string
  sku: string
  mlItemId?: string
  imageUrl?: string
  category: string
  quantity: number
  minStock: number
  unitCost: number
  sellingPrice?: number
  kanbanStatus?: KanbanStatus
  kanbanNote?: string
  estimatedArrival?: string
  kanbanHidden?: boolean
  supplier?: string
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

type MlListing = {
  id: string
  title: string
  price: number
  available_quantity: number
  sold_quantity: number
  status: "active" | "paused" | "closed" | string
  sku?: string
  catalogProductId?: string | null
  permalink?: string
  thumbnail?: string
}

type MlOrder = {
  id: string
  status: string
  statusDetail: string
  dateCreated: string
  dateClosed: string
  totalAmount: number
  currency: string
  buyerNickname: string
  shippingStatus: string
  shippingMode: string
  shippingLogisticType: string
  shippingId: string
  dateDelivered: string
  dateFirstPrinted: string
  paymentMethod: string
  paymentStatus: string
  totalPaidAmount: number
  productAmount: number
  mlFeeAmount: number
  shippingCostAmount: number
  taxesAmount: number
  itemThumbnail: string
  isCatalogListing: boolean
  receiverAddressLine: string
  receiverCityState: string
  items: Array<{
    id: string
    title: string
    sku: string
    quantity: number
    unitPrice: number
  }>
}

type MlCatalogCompetitionSummary = {
  total: number
  winning: number
  sharingFirstPlace: number
  competing: number
  listed: number
  paused: number
}

type MlCatalogCompetitionRow = {
  itemId: string
  title: string
  thumbnail?: string
  status: string
  price: number
  availableQuantity: number
  catalogProductId: string | null
  competitionStatus: string
  currentPrice: number
  priceToWin: number | null
  winnerPrice: number | null
  winnerItemId: string | null
  visitShare: string | null
  reasons: string[]
  competitorsSharingFirstPlace: number | null
}

type OrderCostAnalysis = {
  orderId: string
  title: string
  revenueTotal: number
  receivedAmount: number
  netProfit: number
  productCost: number
  shippingCost: number
  centralizeShipping: number
  centralizePackaging: number
  mlFee: number
  taxes: number
  shippingBonus: number
  totalCosts: number
  contributionMargin: number
  roi: number
  source: "ml_api" | "fallback"
}

const today = new Date().toISOString().slice(0, 10)
const HUB_CENTRALIZE_SHIPPING_PER_ITEM = 5
const HUB_CENTRALIZE_PACKAGING_PER_ITEM = 1.5
const HUB_ML_AVG_FEE_RATE = 0.16

function movementLabel(type: StockMovement["type"]) {
  if (type === "in") return "Entrada"
  if (type === "out") return "Saida"
  if (type === "sale") return "Venda"
  return "Ajuste"
}

function periodicityLabel(periodicity: TransactionPeriodicity | undefined) {
  if (!periodicity || periodicity === "one_time") return "Unico"
  if (periodicity === "weekly") return "Semanal"
  if (periodicity === "monthly") return "Mensal"
  if (periodicity === "quarterly") return "Trimestral"
  if (periodicity === "semiannual") return "Semestral"
  return "Anual"
}

function stockLevelDotClass(quantity: number) {
  if (quantity === 0) return "bg-red-600"
  if (quantity <= 10) return "bg-amber-400"
  return "bg-emerald-600"
}

function mlStatusBadgeClass(status: string) {
  const normalizedStatus = status.toLowerCase()
  if (normalizedStatus === "paid" || normalizedStatus === "pago") {
    return "border-blue-600/40 bg-blue-600/10 text-blue-700 dark:text-blue-300"
  }
  if (
    normalizedStatus === "shipped" ||
    normalizedStatus === "sent" ||
    normalizedStatus === "enviado" ||
    normalizedStatus === "ready_to_ship"
  ) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }
  if (normalizedStatus === "delivered" || normalizedStatus === "entregue") {
    return "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
  }
  if (normalizedStatus === "active") {
    return "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
  }
  if (normalizedStatus === "paused") {
    return "border-warning/40 bg-warning/10 text-warning"
  }
  return "border-destructive/40 bg-destructive/10 text-destructive"
}

function catalogCompetitionBadgeClass(status: string) {
  const normalized = String(status ?? "").toLowerCase()
  if (normalized === "winning")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  if (normalized === "sharing_first_place")
    return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (normalized === "competing")
    return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
  if (normalized === "listed")
    return "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300"
  if (normalized === "paused")
    return "border-warning/40 bg-warning/10 text-amber-800 dark:text-amber-200"
  if (normalized === "not_listed") return "border-muted bg-muted/40 text-muted-foreground"
  return "border-muted bg-muted/30 text-muted-foreground"
}

function catalogCompetitionLabel(status: string) {
  const normalized = String(status ?? "").toLowerCase()
  if (normalized === "winning") return "Ganhando"
  if (normalized === "sharing_first_place") return "Dividindo 1o"
  if (normalized === "competing") return "Perdendo"
  if (normalized === "listed") return "Listado"
  if (normalized === "paused") return "Pausado"
  if (normalized === "not_listed") return "Sem exposicao"
  if (normalized === "unknown") return "Indisponivel"
  if (!normalized) return "-"
  return status || "Desconhecido"
}

function catalogCompetitionPriorityTier(row: MlCatalogCompetitionRow): number {
  const listing = String(row.status ?? "").toLowerCase()
  const c = String(row.competitionStatus ?? "").toLowerCase()
  if (listing === "paused" || c === "paused") return 100
  if (c === "winning") return 0
  if (c === "sharing_first_place") return 1
  if (c === "competing") return 2
  if (c === "listed") return 3
  if (c === "not_listed") return 4
  return 5
}

function mlShippingStep(status: string) {
  const normalized = status.toLowerCase()
  if (["delivered", "ready_to_ship", "shipped"].includes(normalized)) return 3
  if (["handling", "to_be_agreed", "pending"].includes(normalized)) return 2
  if (["cancelled", "not_delivered"].includes(normalized)) return 0
  return 1
}

function valueToneClass(value: number) {
  if (value > 0) return "text-emerald-700 dark:text-emerald-400"
  if (value < 0) return "text-destructive"
  return "text-foreground"
}

function valueBadgeClass(value: number) {
  if (value > 0)
    return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
  if (value < 0) return "bg-destructive/10 text-destructive"
  return "bg-muted text-muted-foreground"
}

function monthDateRange(year: number, month1to12: number) {
  const start = `${year}-${String(month1to12).padStart(2, "0")}-01`
  const lastDay = new Date(year, month1to12, 0).getDate()
  const end = `${year}-${String(month1to12).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

function previousMonth(year: number, month1to12: number) {
  if (month1to12 === 1) return { year: year - 1, month: 12 }
  return { year, month: month1to12 - 1 }
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`
}

/** Desloca inicio e fim pelo mesmo numero de meses (comparacao vs mes/ano anterior). */
function shiftIsoRangeByMonths(
  startIso: string,
  endIso: string,
  monthDelta: number,
): { start: string; end: string } {
  const [ys, ms, ds] = startIso.split("-").map(Number)
  const [ye, me, de] = endIso.split("-").map(Number)
  const s = new Date(ys, ms - 1 + monthDelta, ds)
  const e = new Date(ye, me - 1 + monthDelta, de)
  return { start: toIsoDate(s), end: toIsoDate(e) }
}

function summarizeInternalFinancialRange(
  txs: FinancialTransaction[],
  start: string,
  end: string,
): { revenue: number; costs: number; profit: number } {
  let revenue = 0
  let costs = 0
  for (const t of txs) {
    const d = t.date.slice(0, 10)
    if (d < start || d > end) continue
    if (t.kind === "income" && t.origin === "Venda online") revenue += t.amount
    if (t.kind === "expense") costs += t.amount
  }
  return { revenue, costs, profit: revenue - costs }
}

/** Projeção linear ate o fim do mes civil do ultimo dia do filtro. */
function computeLinearMonthProjection(
  startIso: string,
  endIso: string,
  revenue: number,
  costs: number,
  profit: number,
): {
  projectedRevenue: number
  projectedCosts: number
  projectedProfit: number
  daysInRange: number
  daysInMonth: number
} | null {
  const [y1, m1, d1] = startIso.split("-").map(Number)
  const [y2, m2, d2] = endIso.split("-").map(Number)
  const sd = new Date(y1, m1 - 1, d1)
  const ed = new Date(y2, m2 - 1, d2)
  const daysInRange = Math.max(1, Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1)
  const daysInMonth = new Date(y2, m2, 0).getDate()
  if (y1 === y2 && m1 === m2 && d1 === 1 && d2 === daysInMonth) {
    return null
  }
  const factor = daysInMonth / daysInRange
  return {
    projectedRevenue: revenue * factor,
    projectedCosts: costs * factor,
    projectedProfit: profit * factor,
    daysInRange,
    daysInMonth,
  }
}

function formatPctVsPrevious(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "0%" : "—"
  const p = ((current - previous) / Math.abs(previous)) * 100
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}% vs periodo comparado`
}

function addDays(base: Date, days: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
}

function startOfWeekMonday(base: Date) {
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(base, diff)
}

function startOfMonth(base: Date) {
  return new Date(base.getFullYear(), base.getMonth(), 1)
}

function endOfMonth(base: Date) {
  return new Date(base.getFullYear(), base.getMonth() + 1, 0)
}

function getCurrentPeriodRange(period: FinancialPeriod) {
  const now = new Date()
  if (period === "day") {
    const today = toIsoDate(now)
    return { startDate: today, endDate: today }
  }
  if (period === "week") {
    const start = startOfWeekMonday(now)
    return { startDate: toIsoDate(start), endDate: toIsoDate(addDays(start, 6)) }
  }
  return { startDate: toIsoDate(startOfMonth(now)), endDate: toIsoDate(endOfMonth(now)) }
}

function toBucketKey(dateIso: string, period: FinancialPeriod) {
  if (period === "day") return dateIso
  const date = new Date(`${dateIso}T00:00:00`)
  if (period === "week") return toIsoDate(startOfWeekMonday(date))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function bucketLabel(bucketKey: string, period: FinancialPeriod) {
  if (period === "day") {
    const date = new Date(`${bucketKey}T00:00:00`)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  }
  if (period === "week") {
    const start = new Date(`${bucketKey}T00:00:00`)
    const end = addDays(start, 6)
    return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
  }
  const [year, month] = bucketKey.split("-").map(Number)
  const date = new Date(year, (month ?? 1) - 1, 1)
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
}

function buildBucketKeys(range: { startDate?: string; endDate?: string }, period: FinancialPeriod) {
  if (!range.startDate || !range.endDate) return []

  const keys: string[] = []
  if (period === "day") {
    let current = new Date(`${range.startDate}T00:00:00`)
    const end = new Date(`${range.endDate}T00:00:00`)
    while (current <= end) {
      keys.push(toIsoDate(current))
      current = addDays(current, 1)
    }
    return keys
  }

  if (period === "week") {
    let current = startOfWeekMonday(new Date(`${range.startDate}T00:00:00`))
    const end = new Date(`${range.endDate}T00:00:00`)
    while (current <= end) {
      keys.push(toIsoDate(current))
      current = addDays(current, 7)
    }
    return keys
  }

  let current = startOfMonth(new Date(`${range.startDate}T00:00:00`))
  const end = new Date(`${range.endDate}T00:00:00`)
  while (current <= end) {
    keys.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`)
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }
  return keys
}

function formatIsoToBrDate(value?: string) {
  if (!value) return ""
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ""
  return `${match[3]}/${match[2]}/${match[1]}`
}

function normalizeBrDateInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parseBrDateToIso(value: string) {
  const normalized = value.trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function calculateDreSnapshot({
  orders,
  productByMlItemId,
  productBySku,
  transactions,
  range,
  includeMovements,
}: {
  orders: MlOrder[]
  productByMlItemId: Map<string, StockProduct>
  productBySku: Map<string, StockProduct>
  transactions: FinancialTransaction[]
  range: { start: string; end: string }
  includeMovements: boolean
}): DreSnapshot {
  let revenueConfirmed = 0
  let marketplaceFees = 0
  let shippingPaidBySeller = 0
  const shippingBonus = 0
  const returnsAmount = 0
  let productCosts = 0
  let packagingCost = 0
  let taxes = 0
  let ordersCount = 0

  const validOrders = orders.filter((order) => {
    const status = order.status.toLowerCase()
    if (status === "cancelled") return false
    const orderDate = order.dateCreated.slice(0, 10)
    return orderDate >= range.start && orderDate <= range.end
  })

  for (const order of validOrders) {
    ordersCount += 1
    const totalQty = order.items.reduce((s, i) => s + Math.max(0, i.quantity), 0)
    revenueConfirmed += Math.max(0, order.totalAmount)
    marketplaceFees += Math.max(0, order.mlFeeAmount)
    shippingPaidBySeller += Math.max(0, order.shippingCostAmount)
    taxes += Math.max(0, order.taxesAmount)
    packagingCost += totalQty * HUB_CENTRALIZE_PACKAGING_PER_ITEM

    const estimatedCost = order.items.reduce((total, item) => {
      const byItem = item.id ? productByMlItemId.get(item.id) : undefined
      const bySku = item.sku ? productBySku.get(item.sku.toLowerCase()) : undefined
      const mapped = byItem ?? bySku
      return total + (mapped?.unitCost ?? 0) * Math.max(0, item.quantity)
    }, 0)
    productCosts += estimatedCost
  }

  const netReceived = revenueConfirmed - marketplaceFees - shippingPaidBySeller + shippingBonus
  const grossProfit = netReceived - returnsAmount - productCosts - packagingCost - taxes

  let operationalExpenses = 0
  let fixedCosts = 0
  if (includeMovements) {
    const expenseTransactions = transactions.filter(
      (transaction) =>
        transaction.kind === "expense" &&
        transaction.date >= range.start &&
        transaction.date <= range.end,
    )
    operationalExpenses = expenseTransactions
      .filter((transaction) => transaction.expenseType !== "fixed")
      .reduce((total, transaction) => total + transaction.amount, 0)
    fixedCosts = expenseTransactions
      .filter((transaction) => transaction.expenseType === "fixed")
      .reduce((total, transaction) => total + transaction.amount, 0)
  }

  const netProfit = grossProfit - operationalExpenses - fixedCosts

  return {
    revenueConfirmed,
    marketplaceFees,
    shippingPaidBySeller,
    shippingBonus,
    netReceived,
    returnsAmount,
    productCosts,
    packagingCost,
    taxes,
    grossProfit,
    operationalExpenses,
    fixedCosts,
    netProfit,
    ordersCount,
  }
}

function mlShippingLabel(order: MlOrder) {
  const mode = order.shippingMode.toLowerCase()
  const logistic = order.shippingLogisticType.toLowerCase()

  if (logistic.includes("fulfillment")) return "Full"
  if (logistic.includes("self_service") || logistic.includes("same_day")) return "Flex"
  if (mode === "custom") return "Correios"
  if (mode === "me2") return "Mercado Envios"
  if (mode === "not_specified") return "A combinar"
  return order.shippingMode
}

function mlOrderStatusLabel(status: string) {
  const normalizedStatus = status.toLowerCase()
  if (normalizedStatus === "paid") return "Pago - pronto para envio"
  return status
}

function StockQuantityIndicator({ quantity }: { quantity: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex h-3 w-3 rounded-full ring-2 ring-background shadow-sm",
          stockLevelDotClass(quantity),
        )}
      />
      <span>{quantity}</span>
    </div>
  )
}

function formatElapsedSeconds(fromTimestamp: number, nowTimestamp: number) {
  const seconds = Math.max(0, Math.floor((nowTimestamp - fromTimestamp) / 1000))
  return `${seconds}s`
}

type SalesEvolutionPoint = {
  key: string
  label: string
  revenue: number
  profit: number
  orders: number
}

type OrdersFinancialSummary = {
  grossRevenue: number
  totalCosts: number
  netProfit: number
  ordersCount: number
  soldItems: number
}

type AbcProductRow = {
  productId: string
  productName: string
  sku: string
  quantitySold: number
  revenue: number
  totalCost: number
  profit: number
  marginPercent: number
  metricValue: number
  sharePercent: number
  cumulativePercent: number
  abcClass: "A" | "B" | "C"
}

type DreSnapshot = {
  revenueConfirmed: number
  marketplaceFees: number
  shippingPaidBySeller: number
  shippingBonus: number
  netReceived: number
  returnsAmount: number
  productCosts: number
  packagingCost: number
  taxes: number
  grossProfit: number
  operationalExpenses: number
  fixedCosts: number
  netProfit: number
  ordersCount: number
}

function buildSalesEvolutionData(
  transactions: FinancialTransaction[],
  movements: StockMovement[],
  options: {
    period: FinancialPeriod
    range: { startDate?: string; endDate?: string }
  },
): SalesEvolutionPoint[] {
  const bucketKeys = buildBucketKeys(options.range, options.period)
  const buckets = new Map<string, SalesEvolutionPoint>(
    bucketKeys.map((key) => [
      key,
      { key, label: bucketLabel(key, options.period), revenue: 0, profit: 0, orders: 0 },
    ]),
  )

  for (const transaction of transactions) {
    const key = toBucketKey(transaction.date, options.period)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (transaction.kind === "income" && transaction.origin === "Venda online") {
      bucket.revenue += transaction.amount
    }
    bucket.profit += transaction.kind === "income" ? transaction.amount : -transaction.amount
  }

  for (const movement of movements) {
    if (movement.type !== "sale") continue
    const key = toBucketKey(movement.date, options.period)
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.orders += 1
  }

  return Array.from(buckets.values())
}

function buildOrdersSalesEvolutionData(
  orders: MlOrder[],
  productByMlItemId: Map<string, StockProduct>,
  options: {
    period: FinancialPeriod
    range: { startDate?: string; endDate?: string }
  },
): SalesEvolutionPoint[] {
  const bucketKeys = buildBucketKeys(options.range, options.period)
  const buckets = new Map<string, SalesEvolutionPoint>(
    bucketKeys.map((key) => [
      key,
      { key, label: bucketLabel(key, options.period), revenue: 0, profit: 0, orders: 0 },
    ]),
  )

  for (const order of orders) {
    const status = order.status.toLowerCase()
    if (status === "cancelled") continue
    const orderDate = order.dateCreated.slice(0, 10)
    const key = toBucketKey(orderDate, options.period)
    const bucket = buckets.get(key)
    if (!bucket) continue

    const productCost = order.items.reduce((sum, item) => {
      const mappedProduct = productByMlItemId.get(item.id)
      return sum + (mappedProduct?.unitCost ?? 0) * Math.max(0, item.quantity)
    }, 0)
    const shippingCost = Math.max(0, order.shippingCostAmount)
    const taxes = Math.max(0, order.taxesAmount)
    const mlFee = Math.max(0, order.mlFeeAmount)
    const totalCosts = productCost + shippingCost + taxes + mlFee
    const revenue = Math.max(0, order.totalAmount)

    bucket.revenue += revenue
    bucket.profit += revenue - totalCosts
    bucket.orders += 1
  }

  return Array.from(buckets.values())
}

function buildOrdersFinancialSummary(
  orders: MlOrder[],
  productByMlItemId: Map<string, StockProduct>,
  range?: { startDate?: string; endDate?: string },
): OrdersFinancialSummary {
  const filteredOrders = orders.filter((order) => {
    const normalized = order.status.toLowerCase()
    if (normalized === "cancelled") return false
    const orderDate = order.dateCreated.slice(0, 10)
    if (range?.startDate && orderDate < range.startDate) return false
    if (range?.endDate && orderDate > range.endDate) return false
    return true
  })

  return filteredOrders.reduce<OrdersFinancialSummary>(
    (acc, order) => {
      const productCost = order.items.reduce((total, item) => {
        const mappedProduct = productByMlItemId.get(item.id)
        return total + (mappedProduct?.unitCost ?? 0) * Math.max(0, item.quantity)
      }, 0)
      const shippingCost = Math.max(0, order.shippingCostAmount)
      const taxes = Math.max(0, order.taxesAmount)
      const mlFee = Math.max(0, order.mlFeeAmount)
      const orderCosts = productCost + shippingCost + taxes + mlFee

      acc.grossRevenue += Math.max(0, order.totalAmount)
      acc.totalCosts += orderCosts
      acc.netProfit += Math.max(0, order.totalAmount) - orderCosts
      acc.ordersCount += 1
      acc.soldItems += order.items.reduce((total, item) => total + item.quantity, 0)
      return acc
    },
    {
      grossRevenue: 0,
      totalCosts: 0,
      netProfit: 0,
      ordersCount: 0,
      soldItems: 0,
    },
  )
}

function buildOrdersCostComposition(
  orders: MlOrder[],
  productByMlItemId: Map<string, StockProduct>,
  range?: { startDate?: string; endDate?: string },
) {
  const filteredOrders = orders.filter((order) => {
    const normalized = order.status.toLowerCase()
    if (normalized === "cancelled") return false
    const orderDate = order.dateCreated.slice(0, 10)
    if (range?.startDate && orderDate < range.startDate) return false
    if (range?.endDate && orderDate > range.endDate) return false
    return true
  })

  const totals = {
    products: 0,
    fees: 0,
    shipping: 0,
    taxes: 0,
    packaging: 0,
  }

  for (const order of filteredOrders) {
    const totalQty = order.items.reduce((s, i) => s + Math.max(0, i.quantity), 0)
    const productCost = order.items.reduce((sum, item) => {
      const mappedProduct = productByMlItemId.get(item.id)
      return sum + (mappedProduct?.unitCost ?? 0) * Math.max(0, item.quantity)
    }, 0)

    totals.products += productCost
    totals.fees += Math.max(0, order.mlFeeAmount)
    totals.shipping += Math.max(0, order.shippingCostAmount)
    totals.taxes += Math.max(0, order.taxesAmount)
    totals.packaging += totalQty * HUB_CENTRALIZE_PACKAGING_PER_ITEM
  }

  return [
    { categoryName: "Produtos", total: totals.products },
    { categoryName: "Taxas ML", total: totals.fees },
    { categoryName: "Envio", total: totals.shipping },
    { categoryName: "Embalagem", total: totals.packaging },
    { categoryName: "Impostos", total: totals.taxes },
  ].filter((item) => item.total > 0)
}

function finalizeAbcRows(
  groupedRows: Array<{
    productId: string
    productName: string
    sku: string
    quantitySold: number
    revenue: number
    totalCost: number
    profit: number
  }>,
  metric: "revenue" | "quantity" | "profit",
): AbcProductRow[] {
  type RowAcc = (typeof groupedRows)[number] & { rawMetric: number; metricValue: number }
  const rowsBase: RowAcc[] = groupedRows
    .map((row) => {
      const rawMetric =
        metric === "quantity" ? row.quantitySold : metric === "profit" ? row.profit : row.revenue
      return {
        ...row,
        rawMetric,
        metricValue: Math.max(0, rawMetric),
      }
    })
    .sort((a, b) => b.rawMetric - a.rawMetric)

  const totalMetric = rowsBase.reduce((total, row) => total + row.metricValue, 0)
  let cumulative = 0
  return rowsBase.map((row) => {
    const sharePercent = totalMetric > 0 ? (row.metricValue / totalMetric) * 100 : 0
    cumulative += sharePercent
    const abcClass = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C"
    const marginPercent = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0
    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      quantitySold: row.quantitySold,
      revenue: row.revenue,
      totalCost: row.totalCost,
      profit: row.profit,
      metricValue: row.metricValue,
      marginPercent,
      sharePercent,
      cumulativePercent: cumulative,
      abcClass,
    }
  })
}

function buildAbcRowsFromMovements(
  products: StockProduct[],
  movements: StockMovement[],
  metric: "revenue" | "quantity" | "profit",
): AbcProductRow[] {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const saleMovements = movements.filter((movement) => movement.type === "sale")

  const grouped = new Map<
    string,
    {
      productId: string
      productName: string
      sku: string
      quantitySold: number
      revenue: number
      totalCost: number
      profit: number
    }
  >()

  for (const movement of saleMovements) {
    const product = productMap.get(movement.productId)
    if (!product) continue
    const quantity = Math.max(0, movement.quantity)
    const saleUnit = movement.unitPrice ?? product.sellingPrice ?? 0
    const unitCost = product.unitCost ?? 0
    const revenue = saleUnit * quantity
    const totalCost = unitCost * quantity
    const profit = revenue - totalCost

    const current = grouped.get(product.id) ?? {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantitySold: 0,
      revenue: 0,
      totalCost: 0,
      profit: 0,
    }
    current.quantitySold += quantity
    current.revenue += revenue
    current.totalCost += totalCost
    current.profit += profit
    grouped.set(product.id, current)
  }

  return finalizeAbcRows(Array.from(grouped.values()), metric)
}

function buildAbcRowsFromOrders(
  orders: MlOrder[],
  productByMlItemId: Map<string, StockProduct>,
  productBySku: Map<string, StockProduct>,
  metric: "revenue" | "quantity" | "profit",
  range?: { startDate?: string; endDate?: string },
): AbcProductRow[] {
  const grouped = new Map<
    string,
    {
      productId: string
      productName: string
      sku: string
      quantitySold: number
      revenue: number
      totalCost: number
      profit: number
    }
  >()

  const validOrders = orders.filter((order) => {
    const status = order.status.toLowerCase()
    if (status === "cancelled") return false
    const orderDate = order.dateCreated.slice(0, 10)
    if (range?.startDate && orderDate < range.startDate) return false
    if (range?.endDate && orderDate > range.endDate) return false
    return true
  })

  for (const order of validOrders) {
    const orderItemCount = order.items.reduce((s, i) => s + Math.max(0, i.quantity), 0)
    const orderMlFee = Math.max(0, order.mlFeeAmount)
    const orderShipping = Math.max(0, order.shippingCostAmount)
    const orderTaxes = Math.max(0, order.taxesAmount)
    const orderOverhead = orderMlFee + orderShipping + orderTaxes

    for (const item of order.items) {
      const quantity = Math.max(0, item.quantity)
      if (quantity <= 0) continue

      const mappedByItem = item.id ? productByMlItemId.get(item.id) : undefined
      const mappedBySku = item.sku ? productBySku.get(item.sku.toLowerCase()) : undefined
      const mappedProduct = mappedByItem ?? mappedBySku

      const unitCost = mappedProduct?.unitCost ?? 0
      const revenue = Math.max(0, item.unitPrice) * quantity
      const itemShare = orderItemCount > 0 ? quantity / orderItemCount : 0
      const totalCost = unitCost * quantity + orderOverhead * itemShare
      const profit = revenue - totalCost
      const key = item.id || item.sku || item.title

      const current = grouped.get(key) ?? {
        productId: key,
        productName: item.title || mappedProduct?.name || "Produto",
        sku: item.sku || mappedProduct?.sku || "",
        quantitySold: 0,
        revenue: 0,
        totalCost: 0,
        profit: 0,
      }
      current.quantitySold += quantity
      current.revenue += revenue
      current.totalCost += totalCost
      current.profit += profit
      grouped.set(key, current)
    }
  }

  return finalizeAbcRows(Array.from(grouped.values()), metric)
}

type HomeEvolutionRow = {
  key: string
  monthLabel: string
  income: number
  expense: number
  result: number
}

/** Mesma janela de meses que `monthlyEvolution` (transacoes), mas agrega pedidos ML. */
function monthlyEvolutionFromMlOrders(
  orders: MlOrder[],
  productByMlItemId: Map<string, StockProduct>,
  monthsToShow = 6,
): HomeEvolutionRow[] {
  const now = new Date()
  const keys: string[] = []
  const map = new Map<string, { income: number; expense: number }>()
  for (let index = monthsToShow - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    keys.push(key)
    map.set(key, { income: 0, expense: 0 })
  }

  for (const order of orders) {
    const status = order.status.toLowerCase()
    if (status === "cancelled") continue
    const key = order.dateCreated.slice(0, 7)
    if (!map.has(key)) continue

    const productCost = order.items.reduce((total, item) => {
      const mappedProduct = productByMlItemId.get(item.id)
      return total + (mappedProduct?.unitCost ?? 0) * Math.max(0, item.quantity)
    }, 0)
    const shippingCost = Math.max(0, order.shippingCostAmount)
    const taxes = Math.max(0, order.taxesAmount)
    const mlFee = Math.max(0, order.mlFeeAmount)
    const orderCosts = productCost + shippingCost + taxes + mlFee
    const revenue = Math.max(0, order.totalAmount)

    const bucket = map.get(key)
    if (!bucket) continue
    bucket.income += revenue
    bucket.expense += orderCosts
  }

  return keys.map((key) => {
    const b = map.get(key) ?? { income: 0, expense: 0 }
    const [y, m] = key.split("-").map(Number)
    const dt = new Date(y, (m ?? 1) - 1, 1)
    return {
      key,
      monthLabel: dt.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      income: b.income,
      expense: b.expense,
      result: b.income - b.expense,
    }
  })
}

function StockLevelLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-none border bg-muted/30 px-3 py-2 text-xs">
      <span className="font-medium text-muted-foreground">Volume em estoque:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-red-600 ring-2 ring-background shadow-sm" />0
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-amber-400 ring-2 ring-background shadow-sm" />1 a
        10
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-emerald-600 ring-2 ring-background shadow-sm" />
        acima de 10
      </span>
    </div>
  )
}

export function FinancialDashboard() {
  const { user, isLoaded } = useUser()
  const userId = user?.id

  const [activeModule, setActiveModule] = useState<ModuleKey>("home")
  const [activeFinanceSection, setActiveFinanceSection] = useState<FinanceSection>("overview")
  const [activeStockSection, setActiveStockSection] = useState<StockSection>("overview")
  const [activeMlSection, setActiveMlSection] = useState<MlSection>("listings")
  const [activeMlSidebarGroup, setActiveMlSidebarGroup] = useState<MlSidebarGroup>("anuncios")
  const [activeHunterSection, setActiveHunterSection] = useState<HunterSection>("analise-anuncio")
  const [period, setPeriod] = useState<FinancialPeriod>("month")
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    kind: "all",
    ...getCurrentPeriodRange("month"),
  }))
  const [isSetupDone, setIsSetupDone] = useState(false)
  const [launchSaving, setLaunchSaving] = useState(false)
  const [launchFeedback, setLaunchFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const [launchForm, setLaunchForm] = useState({
    kind: "expense" as FinancialTransaction["kind"],
    amount: "",
    date: today,
    description: "",
    categoryId: "" as Id<"categories"> | "",
    origin: "",
    expenseType: "variable" as ExpenseType,
    periodicity: "one_time" as TransactionPeriodicity,
    paymentMethod: "pix" as PaymentMethod,
    installmentCount: "1",
    firstChargeDate: today,
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
    periodicity: "one_time" as TransactionPeriodicity,
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
  const [manualStockForm, setManualStockForm] = useState({
    name: "",
    quantity: "",
    unitCost: "",
    supplier: "",
    manualEntryDate: today,
    location: "in_stock_physical" as
      | "in_stock_physical"
      | "in_transit"
      | "awaiting_delivery"
      | "returned_supplier",
    estimatedArrival: "",
    observations: "",
  })
  const [showManualStockForm, setShowManualStockForm] = useState(false)
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
  const [mlDisconnecting, setMlDisconnecting] = useState(false)
  const [mlListingsCount, setMlListingsCount] = useState<number | null>(null)
  const [mlListingsLoading, setMlListingsLoading] = useState(false)
  const [mlOrdersCount, setMlOrdersCount] = useState<number | null>(null)
  const [mlOrders, setMlOrders] = useState<MlOrder[]>([])
  const [mlOrdersLoading, setMlOrdersLoading] = useState(false)
  const [mlOrdersSearch, setMlOrdersSearch] = useState("")
  const [mlOrdersStatusFilter, setMlOrdersStatusFilter] = useState("all")
  const [mlOrdersSkuFilter, setMlOrdersSkuFilter] = useState("")
  const [mlOrdersPeriodDate, setMlOrdersPeriodDate] = useState("")
  const [mlOrdersShippingFilter, setMlOrdersShippingFilter] = useState("all")
  const [mlOrdersSortBy, setMlOrdersSortBy] = useState("date_desc")
  const [mlOrdersOnlyNoSku, setMlOrdersOnlyNoSku] = useState(false)

  /** Evita loop infinito de fetch quando a API devolve lista vazia (length === 0 re-disparava o effect). */
  const mlListingsSectionBootstrapped = useRef(false)
  const mlCatalogSectionBootstrapped = useRef(false)
  const mlOrdersSectionBootstrapped = useRef(false)
  const [mlMetrics, setMlMetrics] = useState<{
    listingsTotal: number
    ordersTotal: number
    grossAmountSample: number
    sampleSize: number
    completedOrdersSample: number
    cancelledOrdersSample: number
    averageTicketSample: number
    lastOrderDate: string | null
  } | null>(null)
  const [mlMetricsLoading, setMlMetricsLoading] = useState(false)
  const [mlError, setMlError] = useState<string | null>(null)
  const [mlInfo, setMlInfo] = useState<string | null>(null)
  const [mlSyncingStock, setMlSyncingStock] = useState(false)
  const [mlLastSyncAt, setMlLastSyncAt] = useState<number | null>(null)
  const [mlLastSyncDurationMs, setMlLastSyncDurationMs] = useState<number | null>(null)
  const [mlNowTimestamp, setMlNowTimestamp] = useState<number>(Date.now())
  const [analysisItemId, setAnalysisItemId] = useState<string | null>(null)
  const [mlCatalogCompetitionLoading, setMlCatalogCompetitionLoading] = useState(false)
  const [mlCatalogCompetitionSummary, setMlCatalogCompetitionSummary] =
    useState<MlCatalogCompetitionSummary | null>(null)
  const [mlCatalogCompetitionRows, setMlCatalogCompetitionRows] = useState<
    MlCatalogCompetitionRow[]
  >([])
  const [mlCatalogSearchTerm, setMlCatalogSearchTerm] = useState("")
  const [mlCatalogStatusFilter, setMlCatalogStatusFilter] = useState("all")
  const [mlCatalogSortBy, setMlCatalogSortBy] = useState("priority_desc")
  const [mlOrderCostAnalysis, setMlOrderCostAnalysis] = useState<OrderCostAnalysis | null>(null)
  const [financeOrdersTitleFilter, setFinanceOrdersTitleFilter] = useState("")
  const [financeOrdersSkuFilter, setFinanceOrdersSkuFilter] = useState("")
  const [financeOrdersStatusFilter, setFinanceOrdersStatusFilter] = useState("all")
  const [financeOverviewTab, setFinanceOverviewTab] = useState<"sales" | "ranking">("sales")
  const [financeOverviewCompare, setFinanceOverviewCompare] = useState<
    "none" | "prev_month" | "prev_year"
  >("none")
  const [financeOverviewProjection, setFinanceOverviewProjection] = useState<"none" | "month">(
    "none",
  )
  const [financeAbcMetric, setFinanceAbcMetric] = useState<"revenue" | "quantity" | "profit">(
    "revenue",
  )
  const [historySearch, setHistorySearch] = useState("")
  const [historyKindFilter, setHistoryKindFilter] = useState<"all" | "income" | "expense">("all")
  const [historyExpenseTypeFilter, setHistoryExpenseTypeFilter] = useState<
    "all" | "fixed" | "variable"
  >("all")
  const [historyPeriodicityFilter, setHistoryPeriodicityFilter] = useState<
    "all" | TransactionPeriodicity
  >("all")
  const [historyStartDate, setHistoryStartDate] = useState("")
  const [historyEndDate, setHistoryEndDate] = useState("")
  const [anexosByLancamentoId, setAnexosByLancamentoId] = useState<
    Record<string, AnexoLancamento[]>
  >({})
  const [anexosModalLancamento, setAnexosModalLancamento] = useState<{
    id: string
    description: string
  } | null>(null)
  const [launchFormAnexos, setLaunchFormAnexos] = useState<AnexoLancamento[]>([])
  const [returnModal, setReturnModal] = useState<{
    transaction: FinancialTransaction
  } | null>(null)
  const [returnForm, setReturnForm] = useState({
    reason: "defect" as "defect" | "wrong_item" | "regret" | "other",
    note: "",
    productId: "" as Id<"stockProducts"> | "",
    creditAmount: "",
  })
  const [dreMonth, setDreMonth] = useState(new Date().getMonth() + 1)
  const [dreYear, setDreYear] = useState(new Date().getFullYear())
  const [dreIncludeMovements, setDreIncludeMovements] = useState(true)
  const [dreComparePrevious, setDreComparePrevious] = useState(false)

  const [mpBalance, setMpBalance] = useState<{
    availableBalance: number
    unavailableBalance: number
    totalAmount: number
    currencyId: string
  } | null>(null)
  const [mpTransactions, setMpTransactions] = useState<
    Array<{
      id: string
      date: string
      description: string
      amount: number
      type: "credit" | "debit"
      status: string
    }>
  >([])
  const [mpLoading, setMpLoading] = useState(false)
  const [mpError, setMpError] = useState<string | null>(null)
  const [mpBalanceUnavailable, setMpBalanceUnavailable] = useState(false)
  const [mpSaldoOculto, setMpSaldoOculto] = useState(false)
  const [mpExtratoVerTudo, setMpExtratoVerTudo] = useState(false)

  type DayGroupUI = {
    date: string
    dayLabel: string
    total: number
    releases: Array<{
      sourceId: string
      releaseDate: string
      amount: number
    }>
  }
  const [mpDayGroups, setMpDayGroups] = useState<DayGroupUI[]>([])
  const [mpFuturePendingTotal, setMpFuturePendingTotal] = useState(0)
  const [mpFutureLoading, setMpFutureLoading] = useState(false)
  const [mpFutureStatus, setMpFutureStatus] = useState<string | null>(null)
  const [mpExpandedDays, setMpExpandedDays] = useState<Set<string>>(new Set())

  const fetchMpData = useCallback(async () => {
    setMpLoading(true)
    setMpError(null)
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/mp/balance", { cache: "no-store" }),
        fetch("/api/mp/transactions?limit=30", { cache: "no-store" }),
      ])

      const balJson = await balRes.json()
      const txJson = await txRes.json()

      if (balJson.ok && balJson.data) {
        const d = balJson.data as {
          balanceUnavailable?: boolean
          availableBalance?: number
          unavailableBalance?: number
          totalAmount?: number
          currencyId?: string
        }
        if (d.balanceUnavailable) {
          setMpBalance(null)
          setMpBalanceUnavailable(true)
        } else {
          setMpBalanceUnavailable(false)
          setMpBalance({
            availableBalance: d.availableBalance ?? 0,
            unavailableBalance: d.unavailableBalance ?? 0,
            totalAmount: d.totalAmount ?? 0,
            currencyId: d.currencyId ?? "BRL",
          })
        }
      } else if (!balJson.ok) {
        console.error("[mp] balance error:", balJson.error)
        setMpBalanceUnavailable(false)
        setMpError(balJson.error ?? "Erro ao buscar saldo")
      }

      if (txJson.ok) {
        setMpTransactions(txJson.data ?? [])
      } else {
        console.error("[mp] transactions error:", txJson.error)
      }
    } catch (err) {
      console.error("[mp] fetch error:", err)
      setMpError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setMpLoading(false)
    }
  }, [])

  const fetchFutureReleases = useCallback(async () => {
    setMpFutureLoading(true)
    setMpFutureStatus(null)
    try {
      const res = await fetch("/api/mp/future-releases", { cache: "no-store" })
      const json = await res.json()

      if (!json.ok) {
        setMpDayGroups([])
        setMpFuturePendingTotal(0)
        const msg = json.details
          ? `${json.error ?? "Erro"} — ${json.details}`
          : (json.error ?? "Erro ao buscar lancamentos futuros")
        setMpFutureStatus(msg)
        return
      }

      const groups: DayGroupUI[] = Array.isArray(json.data) ? json.data : []
      setMpDayGroups(groups)
      setMpFuturePendingTotal(groups.reduce((s, g) => s + g.total, 0))
      if (groups.length > 0) {
        setMpExpandedDays(new Set([groups[0].date]))
      }
    } catch (err) {
      console.error("[mp] future releases error:", err)
      setMpDayGroups([])
      setMpFuturePendingTotal(0)
      setMpFutureStatus(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setMpFutureLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeModule !== "finance" || activeFinanceSection !== "cashflow") return
    void fetchMpData()
    void fetchFutureReleases()
  }, [activeModule, activeFinanceSection, fetchMpData, fetchFutureReleases])

  const mpFutureAPagarTotal = 0

  /** IDs de pagamentos que ainda entram em "lancamentos futuros" (evita somar credito no extrato + net a receber). */
  const mpFutureReleaseIds = useMemo(
    () => new Set(mpDayGroups.flatMap((g) => g.releases.map((r) => r.sourceId))),
    [mpDayGroups],
  )

  const mpExtratoLiquidoSemDuplicarFuturo = useMemo(() => {
    let entradas = 0
    let saidas = 0
    for (const t of mpTransactions) {
      if (t.type === "debit") saidas += t.amount
      else if (!mpFutureReleaseIds.has(t.id)) entradas += t.amount
    }
    return entradas - saidas
  }, [mpTransactions, mpFutureReleaseIds])

  /** Liberacoes com data local = hoje (momento da consulta no navegador); nao soma o restante do mes. */
  const mpFuturePendingAteHoje = useMemo(() => {
    const now = new Date()
    let s = 0
    for (const g of mpDayGroups) {
      for (const r of g.releases) {
        const d = new Date(r.releaseDate)
        if (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        ) {
          s += r.amount
        }
      }
    }
    return s
  }, [mpDayGroups])

  const mpSaldoEstimadoSemApi = useMemo(
    () => mpExtratoLiquidoSemDuplicarFuturo + mpFuturePendingAteHoje - mpFutureAPagarTotal,
    [mpExtratoLiquidoSemDuplicarFuturo, mpFuturePendingAteHoje],
  )

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
  const applyKanbanMoveMutation = useMutation(api.stock.applyKanbanMove)
  const deleteProduct = useMutation(api.stock.deleteProduct)
  const addMovement = useMutation(api.stock.addMovement)
  const syncStockFromMercadoLivre = useMutation(api.stock.syncFromMercadoLivre)
  const setProductKanbanHidden = useMutation(api.stock.setProductKanbanHidden)
  const addManualStockEntryMutation = useMutation(api.stock.addManualStockEntry)
  const addExpenseWithPayment = useMutation(api.finance.addExpenseWithPayment)
  const generateAttachmentUploadUrl = useMutation(api.finance.generateAttachmentUploadUrl)
  const registerTransactionAttachment = useMutation(api.finance.registerTransactionAttachment)
  const deleteTransactionAttachment = useMutation(api.finance.deleteTransactionAttachment)
  const markInstallmentPaidMutation = useMutation(api.finance.markInstallmentPaid)
  const startReturnForTransactionMutation = useMutation(api.finance.startReturnForTransaction)

  useEffect(() => {
    if (!userId || isSetupDone) return
    void ensureEcommerceSetup({ userId }).then(() => setIsSetupDone(true))
  }, [ensureEcommerceSetup, isSetupDone, userId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mlErrorCode = params.get("ml_error")
    const mlConnected = params.get("ml_connected")

    if (!mlErrorCode && !mlConnected) return

    setActiveModule("mercadolivre")

    if (mlConnected === "1") {
      setMlInfo("Conta do Mercado Livre conectada com sucesso.")
      setMlError(null)
    }

    if (mlErrorCode) {
      const errorMap: Record<string, string> = {
        configuracao_oauth:
          "Configuracao OAuth incompleta. Confira MERCADO_LIVRE_CLIENT_ID, SECRET e REDIRECT_URI.",
        falha_conexao: "Nao foi possivel iniciar a conexao com o Mercado Livre.",
        callback_sem_code: "Retorno do Mercado Livre sem codigo de autorizacao.",
        state_invalido: "Falha de seguranca no OAuth (state invalido). Tente conectar novamente.",
        falha_callback: "Nao foi possivel concluir a autenticacao do Mercado Livre.",
      }

      setMlInfo(null)
      setMlError(errorMap[mlErrorCode] ?? `Erro no Mercado Livre: ${mlErrorCode}`)
    }

    const cleanUrl = `${window.location.pathname}`
    window.history.replaceState({}, "", cleanUrl)
  }, [])

  useEffect(() => {
    if (activeModule !== "mercadolivre") return

    const load = async () => {
      setMlLoading(true)
      setMlError(null)
      try {
        const response = await fetch("/api/ml/account", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok || !payload.ok) {
          const details =
            typeof payload.details === "string"
              ? ` (${payload.details})`
              : payload.details
                ? ` (${JSON.stringify(payload.details)})`
                : ""
          throw new Error((payload.error ?? "Falha ao carregar status do Mercado Livre.") + details)
        }
        const connectionData = payload.data as MlConnectionStatus
        setMlConnectionStatus(connectionData)
        if (connectionData.connected) {
          await loadMlOverviewCards()
        }
      } catch (error) {
        setMlError(
          error instanceof Error ? error.message : "Erro ao consultar conta Mercado Livre.",
        )
      } finally {
        setMlLoading(false)
      }
    }

    void load()
  }, [activeModule])

  useEffect(() => {
    if (activeModule !== "mercadolivre" || !mlConnectionStatus?.connected || !userId) return
    void syncStockWithMl()
    void loadMlOverviewCards()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when ML module/connection/user gate changes; sync fns omitted from deps intentionally
  }, [activeModule, mlConnectionStatus?.connected, userId])

  useEffect(() => {
    if ((activeModule !== "finance" && activeModule !== "home") || !userId) return

    const loadOrdersForFinancial = async () => {
      try {
        const connectionResponse = await fetch("/api/ml/account", { cache: "no-store" })
        const connectionPayload = await connectionResponse.json()
        if (!connectionResponse.ok || !connectionPayload.ok || !connectionPayload.data?.connected) {
          return
        }

        await loadMlOrders()
      } catch {
        // Keep financial module resilient when ML integration is unavailable.
      }
    }

    void loadOrdersForFinancial()
  }, [activeModule, userId])

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
        periodicity: item.periodicity,
        paymentMethod: item.paymentMethod,
        installmentPlanId: item.installmentPlanId,
        installmentIndex: item.installmentIndex,
        installmentCount: item.installmentCount,
        payStatus: item.payStatus,
        linkedSourceTransactionId: item.linkedSourceTransactionId,
      })),
    [financeData?.transactions],
  )

  const products = useMemo<StockProduct[]>(
    () =>
      (stockData?.products ?? []).map((item) => ({
        id: item._id,
        name: item.name,
        sku: item.sku,
        mlItemId: item.mlItemId,
        imageUrl: item.imageUrl,
        category: item.category,
        quantity: item.quantity,
        minStock: item.minStock,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
        kanbanStatus: item.kanbanStatus,
        kanbanNote: item.kanbanNote,
        estimatedArrival: item.estimatedArrival,
        kanbanHidden: item.kanbanHidden,
        supplier: item.supplier,
      })),
    [stockData?.products],
  )

  const kanbanProducts = useMemo<KanbanProduct[]>(
    () =>
      products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        mlItemId: p.mlItemId,
        imageUrl: p.imageUrl,
        category: p.category,
        quantity: p.quantity,
        minStock: p.minStock,
        unitCost: p.unitCost,
        sellingPrice: p.sellingPrice,
        kanbanStatus: p.kanbanStatus ?? (p.quantity > 0 ? "in_stock" : "planned"),
        kanbanNote: p.kanbanNote,
        estimatedArrival: p.estimatedArrival,
        kanbanHidden: p.kanbanHidden,
        supplier: p.supplier,
      })),
    [products],
  )

  const kanbanTimelineEvents = useMemo<ProductKanbanEventRow[]>(
    () =>
      (stockData?.kanbanEvents ?? []).map((e) => ({
        id: e._id,
        productId: e.productId,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt,
      })),
    [stockData?.kanbanEvents],
  )

  const attachmentCountByTransaction = useMemo(() => {
    const m: Record<string, number> = {}
    for (const row of financeData?.transactionAttachments ?? []) {
      const k = row.transactionId as string
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }, [financeData?.transactionAttachments])

  const returnBySourceId = useMemo(() => {
    const m = new Map<string, NonNullable<typeof financeData>["transactionReturns"][number]>()
    for (const r of financeData?.transactionReturns ?? []) {
      m.set(r.sourceTransactionId as string, r)
    }
    return m
  }, [financeData?.transactionReturns])

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
  const productMapByMlItemId = useMemo(
    () =>
      new Map(
        products
          .filter((product) => product.mlItemId)
          .map((product) => [product.mlItemId as string, product]),
      ),
    [products],
  )
  const productMapBySku = useMemo(
    () =>
      new Map(
        products
          .filter((product) => product.sku)
          .map((product) => [product.sku.toLowerCase(), product]),
      ),
    [products],
  )
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
  const historyTransactions = useMemo(() => {
    const search = historySearch.trim().toLowerCase()
    return transactions
      .filter((transaction) => {
        if (historyStartDate && transaction.date < historyStartDate) return false
        if (historyEndDate && transaction.date > historyEndDate) return false
        if (historyKindFilter !== "all" && transaction.kind !== historyKindFilter) return false
        if (
          historyExpenseTypeFilter !== "all" &&
          transaction.kind === "expense" &&
          (transaction.expenseType ?? "variable") !== historyExpenseTypeFilter
        ) {
          return false
        }
        if (
          historyPeriodicityFilter !== "all" &&
          (transaction.periodicity ?? "one_time") !== historyPeriodicityFilter
        ) {
          return false
        }
        if (!search) return true
        const categoryName = categoryMap.get(transaction.categoryId)?.name?.toLowerCase() ?? ""
        return (
          transaction.description.toLowerCase().includes(search) ||
          (transaction.origin ?? "").toLowerCase().includes(search) ||
          categoryName.includes(search)
        )
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [
    categoryMap,
    historyEndDate,
    historyExpenseTypeFilter,
    historyKindFilter,
    historyPeriodicityFilter,
    historySearch,
    historyStartDate,
    transactions,
  ])
  const historySummary = useMemo(() => {
    const entries = historyTransactions
      .filter((transaction) => transaction.kind === "income")
      .reduce((total, transaction) => total + transaction.amount, 0)
    const fixedCost = historyTransactions
      .filter(
        (transaction) => transaction.kind === "expense" && transaction.expenseType === "fixed",
      )
      .reduce((total, transaction) => total + transaction.amount, 0)
    const operationalCost = historyTransactions
      .filter(
        (transaction) => transaction.kind === "expense" && transaction.expenseType !== "fixed",
      )
      .reduce((total, transaction) => total + transaction.amount, 0)
    const recurring = historyTransactions.filter(
      (transaction) => (transaction.periodicity ?? "one_time") !== "one_time",
    ).length
    return { entries, fixedCost, operationalCost, recurring }
  }, [historyTransactions])
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
  const forecastReport = useMemo(() => forecastFinancialTrend(transactions, 4, 6), [transactions])
  const forecastMaxValue = Math.max(
    ...forecastReport.map((item) =>
      Math.max(item.incomeForecast, item.expenseForecast, Math.abs(item.profitForecast)),
    ),
    1,
  )

  const salesInFilter = filteredTransactions
    .filter((item) => item.kind === "income" && item.origin === "Venda online")
    .reduce((total, item) => total + item.amount, 0)
  const expensesInFilter = filteredTransactions
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + item.amount, 0)
  const operatingResult = salesInFilter - expensesInFilter
  const costBreakdown = useMemo(
    () => calculateCostBreakdown(filteredTransactions, categories),
    [filteredTransactions, categories],
  )

  const stockSummary = useMemo(() => {
    const totalProducts = products.length
    const totalUnits = products.reduce((total, item) => total + item.quantity, 0)
    const lowStockCount = products.filter((item) => item.quantity <= item.minStock).length
    const stockValue = products.reduce((total, item) => total + item.quantity * item.unitCost, 0)
    return { totalProducts, totalUnits, lowStockCount, stockValue }
  }, [products])
  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        if (filters.startDate && movement.date < filters.startDate) return false
        if (filters.endDate && movement.date > filters.endDate) return false
        return true
      }),
    [filters.endDate, filters.startDate, movements],
  )
  const productChampions = useMemo(
    () => calculateProductChampions(products, filteredMovements, 5),
    [filteredMovements, products],
  )
  const soldUnitsInFilter = useMemo(
    () =>
      filteredMovements
        .filter((movement) => movement.type === "sale")
        .reduce((total, movement) => total + movement.quantity, 0),
    [filteredMovements],
  )
  const salesCountInFilter = useMemo(
    () => filteredMovements.filter((movement) => movement.type === "sale").length,
    [filteredMovements],
  )
  const costComposition = useMemo(() => {
    const fromOrders = buildOrdersCostComposition(mlOrders, productMapByMlItemId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
    })
    if (fromOrders.length > 0) {
      return fromOrders
    }
    return expensesByCategory(filteredTransactions, categories)
  }, [
    categories,
    filteredTransactions,
    filters.endDate,
    filters.startDate,
    mlOrders,
    productMapByMlItemId,
  ])
  const costCompositionTotal = useMemo(
    () => costComposition.reduce((sum, item) => sum + item.total, 0),
    [costComposition],
  )
  const ordersFinancialSummary = useMemo(
    () =>
      buildOrdersFinancialSummary(mlOrders, productMapByMlItemId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    [filters.endDate, filters.startDate, mlOrders, productMapByMlItemId],
  )
  const hasOrdersFinancialData = ordersFinancialSummary.ordersCount > 0
  const salesEvolution = useMemo(() => {
    const options = {
      period: "day" as FinancialPeriod,
      range: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    }
    if (hasOrdersFinancialData) {
      return buildOrdersSalesEvolutionData(mlOrders, productMapByMlItemId, options)
    }
    return buildSalesEvolutionData(filteredTransactions, filteredMovements, options)
  }, [
    filteredMovements,
    filteredTransactions,
    filters.endDate,
    filters.startDate,
    hasOrdersFinancialData,
    mlOrders,
    productMapByMlItemId,
  ])
  const salesInFilterFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.grossRevenue
    : salesInFilter
  const expensesInFilterFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.totalCosts
    : expensesInFilter
  const operatingResultFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.netProfit
    : operatingResult
  const soldItemsFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.soldItems
    : soldUnitsInFilter
  const salesCountFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.ordersCount
    : salesCountInFilter
  const operatingMarginFinal =
    salesInFilterFinal > 0 ? (operatingResultFinal / salesInFilterFinal) * 100 : 0
  const ticketMedioFinal = salesCountFinal > 0 ? salesInFilterFinal / salesCountFinal : 0

  const homeDreSnapshot = useMemo(() => {
    if (!filters.startDate || !filters.endDate) return null
    return calculateDreSnapshot({
      orders: mlOrders,
      productByMlItemId: productMapByMlItemId,
      productBySku: productMapBySku,
      transactions,
      range: { start: filters.startDate, end: filters.endDate },
      includeMovements: true,
    })
  }, [
    filters.endDate,
    filters.startDate,
    mlOrders,
    productMapByMlItemId,
    productMapBySku,
    transactions,
  ])
  const homeNetProfit = homeDreSnapshot?.netProfit ?? operatingResultFinal
  const homePeriodLabel = useMemo(() => {
    if (filters.startDate && filters.endDate) {
      return `${formatDate(filters.startDate)} – ${formatDate(filters.endDate)}`
    }
    return "Periodo atual"
  }, [filters.endDate, filters.startDate])

  const homeCurrentMonthOrders = useMemo(() => {
    const d = new Date()
    const { start, end } = monthDateRange(d.getFullYear(), d.getMonth() + 1)
    return buildOrdersFinancialSummary(mlOrders, productMapByMlItemId, {
      startDate: start,
      endDate: end,
    })
  }, [mlOrders, productMapByMlItemId])

  /** Evita repetir o mesmo bloco de pedidos ML quando o filtro ja e o mes civil corrente. */
  const homeFilterMatchesCurrentMonth = useMemo(() => {
    if (!filters.startDate || !filters.endDate) return false
    const d = new Date()
    const { start, end } = monthDateRange(d.getFullYear(), d.getMonth() + 1)
    return filters.startDate === start && filters.endDate === end
  }, [filters.endDate, filters.startDate])

  const homeOrdersEvolution = useMemo(
    () => monthlyEvolutionFromMlOrders(mlOrders, productMapByMlItemId, 6),
    [mlOrders, productMapByMlItemId],
  )

  const homeEvolutionPreview = useMemo((): HomeEvolutionRow[] => {
    const fromOrders = homeOrdersEvolution.slice(-4)
    if (hasOrdersFinancialData && fromOrders.some((p) => p.income > 0 || p.expense > 0)) {
      return fromOrders
    }
    return evolutionReport.slice(-4).map((p, i) => ({
      key: `int-${p.monthLabel}-${i}`,
      monthLabel: p.monthLabel,
      income: p.income,
      expense: p.expense,
      result: p.result,
    }))
  }, [evolutionReport, hasOrdersFinancialData, homeOrdersEvolution])

  const homeProductChampions = useMemo(() => {
    if (hasOrdersFinancialData) {
      const rows = buildAbcRowsFromOrders(
        mlOrders,
        productMapByMlItemId,
        productMapBySku,
        "profit",
        { startDate: filters.startDate, endDate: filters.endDate },
      )
      return rows
        .filter((r) => r.profit > 0)
        .slice(0, 5)
        .map((r) => ({
          productId: r.productId,
          productName: r.productName,
          unitsSold: r.quantitySold,
          revenue: r.revenue,
          profit: r.profit,
          marginPercent: r.marginPercent,
        }))
    }
    return productChampions
  }, [
    filters.endDate,
    filters.startDate,
    hasOrdersFinancialData,
    mlOrders,
    productChampions,
    productMapByMlItemId,
    productMapBySku,
  ])

  const comparePeriodOverview = useMemo(() => {
    if (financeOverviewCompare === "none" || !filters.startDate || !filters.endDate) return null
    const monthsBack = financeOverviewCompare === "prev_month" ? -1 : -12
    const { start, end } = shiftIsoRangeByMonths(filters.startDate, filters.endDate, monthsBack)
    const subtitle =
      financeOverviewCompare === "prev_month"
        ? "Mesmo intervalo, 1 mes antes"
        : "Mesmo intervalo, 1 ano antes"
    if (hasOrdersFinancialData) {
      const s = buildOrdersFinancialSummary(mlOrders, productMapByMlItemId, {
        startDate: start,
        endDate: end,
      })
      return {
        revenue: s.grossRevenue,
        costs: s.totalCosts,
        profit: s.netProfit,
        ordersCount: s.ordersCount,
        rangeLabel: `${formatIsoToBrDate(start)} – ${formatIsoToBrDate(end)}`,
        subtitle,
      }
    }
    const internal = summarizeInternalFinancialRange(transactions, start, end)
    return {
      revenue: internal.revenue,
      costs: internal.costs,
      profit: internal.profit,
      ordersCount: 0,
      rangeLabel: `${formatIsoToBrDate(start)} – ${formatIsoToBrDate(end)}`,
      subtitle,
    }
  }, [
    financeOverviewCompare,
    filters.endDate,
    filters.startDate,
    hasOrdersFinancialData,
    mlOrders,
    productMapByMlItemId,
    transactions,
  ])

  const monthProjectionOverview = useMemo(() => {
    if (financeOverviewProjection !== "month" || !filters.startDate || !filters.endDate) {
      return null
    }
    return computeLinearMonthProjection(
      filters.startDate,
      filters.endDate,
      salesInFilterFinal,
      expensesInFilterFinal,
      operatingResultFinal,
    )
  }, [
    financeOverviewProjection,
    filters.endDate,
    filters.startDate,
    expensesInFilterFinal,
    operatingResultFinal,
    salesInFilterFinal,
  ])

  const financeAccountLabel =
    mlConnectionStatus?.connected && mlConnectionStatus.mlNickname
      ? mlConnectionStatus.mlNickname
      : "BranchCommerce"

  const financeDetailedOrders = useMemo(() => {
    const normalizedTitle = financeOrdersTitleFilter.trim().toLowerCase()
    const normalizedSku = financeOrdersSkuFilter.trim().toLowerCase()
    const statusFilter = financeOrdersStatusFilter.toLowerCase()

    return mlOrders
      .filter((order) => {
        const orderDate = order.dateCreated.slice(0, 10)
        if (filters.startDate && orderDate < filters.startDate) return false
        if (filters.endDate && orderDate > filters.endDate) return false
        if (statusFilter !== "all" && order.status.toLowerCase() !== statusFilter) return false
        if (normalizedTitle) {
          const titleMatch = order.items.some((item) =>
            item.title.toLowerCase().includes(normalizedTitle),
          )
          if (!titleMatch) return false
        }
        if (normalizedSku) {
          const skuMatch = order.items.some((item) =>
            item.sku.toLowerCase().includes(normalizedSku),
          )
          if (!skuMatch) return false
        }
        return true
      })
      .map((order) => {
        const productCost = order.items.reduce((total, item) => {
          const byItem = item.id ? productMapByMlItemId.get(item.id) : undefined
          const bySku = item.sku ? productMapBySku.get(item.sku.toLowerCase()) : undefined
          const mapped = byItem ?? bySku
          return total + (mapped?.unitCost ?? 0) * Math.max(0, item.quantity)
        }, 0)
        const shipping = Math.max(0, order.shippingCostAmount)
        const mlFee = Math.max(0, order.mlFeeAmount)
        const taxes = Math.max(0, order.taxesAmount)
        const profit = order.totalAmount - productCost - shipping - mlFee - taxes
        const margin = order.totalAmount > 0 ? (profit / order.totalAmount) * 100 : 0
        return {
          id: order.id,
          orderDate: order.dateCreated,
          status: order.status,
          totalAmount: order.totalAmount,
          profit,
          margin,
          title: order.items[0]?.title ?? "Item sem titulo",
          sku: order.items[0]?.sku ?? "",
        }
      })
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
  }, [
    filters.endDate,
    filters.startDate,
    financeOrdersSkuFilter,
    financeOrdersStatusFilter,
    financeOrdersTitleFilter,
    mlOrders,
    productMapByMlItemId,
    productMapBySku,
  ])

  const filteredCatalogCompetitionRows = useMemo(() => {
    const term = mlCatalogSearchTerm.trim().toLowerCase()
    const statusFilter = mlCatalogStatusFilter.toLowerCase()

    const rows = mlCatalogCompetitionRows.filter((row) => {
      if (statusFilter !== "all" && row.competitionStatus.toLowerCase() !== statusFilter)
        return false
      if (!term) return true
      return (
        row.title.toLowerCase().includes(term) ||
        row.itemId.toLowerCase().includes(term) ||
        (row.catalogProductId ?? "").toLowerCase().includes(term)
      )
    })

    rows.sort((a, b) => {
      if (mlCatalogSortBy === "priority_desc") {
        const ta = catalogCompetitionPriorityTier(a)
        const tb = catalogCompetitionPriorityTier(b)
        if (ta !== tb) return ta - tb
        return b.price - a.price
      }
      const diffA = a.price - (a.winnerPrice ?? a.price)
      const diffB = b.price - (b.winnerPrice ?? b.price)
      if (mlCatalogSortBy === "difference_asc") return diffA - diffB
      if (mlCatalogSortBy === "price_desc") return b.price - a.price
      if (mlCatalogSortBy === "price_asc") return a.price - b.price
      return diffB - diffA
    })

    return rows
  }, [mlCatalogCompetitionRows, mlCatalogSearchTerm, mlCatalogSortBy, mlCatalogStatusFilter])

  const exportCatalogCompetitionCsv = () => {
    const header = [
      "item_id",
      "titulo",
      "status_competicao",
      "preco_atual",
      "preco_vencedor",
      "diferenca",
      "lucro_venda_estimado",
      "catalog_product_id",
    ]
    const rows = filteredCatalogCompetitionRows.map((row) => {
      const product = productMapByMlItemId.get(row.itemId)
      const unitCost = product?.unitCost ?? 0
      const diff = row.price - (row.winnerPrice ?? row.price)
      const estimatedFees = row.price * HUB_ML_AVG_FEE_RATE
      const estimatedProfitPerSale =
        row.price -
        unitCost -
        estimatedFees -
        HUB_CENTRALIZE_SHIPPING_PER_ITEM -
        HUB_CENTRALIZE_PACKAGING_PER_ITEM
      return [
        row.itemId,
        row.title.replace(/"/g, '""'),
        row.competitionStatus,
        row.price.toFixed(2),
        row.winnerPrice?.toFixed(2) ?? "",
        diff.toFixed(2),
        estimatedProfitPerSale.toFixed(2),
        row.catalogProductId ?? "",
      ]
    })
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell)}"`).join(";"))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "catalogos-competicao.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const abcRows = useMemo(() => {
    const fromOrders = buildAbcRowsFromOrders(
      mlOrders,
      productMapByMlItemId,
      productMapBySku,
      financeAbcMetric,
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    )
    if (fromOrders.length > 0) return fromOrders
    return buildAbcRowsFromMovements(products, filteredMovements, financeAbcMetric)
  }, [
    filteredMovements,
    filters.endDate,
    filters.startDate,
    financeAbcMetric,
    mlOrders,
    productMapByMlItemId,
    productMapBySku,
    products,
  ])
  const abcUsesOrdersData = useMemo(() => {
    const fromOrders = buildAbcRowsFromOrders(
      mlOrders,
      productMapByMlItemId,
      productMapBySku,
      financeAbcMetric,
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    )
    return fromOrders.length > 0
  }, [
    filters.endDate,
    filters.startDate,
    financeAbcMetric,
    mlOrders,
    productMapByMlItemId,
    productMapBySku,
  ])
  const abcRowsFiltered = useMemo(() => {
    const skuTerm = financeOrdersSkuFilter.trim().toLowerCase()
    const titleTerm = financeOrdersTitleFilter.trim().toLowerCase()
    return abcRows.filter((row) => {
      const matchesSku = !skuTerm || row.sku.toLowerCase().includes(skuTerm)
      const matchesTitle = !titleTerm || row.productName.toLowerCase().includes(titleTerm)
      return matchesSku && matchesTitle
    })
  }, [abcRows, financeOrdersSkuFilter, financeOrdersTitleFilter])
  const abcSummary = useMemo(() => {
    const byClass = {
      A: { count: 0, share: 0 },
      B: { count: 0, share: 0 },
      C: { count: 0, share: 0 },
    }
    for (const row of abcRowsFiltered) {
      byClass[row.abcClass].count += 1
      byClass[row.abcClass].share += row.sharePercent
    }
    return byClass
  }, [abcRowsFiltered])
  const dreRange = useMemo(() => monthDateRange(dreYear, dreMonth), [dreMonth, dreYear])
  const dreSnapshot = useMemo(
    () =>
      calculateDreSnapshot({
        orders: mlOrders,
        productByMlItemId: productMapByMlItemId,
        productBySku: productMapBySku,
        transactions,
        range: dreRange,
        includeMovements: dreIncludeMovements,
      }),
    [dreIncludeMovements, dreRange, mlOrders, productMapByMlItemId, productMapBySku, transactions],
  )
  const drePreviousSnapshot = useMemo(() => {
    const previous = previousMonth(dreYear, dreMonth)
    const previousRange = monthDateRange(previous.year, previous.month)
    return calculateDreSnapshot({
      orders: mlOrders,
      productByMlItemId: productMapByMlItemId,
      productBySku: productMapBySku,
      transactions,
      range: previousRange,
      includeMovements: dreIncludeMovements,
    })
  }, [
    dreIncludeMovements,
    dreMonth,
    dreYear,
    mlOrders,
    productMapByMlItemId,
    productMapBySku,
    transactions,
  ])
  const dreRevenueBase = Math.max(1, dreSnapshot.revenueConfirmed)
  const dreRows = useMemo(
    () => [
      {
        label: "Receita Confirmada",
        value: dreSnapshot.revenueConfirmed,
        strong: true,
        color: "text-emerald-700 dark:text-emerald-400",
      },
      { label: "(-) Taxas de Marketplace", value: -dreSnapshot.marketplaceFees },
      { label: "(-) Frete Pago pelo Vendedor", value: -dreSnapshot.shippingPaidBySeller },
      {
        label: "(+) Bonus de Frete",
        value: dreSnapshot.shippingBonus,
        color: "text-emerald-700 dark:text-emerald-400",
      },
      {
        label: "= Valor Liquido Recebido",
        value: dreSnapshot.netReceived,
        strong: true,
        color: "text-emerald-700 dark:text-emerald-400",
      },
      { label: "(-) Devolucoes", value: -dreSnapshot.returnsAmount },
      { label: "(-) Custo dos Produtos (SKU)", value: -dreSnapshot.productCosts },
      { label: "(-) Custo de Embalagem", value: -dreSnapshot.packagingCost },
      { label: "(-) Impostos", value: -dreSnapshot.taxes },
      {
        label: "= Lucro Bruto",
        value: dreSnapshot.grossProfit,
        strong: true,
        color: valueToneClass(dreSnapshot.grossProfit),
      },
      { label: "(-) Despesas Operacionais", value: -dreSnapshot.operationalExpenses },
      { label: "(-) Custos Fixos", value: -dreSnapshot.fixedCosts },
      {
        label: "= LUCRO LIQUIDO",
        value: dreSnapshot.netProfit,
        strong: true,
        color: valueToneClass(dreSnapshot.netProfit),
      },
    ],
    [dreSnapshot],
  )
  const dreMonthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Date(2000, index, 1).toLocaleDateString("pt-BR", { month: "long" }),
      })),
    [],
  )

  const filteredMlOrders = useMemo(() => {
    const filtered = mlOrders.filter((order) => {
      const matchesSearch =
        !mlOrdersSearch ||
        order.id.toLowerCase().includes(mlOrdersSearch.toLowerCase()) ||
        order.buyerNickname.toLowerCase().includes(mlOrdersSearch.toLowerCase()) ||
        order.items.some((item) => item.title.toLowerCase().includes(mlOrdersSearch.toLowerCase()))

      const matchesStatus =
        mlOrdersStatusFilter === "all" || order.status.toLowerCase() === mlOrdersStatusFilter

      const matchesShipping =
        mlOrdersShippingFilter === "all" ||
        order.shippingMode.toLowerCase() === mlOrdersShippingFilter

      const matchesSku =
        !mlOrdersSkuFilter ||
        order.items.some((item) => item.sku.toLowerCase().includes(mlOrdersSkuFilter.toLowerCase()))

      const matchesDate = !mlOrdersPeriodDate || order.dateCreated.startsWith(mlOrdersPeriodDate)

      const hasNoSku = order.items.every((item) => !item.sku)
      const matchesNoSku = !mlOrdersOnlyNoSku || hasNoSku

      return (
        matchesSearch &&
        matchesStatus &&
        matchesShipping &&
        matchesSku &&
        matchesDate &&
        matchesNoSku
      )
    })

    if (mlOrdersSortBy === "date_asc") {
      return filtered.slice().sort((a, b) => a.dateCreated.localeCompare(b.dateCreated))
    }
    if (mlOrdersSortBy === "amount_desc") {
      return filtered.slice().sort((a, b) => b.totalAmount - a.totalAmount)
    }
    if (mlOrdersSortBy === "amount_asc") {
      return filtered.slice().sort((a, b) => a.totalAmount - b.totalAmount)
    }
    return filtered.slice().sort((a, b) => b.dateCreated.localeCompare(a.dateCreated))
  }, [
    mlOrders,
    mlOrdersOnlyNoSku,
    mlOrdersPeriodDate,
    mlOrdersSearch,
    mlOrdersShippingFilter,
    mlOrdersSkuFilter,
    mlOrdersSortBy,
    mlOrdersStatusFilter,
  ])

  const saveLaunch = async () => {
    if (!userId || !launchForm.amount || !launchForm.description || !launchForm.categoryId) {
      setLaunchFeedback({
        type: "error",
        message: "Preencha valor, descricao e categoria antes de salvar.",
      })
      return
    }

    const amount = Number(launchForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setLaunchFeedback({ type: "error", message: "Informe um valor numerico valido." })
      return
    }

    setLaunchSaving(true)
    setLaunchFeedback(null)
    try {
      const pendingFiles = launchFormAnexos.filter((a) => a.file)
      let targetIds: string[] = []

      if (launchForm.kind === "expense") {
        const result = await addExpenseWithPayment({
          userId,
          amount,
          date: launchForm.date,
          description: launchForm.description,
          categoryId: launchForm.categoryId as Id<"categories">,
          expenseType: launchForm.expenseType,
          periodicity: launchForm.periodicity,
          paymentMethod: launchForm.paymentMethod,
          installmentCount:
            launchForm.paymentMethod === "credit"
              ? Math.min(24, Math.max(1, Number(launchForm.installmentCount) || 1))
              : undefined,
          firstChargeDate:
            launchForm.paymentMethod === "credit" ? launchForm.firstChargeDate : undefined,
        })
        targetIds = result.transactionIds.map(String)
      } else {
        const newTxId = await addTransaction({
          userId,
          kind: "income",
          amount,
          date: launchForm.date,
          description: launchForm.description,
          categoryId: launchForm.categoryId as Id<"categories">,
          origin: launchForm.origin || undefined,
          periodicity: launchForm.periodicity,
        })
        targetIds = [String(newTxId)]
      }

      const primaryTxId = targetIds[0] as Id<"transactions">
      if (pendingFiles.length > 0 && primaryTxId) {
        for (const anexo of pendingFiles) {
          if (!anexo.file) continue
          const postUrl = await generateAttachmentUploadUrl({ userId })
          const res = await fetch(postUrl, { method: "POST", body: anexo.file })
          const body = (await res.json()) as { storageId?: string }
          if (!body.storageId) throw new Error("Falha no upload do comprovante.")
          await registerTransactionAttachment({
            userId,
            transactionId: primaryTxId,
            storageId: body.storageId,
            fileName: anexo.file.name,
            byteSize: anexo.file.size,
            mimeType: anexo.file.type || "application/octet-stream",
          })
        }
      }

      setLaunchFormAnexos([])
      setLaunchForm((previous) => ({
        ...previous,
        amount: "",
        description: "",
        origin: "",
        expenseType: "variable",
        periodicity: "one_time",
        paymentMethod: "pix",
        installmentCount: "1",
        firstChargeDate: today,
      }))
      setLaunchFeedback({
        type: "success",
        message:
          pendingFiles.length > 0
            ? "Lancamento salvo no financeiro e comprovantes enviados ao Convex."
            : "Lancamento salvo com sucesso no financeiro.",
      })
    } catch (error) {
      setLaunchFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar o lancamento.",
      })
    } finally {
      setLaunchSaving(false)
    }
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
      periodicity: transaction.periodicity ?? "one_time",
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
        transactionEditForm.kind === "income" ? transactionEditForm.origin || undefined : undefined,
      expenseType:
        transactionEditForm.kind === "expense" ? transactionEditForm.expenseType : undefined,
      periodicity: transactionEditForm.periodicity,
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
      !productForm.name.trim() ||
      !productForm.sku.trim() ||
      !productForm.category.trim() ||
      productForm.quantity === "" ||
      productForm.minStock === "" ||
      productForm.unitCost === ""
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
      setProductFeedback({
        type: "error",
        message: "Use apenas numeros validos nos campos numericos.",
      })
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
      !productEditForm.name.trim() ||
      !productEditForm.sku.trim() ||
      !productEditForm.category.trim() ||
      productEditForm.quantity === "" ||
      productEditForm.minStock === "" ||
      productEditForm.unitCost === ""
    ) {
      return
    }

    const quantity = Number(productEditForm.quantity)
    const minStock = Number(productEditForm.minStock)
    const unitCost = Number(productEditForm.unitCost)
    const sellingPrice = productEditForm.sellingPrice
      ? Number(productEditForm.sellingPrice)
      : undefined

    if (
      Number.isNaN(quantity) ||
      Number.isNaN(minStock) ||
      Number.isNaN(unitCost) ||
      (productEditForm.sellingPrice && Number.isNaN(sellingPrice))
    ) {
      setProductFeedback({
        type: "error",
        message: "Use apenas numeros validos nos campos numericos.",
      })
      return
    }

    try {
      const current = products.find((pr) => pr.id === editingProductId)
      let resolvedKanban = current?.kanbanStatus ?? (quantity > 0 ? "in_stock" : "planned")
      if (current && current.quantity > 0 && quantity === 0) {
        resolvedKanban = "in_stock"
      }
      if (current && current.quantity > 0 && quantity === 0) {
        await applyKanbanMoveMutation({
          userId,
          productId: editingProductId,
          target: "em_falta",
        })
      }
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
        kanbanStatus: resolvedKanban,
        kanbanNote: current?.kanbanNote,
        estimatedArrival: current?.estimatedArrival,
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

  const handleKanbanUpdateStatus = async (
    productId: string,
    target: KanbanColumnId,
    note?: string,
    estimatedArrival?: string,
  ) => {
    if (!userId) return
    try {
      await applyKanbanMoveMutation({
        userId,
        productId: productId as Id<"stockProducts">,
        target,
        ...(note !== undefined && { kanbanNote: note }),
        ...(estimatedArrival !== undefined && { estimatedArrival }),
      })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Nao foi possivel atualizar o quadro Kanban.",
      })
    }
  }

  const handleKanbanSaveEdits = async (productId: string, updates: Partial<KanbanProduct>) => {
    if (!userId) return
    const p = products.find((x) => x.id === productId)
    if (!p) return
    const nextQty = updates.quantity ?? p.quantity
    let resolvedKanban =
      updates.kanbanStatus ?? p.kanbanStatus ?? (nextQty > 0 ? "in_stock" : "planned")
    if (p.quantity > 0 && nextQty === 0) {
      resolvedKanban = "in_stock"
    }
    try {
      if (p.quantity > 0 && nextQty === 0) {
        await applyKanbanMoveMutation({
          userId,
          productId: p.id as Id<"stockProducts">,
          target: "em_falta",
          ...(updates.kanbanNote !== undefined && { kanbanNote: updates.kanbanNote }),
          ...(updates.estimatedArrival !== undefined && {
            estimatedArrival: updates.estimatedArrival,
          }),
        })
      }
      await updateProduct({
        userId,
        productId: p.id as Id<"stockProducts">,
        name: p.name,
        sku: p.sku,
        category: p.category,
        quantity: nextQty,
        minStock: updates.minStock ?? p.minStock,
        unitCost: p.unitCost,
        sellingPrice: p.sellingPrice,
        kanbanStatus: resolvedKanban,
        kanbanNote: updates.kanbanNote !== undefined ? updates.kanbanNote : p.kanbanNote,
        estimatedArrival:
          updates.estimatedArrival !== undefined ? updates.estimatedArrival : p.estimatedArrival,
      })
      setProductFeedback({ type: "success", message: "Produto atualizado com sucesso." })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar o produto.",
      })
    }
  }

  const handleKanbanDelete = async (productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (p) await removeProduct(p)
  }

  const handleToggleProductHidden = async (productId: string, hidden: boolean) => {
    if (!userId) {
      setProductFeedback({
        type: "error",
        message: "Sessao nao carregada. Recarregue a pagina e tente novamente.",
      })
      return
    }
    try {
      await setProductKanbanHidden({
        userId,
        productId: productId as Id<"stockProducts">,
        kanbanHidden: hidden,
      })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar visibilidade do card.",
      })
    }
  }

  const uploadFilesToExistingTransaction = useCallback(
    async (transactionId: string, files: File[]) => {
      if (!userId) throw new Error("Sessao nao carregada.")
      for (const file of files) {
        const postUrl = await generateAttachmentUploadUrl({ userId })
        const res = await fetch(postUrl, { method: "POST", body: file })
        const body = (await res.json()) as { storageId?: string }
        if (!body.storageId) throw new Error("Falha no upload do comprovante.")
        await registerTransactionAttachment({
          userId,
          transactionId: transactionId as Id<"transactions">,
          storageId: body.storageId,
          fileName: file.name,
          byteSize: file.size,
          mimeType: file.type || "application/octet-stream",
        })
      }
    },
    [userId, generateAttachmentUploadUrl, registerTransactionAttachment],
  )

  const submitReturn = async () => {
    if (!userId || !returnModal) return
    const amt = Number(returnForm.creditAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      window.alert("Informe um valor de credito valido.")
      return
    }
    if (!returnForm.note.trim()) {
      window.alert("Preencha a observacao.")
      return
    }
    const ok = window.confirm("Confirmar devolucao e gerar lancamento de credito?")
    if (!ok) return
    try {
      await startReturnForTransactionMutation({
        userId,
        sourceTransactionId: returnModal.transaction.id as Id<"transactions">,
        reason: returnForm.reason,
        note: returnForm.note.trim(),
        productId: returnForm.productId || undefined,
        creditAmount: amt,
      })
      setReturnModal(null)
      setReturnForm({
        reason: "defect",
        note: "",
        productId: "",
        creditAmount: "",
      })
      window.alert("Devolucao registrada. Produto movido para Devolvido quando vinculado.")
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Falha ao registrar devolucao.")
    }
  }

  const saveManualInboundStock = async () => {
    if (!userId) return
    const qty = Number(manualStockForm.quantity)
    const cost = Number(manualStockForm.unitCost)
    if (!manualStockForm.name.trim() || !manualStockForm.supplier.trim()) {
      setProductFeedback({
        type: "error",
        message: "Preencha nome do produto e fornecedor.",
      })
      return
    }
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(cost) || cost < 0) {
      setProductFeedback({
        type: "error",
        message: "Quantidade e custo devem ser numeros validos.",
      })
      return
    }
    try {
      await addManualStockEntryMutation({
        userId,
        name: manualStockForm.name.trim(),
        quantity: qty,
        unitCost: cost,
        supplier: manualStockForm.supplier.trim(),
        manualEntryDate: manualStockForm.manualEntryDate,
        location: manualStockForm.location,
        estimatedArrival: manualStockForm.estimatedArrival || undefined,
        observations: manualStockForm.observations || undefined,
      })
      setManualStockForm({
        name: "",
        quantity: "",
        unitCost: "",
        supplier: "",
        manualEntryDate: today,
        location: "in_stock_physical",
        estimatedArrival: "",
        observations: "",
      })
      setShowManualStockForm(false)
      setProductFeedback({ type: "success", message: "Entrada manual registrada no estoque." })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar entrada manual.",
      })
    }
  }

  useEffect(() => {
    const rows = financeData?.transactionAttachments
    if (!rows?.length) return
    setAnexosByLancamentoId((prev) => {
      const fromServer: Record<string, AnexoLancamento[]> = {}
      for (const row of rows) {
        const tid = row.transactionId as string
        const entry: AnexoLancamento = {
          id: row._id,
          uploadedAt: row.createdAt,
          fileName: row.fileName,
          mimeType: row.mimeType,
          byteSize: row.byteSize,
          remoteUrl: row.url ?? undefined,
          convexAttachmentId: row._id,
        }
        fromServer[tid] = [...(fromServer[tid] ?? []), entry]
      }
      const merged: Record<string, AnexoLancamento[]> = { ...fromServer }
      for (const key of Object.keys(prev)) {
        const pending = prev[key].filter((a) => a.file && !a.convexAttachmentId)
        if (pending.length) merged[key] = [...(merged[key] ?? []), ...pending]
      }
      return merged
    })
  }, [financeData?.transactionAttachments])

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

  const disconnectMlAccount = async () => {
    if (mlDisconnecting) return
    const confirmed = window.confirm("Deseja desconectar a conta do Mercado Livre deste hub?")
    if (!confirmed) return

    setMlDisconnecting(true)
    setMlError(null)
    setMlInfo(null)
    try {
      const response = await fetch("/api/ml/disconnect", { method: "POST" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao desconectar conta do Mercado Livre.")
      }

      setMlConnectionStatus({ connected: false })
      setMlListingsCount(0)
      setMlOrders([])
      setMlOrdersCount(0)
      setMlMetrics(null)
      setMlCatalogCompetitionRows([])
      setMlCatalogCompetitionSummary({
        total: 0,
        winning: 0,
        sharingFirstPlace: 0,
        competing: 0,
        paused: 0,
        listed: 0,
      })
      setMlInfo("Conta do Mercado Livre desconectada com sucesso.")
    } catch (error) {
      setMlError(
        error instanceof Error ? error.message : "Erro ao desconectar conta do Mercado Livre.",
      )
    } finally {
      setMlDisconnecting(false)
    }
  }

  const loadMlListings = async () => {
    setMlError(null)
    setMlListingsLoading(true)
    try {
      const response = await fetch("/api/ml/listings?limit=50&offset=0", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar anuncios.")
      }
      setMlListingsCount(payload.data.total ?? 0)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar anuncios.")
    } finally {
      setMlListingsLoading(false)
    }
  }

  const loadMlOrders = async () => {
    setMlError(null)
    setMlOrdersLoading(true)
    try {
      const response = await fetch("/api/ml/orders?limit=20&offset=0", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar pedidos.")
      }
      setMlOrdersCount(payload.data.total ?? 0)
      setMlOrders((payload.data.orders ?? []) as MlOrder[])
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar pedidos.")
    } finally {
      setMlOrdersLoading(false)
    }
  }

  const loadMlMetrics = async () => {
    setMlError(null)
    setMlMetricsLoading(true)
    try {
      const response = await fetch("/api/ml/metrics", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar metricas.")
      }
      setMlMetrics(payload.data)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar metricas.")
    } finally {
      setMlMetricsLoading(false)
    }
  }

  const loadMlOverviewCards = async () => {
    setMlError(null)
    try {
      const [listingsResponse, ordersResponse, metricsResponse] = await Promise.all([
        fetch("/api/ml/listings?limit=1&offset=0", { cache: "no-store" }),
        fetch("/api/ml/orders?limit=1&offset=0", { cache: "no-store" }),
        fetch("/api/ml/metrics", { cache: "no-store" }),
      ])

      const [listingsPayload, ordersPayload, metricsPayload] = await Promise.all([
        listingsResponse.json(),
        ordersResponse.json(),
        metricsResponse.json(),
      ])

      if (!listingsResponse.ok || !listingsPayload.ok) {
        throw new Error(listingsPayload.error ?? "Falha ao carregar resumo de anuncios.")
      }
      if (!ordersResponse.ok || !ordersPayload.ok) {
        throw new Error(ordersPayload.error ?? "Falha ao carregar resumo de pedidos.")
      }
      if (!metricsResponse.ok || !metricsPayload.ok) {
        throw new Error(metricsPayload.error ?? "Falha ao carregar resumo de metricas.")
      }

      setMlListingsCount(listingsPayload.data.total ?? 0)
      setMlOrdersCount(ordersPayload.data.total ?? 0)
      setMlMetrics(metricsPayload.data)
    } catch (error) {
      setMlError(
        error instanceof Error ? error.message : "Erro ao carregar resumo do Mercado Livre.",
      )
    }
  }

  const syncStockWithMl = async () => {
    if (!userId) return
    const startedAt = Date.now()
    setMlSyncingStock(true)
    setMlError(null)
    setMlInfo(null)

    try {
      const response = await fetch("/api/ml/listings?limit=50&offset=0", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao carregar anuncios para sincronizar estoque.")
      }

      const listings = (payload.data.listings ?? []) as MlListing[]
      const syncResult = await syncStockFromMercadoLivre({
        userId,
        listings: listings.map((listing) => ({
          id: listing.id,
          title: listing.title,
          price: listing.price,
          availableQuantity: listing.available_quantity,
          thumbnail: listing.thumbnail,
          sku: listing.sku,
        })),
      })

      setMlListingsCount(payload.data.total ?? listings.length)
      setMlInfo(
        `Sincronizacao concluida: ${syncResult.updated} atualizados, ${syncResult.created} criados.`,
      )
      setMlLastSyncAt(Date.now())
      setMlLastSyncDurationMs(Date.now() - startedAt)
    } catch (error) {
      setMlError(
        error instanceof Error ? error.message : "Erro ao sincronizar estoque com Mercado Livre.",
      )
    } finally {
      setMlSyncingStock(false)
    }
  }

  const refreshMlSync = async () => {
    if (!mlConnectionStatus?.connected || mlSyncingStock) return
    await Promise.all([syncStockWithMl(), loadMlOverviewCards()])
  }

  const openAnalysis = (itemId: string) => setAnalysisItemId(itemId)

  const loadMlCatalogCompetition = async () => {
    setMlError(null)
    setMlCatalogCompetitionLoading(true)
    try {
      const response = await fetch(`/api/ml/catalog/hub?action=competition&ts=${Date.now()}`, {
        cache: "no-store",
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao carregar competicao de catalogo.")
      }
      const rawSummary = payload.data.summary as MlCatalogCompetitionSummary | null | undefined
      setMlCatalogCompetitionSummary(
        rawSummary ? { ...rawSummary, paused: rawSummary.paused ?? 0 } : null,
      )
      setMlCatalogCompetitionRows((payload.data.rows ?? []) as MlCatalogCompetitionRow[])
    } catch (error) {
      setMlError(
        error instanceof Error
          ? error.message
          : "Erro ao carregar dados de competicao do catalogo.",
      )
    } finally {
      setMlCatalogCompetitionLoading(false)
    }
  }

  const openOrderCostAnalysis = (order: MlOrder, unitCost: number, quantity: number) => {
    const revenueTotal = order.totalAmount
    const receivedAmount = order.totalPaidAmount
    const productCost = Math.max(0, unitCost * quantity)
    const shippingCost = Math.max(0, order.shippingCostAmount)
    const centralizeShipping = Math.max(0, quantity * HUB_CENTRALIZE_SHIPPING_PER_ITEM)
    const centralizePackaging = Math.max(0, quantity * HUB_CENTRALIZE_PACKAGING_PER_ITEM)
    const taxes = Math.max(0, order.taxesAmount)
    const shippingBonus = 0
    const mlFee = Math.max(0, order.mlFeeAmount)

    const totalCosts = Math.max(
      0,
      productCost +
        shippingCost +
        centralizeShipping +
        centralizePackaging +
        mlFee +
        taxes -
        shippingBonus,
    )
    const netProfit =
      receivedAmount -
      productCost -
      shippingCost -
      centralizeShipping -
      centralizePackaging -
      mlFee -
      taxes
    const contributionMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0
    const roi = productCost > 0 ? (netProfit / productCost) * 100 : 0

    setMlOrderCostAnalysis({
      orderId: order.id,
      title: order.items[0]?.title ?? "Item sem titulo",
      revenueTotal,
      receivedAmount,
      netProfit,
      productCost,
      shippingCost,
      centralizeShipping,
      centralizePackaging,
      mlFee,
      taxes,
      shippingBonus,
      totalCosts,
      contributionMargin,
      roi,
      source: unitCost > 0 ? "fallback" : "fallback",
    })
  }

  useEffect(() => {
    if (!mlConnectionStatus?.connected) {
      mlListingsSectionBootstrapped.current = false
      mlCatalogSectionBootstrapped.current = false
      mlOrdersSectionBootstrapped.current = false
    }
    if (activeModule !== "mercadolivre" || !mlConnectionStatus?.connected) {
      return
    }

    if (activeMlSection !== "listings") {
      mlListingsSectionBootstrapped.current = false
      mlCatalogSectionBootstrapped.current = false
    }
    if (activeMlSection !== "orders") {
      mlOrdersSectionBootstrapped.current = false
    }

    if (activeMlSection === "listings") {
      if (!mlListingsSectionBootstrapped.current && !mlListingsLoading) {
        mlListingsSectionBootstrapped.current = true
        void loadMlListings()
      }
      if (!mlCatalogSectionBootstrapped.current && !mlCatalogCompetitionLoading) {
        mlCatalogSectionBootstrapped.current = true
        void loadMlCatalogCompetition()
      }
      return
    }
    if (activeMlSection === "orders") {
      if (!mlOrdersSectionBootstrapped.current && !mlOrdersLoading) {
        mlOrdersSectionBootstrapped.current = true
        void loadMlOrders()
      }
      return
    }
    if (activeMlSection === "metrics" && !mlMetrics && !mlMetricsLoading) {
      void loadMlMetrics()
    }
  }, [
    activeMlSection,
    activeModule,
    mlCatalogCompetitionLoading,
    mlConnectionStatus?.connected,
    mlListingsLoading,
    mlMetrics,
    mlMetricsLoading,
    mlOrdersLoading,
  ])

  useEffect(() => {
    if (activeMlSidebarGroup === "anuncios") setActiveMlSection("listings")
    if (activeMlSidebarGroup === "pedidos") setActiveMlSection("orders")
    if (activeMlSidebarGroup === "metricas") setActiveMlSection("metrics")
  }, [activeMlSidebarGroup])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMlNowTimestamp(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

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
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">Modulos</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={activeModule === "home" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveModule("home")}
          >
            <Home className="size-4" />
            Home
          </Button>
          <Button
            variant={activeModule === "finance" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveModule("finance")}
          >
            <Wallet className="size-4" />
            Financeiro
          </Button>
          <Button
            variant={activeModule === "stock" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveModule("stock")}
          >
            <Boxes className="size-4" />
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
            <Store className="size-4" />
            Mercado Livre
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              activeModule === "branchhunter"
                ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
            )}
            onClick={() => setActiveModule("branchhunter")}
          >
            <Search className="size-4" />
            Branch Hunter
          </Button>
        </div>
        <Separator />
        {activeModule === "finance" && (
          <>
            <p className="text-xs text-muted-foreground">Financeiro</p>
            <SidebarButton
              icon={LayoutDashboard}
              label="Visao geral"
              isActive={activeFinanceSection === "overview"}
              onClick={() => setActiveFinanceSection("overview")}
            />
            <Button
              variant={activeFinanceSection === "cashflow" ? "secondary" : "ghost"}
              className={cn(
                "ml-4 justify-start text-xs border-l-2 border-blue-400/30",
                activeFinanceSection === "cashflow"
                  ? "bg-blue-50 text-blue-700 dark:text-blue-300 border-blue-500 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
                  : "text-blue-600/80 hover:bg-blue-50/50 dark:text-blue-400/70 dark:hover:bg-blue-950/30",
              )}
              onClick={() => setActiveFinanceSection("cashflow")}
            >
              <CircleDollarSign className="size-3.5" />
              Caixa Operacional
            </Button>
            <SidebarButton
              icon={PieChart}
              label="Analise ABC"
              isActive={activeFinanceSection === "abc"}
              onClick={() => setActiveFinanceSection("abc")}
            />
            <SidebarButton
              icon={FileText}
              label="Analise DRE"
              isActive={activeFinanceSection === "dre"}
              onClick={() => setActiveFinanceSection("dre")}
            />
            <SidebarButton
              icon={TrendingDown}
              label="Lancamentos"
              isActive={activeFinanceSection === "expenses"}
              onClick={() => setActiveFinanceSection("expenses")}
            />
            <SidebarButton
              icon={FolderTree}
              label="Categorias"
              isActive={activeFinanceSection === "categories"}
              onClick={() => setActiveFinanceSection("categories")}
            />
            <SidebarButton
              icon={BarChart3}
              label="Relatorios"
              isActive={activeFinanceSection === "reports"}
              onClick={() => setActiveFinanceSection("reports")}
            />
            <SidebarButton
              icon={ReceiptText}
              label="Historico"
              isActive={activeFinanceSection === "history"}
              onClick={() => setActiveFinanceSection("history")}
            />
          </>
        )}
        {activeModule === "stock" && (
          <>
            <p className="text-xs text-muted-foreground">Estoque</p>
            <SidebarButton
              icon={Boxes}
              label="Visao geral"
              isActive={activeStockSection === "overview"}
              onClick={() => setActiveStockSection("overview")}
            />
            <SidebarButton
              icon={PackagePlus}
              label="Produtos"
              isActive={activeStockSection === "products"}
              onClick={() => setActiveStockSection("products")}
            />
            <SidebarButton
              icon={Repeat}
              label="Movimentacoes"
              isActive={activeStockSection === "movements"}
              onClick={() => setActiveStockSection("movements")}
            />
            <SidebarButton
              icon={ReceiptText}
              label="Historico"
              isActive={activeStockSection === "history"}
              onClick={() => setActiveStockSection("history")}
            />
          </>
        )}
        {activeModule === "mercadolivre" && (
          <>
            <p className="text-xs text-muted-foreground">Mercado Livre</p>
            <SidebarButton
              icon={PackagePlus}
              label="Anuncios"
              isActive={activeMlSidebarGroup === "anuncios"}
              onClick={() => setActiveMlSidebarGroup("anuncios")}
            />
            {activeMlSidebarGroup === "anuncios" && (
              <Button
                variant={activeMlSection === "listings" ? "secondary" : "ghost"}
                className="ml-7 justify-start"
                onClick={() => setActiveMlSection("listings")}
              >
                Catalogos
              </Button>
            )}
            <SidebarButton
              icon={ReceiptText}
              label="Pedidos"
              isActive={activeMlSidebarGroup === "pedidos"}
              onClick={() => setActiveMlSidebarGroup("pedidos")}
            />
            <SidebarButton
              icon={BarChart3}
              label="Metricas"
              isActive={activeMlSidebarGroup === "metricas"}
              onClick={() => setActiveMlSidebarGroup("metricas")}
            />
          </>
        )}
        {activeModule === "branchhunter" && (
          <>
            <p className="text-xs text-muted-foreground">Analise e metricas</p>
            <SidebarButton
              icon={Search}
              label="Analise de Anuncio"
              isActive={activeHunterSection === "analise-anuncio"}
              onClick={() => setActiveHunterSection("analise-anuncio")}
            />
          </>
        )}
      </aside>

      <section className="flex-1 space-y-4">
        <div className="flex justify-end lg:hidden">
          <ThemeToggle />
        </div>
        {activeModule === "home" && (
          <div className="mx-auto max-w-6xl space-y-8 pb-8">
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-sky-500/10 via-card to-violet-500/5 px-5 py-6 shadow-sm sm:px-8 sm:py-8 dark:from-sky-950/40 dark:via-card dark:to-violet-950/20">
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Painel principal
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Ola, {financeAccountLabel}
                  </h1>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Visao unificada do periodo{" "}
                    <span className="font-medium text-foreground">{homePeriodLabel}</span>. Ajuste
                    datas em{" "}
                    <span className="font-medium text-foreground">Finanças → Visao geral</span>.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        mlConnectionStatus?.connected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                      )}
                    >
                      <Store className="size-3.5 shrink-0" />
                      {mlConnectionStatus?.connected
                        ? `ML conectado${mlConnectionStatus.mlNickname ? ` · ${mlConnectionStatus.mlNickname}` : ""}`
                        : "Mercado Livre nao conectado"}
                    </span>
                    {hasOrdersFinancialData && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:text-sky-200">
                        <ShoppingBag className="size-3.5 shrink-0" />
                        KPIs com base em pedidos ML
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={() => {
                      setActiveModule("finance")
                      setActiveFinanceSection("overview")
                    }}
                  >
                    Finanças
                    <ArrowRight className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full"
                    onClick={() => setActiveModule("stock")}
                  >
                    Estoque
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full"
                    onClick={() => setActiveModule("mercadolivre")}
                  >
                    Mercado Livre
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-400">
                      <CircleDollarSign className="size-5" />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Receita
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {formatCurrency(salesInFilterFinal)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {salesCountFinal} pedidos · ticket {formatCurrency(ticketMedioFinal)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        "rounded-lg p-2",
                        homeNetProfit >= 0
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      <TrendingUp className="size-5" />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Lucro liquido
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-4 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                      homeNetProfit >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-destructive",
                    )}
                  >
                    {formatCurrency(homeNetProfit)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    DRE no periodo (pedidos + despesas cadastradas)
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-lg bg-orange-500/10 p-2 text-orange-700 dark:text-orange-400">
                      <Percent className="size-5" />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Margem
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-4 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                      operatingMarginFinal >= 0 ? "text-foreground" : "text-destructive",
                    )}
                  >
                    {operatingMarginFinal.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sobre receita · custos totais {formatCurrency(expensesInFilterFinal)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-lg bg-violet-500/10 p-2 text-violet-700 dark:text-violet-300">
                      <Boxes className="size-5" />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Estoque
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {formatCurrency(stockSummary.stockValue)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stockSummary.totalProducts} produtos · {stockSummary.totalUnits} unidades
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-border/70 shadow-sm lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Resumo financeiro</CardTitle>
                      <CardDescription>
                        {hasOrdersFinancialData
                          ? homeFilterMatchesCurrentMonth
                            ? "Filtro = mes atual: pedidos ML a esquerda; lancamentos manuais a direita (sem duplicar ML)."
                            : "Pedidos ML no periodo do filtro (esq.) e resumo do mes civil atual (dir., para comparar)."
                          : "Lancamentos manuais no periodo do filtro e mes corrente."}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sky-600 dark:text-sky-400 hover:text-sky-700"
                      onClick={() => {
                        setActiveModule("finance")
                        setActiveFinanceSection("overview")
                      }}
                    >
                      Ver detalhes
                      <ArrowRight className="ml-1 size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  {hasOrdersFinancialData ? (
                    <>
                      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Pedidos ML (periodo do filtro)
                        </p>
                        <LineItem label="Receita bruta" value={salesInFilterFinal} />
                        <LineItem label="Custos dos pedidos" value={expensesInFilterFinal} />
                        <div className="border-t border-border/60 pt-2">
                          <LineItem label="Lucro (pedidos)" value={operatingResultFinal} strong />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {salesCountFinal} pedido(s) no filtro · alinhado aos cards do topo
                        </p>
                        {(summary.income > 0 || summary.expense > 0) && (
                          <div className="border-t border-border/60 pt-3">
                            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              + Lancamentos manuais (mesmo periodo)
                            </p>
                            <LineItem label="Entradas" value={summary.income} />
                            <LineItem label="Saidas" value={summary.expense} />
                            <LineItem label="Saldo manual" value={summary.balance} />
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {homeFilterMatchesCurrentMonth
                            ? "Lancamentos manuais (mes atual)"
                            : "Mes civil atual · pedidos ML + manual"}
                        </p>
                        {!homeFilterMatchesCurrentMonth && (
                          <>
                            <LineItem
                              label="Receita (pedidos ML)"
                              value={homeCurrentMonthOrders.grossRevenue}
                            />
                            <LineItem
                              label="Custos (pedidos ML)"
                              value={homeCurrentMonthOrders.totalCosts}
                            />
                            <div className="border-t border-border/60 pt-2">
                              <LineItem
                                label="Lucro (pedidos ML)"
                                value={homeCurrentMonthOrders.netProfit}
                                strong
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {homeCurrentMonthOrders.ordersCount} pedido(s) neste mes na lista
                              carregada
                            </p>
                          </>
                        )}
                        <div
                          className={cn(
                            "space-y-2",
                            !homeFilterMatchesCurrentMonth && "border-t border-border/60 pt-3",
                          )}
                        >
                          {!homeFilterMatchesCurrentMonth && (
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Lancamentos manuais (mes calendario)
                            </p>
                          )}
                          <LineItem label="Entradas" value={monthlyReport.income} />
                          <LineItem label="Saidas" value={monthlyReport.expense} />
                          <LineItem label="Resultado" value={monthlyReport.balance} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {transactions.length} lancamento(s) cadastrado(s) no total
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Lancamentos (filtro)
                        </p>
                        <LineItem label="Entradas" value={summary.income} />
                        <LineItem label="Saidas" value={summary.expense} />
                        <div className="border-t border-border/60 pt-2">
                          <LineItem label="Saldo no periodo" value={summary.balance} strong />
                        </div>
                      </div>
                      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Mes atual (calendario)
                        </p>
                        <LineItem label="Entradas" value={monthlyReport.income} />
                        <LineItem label="Saidas" value={monthlyReport.expense} />
                        <div className="border-t border-border/60 pt-2">
                          <LineItem label="Resultado do mes" value={monthlyReport.balance} strong />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {transactions.length} lancamentos no total
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4">
                {stockSummary.lowStockCount > 0 && (
                  <Card className="border-amber-500/40 bg-amber-500/6 shadow-sm dark:bg-amber-950/20">
                    <CardContent className="flex items-start gap-3 pt-5">
                      <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-medium text-amber-950 dark:text-amber-100">
                          {stockSummary.lowStockCount} produto(s) abaixo do minimo
                        </p>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-amber-800 dark:text-amber-200"
                          onClick={() => {
                            setActiveModule("stock")
                            setActiveStockSection("overview")
                          }}
                        >
                          Revisar estoque
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Mercado Livre</CardTitle>
                    <CardDescription>Anuncios e pedidos (totais da API)</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Anuncios</p>
                      <p className="text-xl font-semibold tabular-nums">{mlListingsCount ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                      <p className="text-xl font-semibold tabular-nums">{mlOrdersCount ?? "—"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Custos no periodo</CardTitle>
                    <CardDescription className="text-xs">
                      {hasOrdersFinancialData
                        ? "Composicao dos pedidos ML no filtro (produto, taxas, frete, etc.)."
                        : "Despesas por tipo nos lancamentos manuais."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {hasOrdersFinancialData && costComposition.length > 0 ? (
                      costComposition.map((row) => (
                        <LineItem
                          key={row.categoryName}
                          label={row.categoryName}
                          value={row.total}
                        />
                      ))
                    ) : (
                      <>
                        <LineItem label="Operacional" value={costBreakdown.operationalCost} />
                        <LineItem label="Fixos" value={costBreakdown.fixedCost} />
                        <LineItem label="Ferramentas (fixo)" value={costBreakdown.toolsFixedCost} />
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {homeEvolutionPreview.length > 0 && (
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Receita vs despesas (ultimos meses)</CardTitle>
                  <CardDescription>
                    {hasOrdersFinancialData &&
                    homeOrdersEvolution.some((p) => p.income > 0 || p.expense > 0)
                      ? "Agregado por mes a partir dos pedidos Mercado Livre carregados."
                      : "Baseado nos lancamentos financeiros manuais."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {homeEvolutionPreview.map((point) => {
                      const max = Math.max(point.income, point.expense, 1)
                      return (
                        <div
                          key={point.key}
                          className="rounded-xl border border-border/50 bg-muted/20 p-3"
                        >
                          <p className="text-xs font-medium text-muted-foreground">
                            {point.monthLabel}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            + {formatCurrency(point.income)}
                          </p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500/80"
                              style={{ width: `${Math.min(100, (point.income / max) * 100)}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Desp. {formatCurrency(point.expense)}
                          </p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-orange-500/70"
                              style={{ width: `${Math.min(100, (point.expense / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <Trophy className="size-4 text-amber-500" />
                    Campeoes de lucro
                  </CardTitle>
                  <CardDescription>
                    {hasOrdersFinancialData
                      ? "Lucro por item nos pedidos ML do periodo (taxas e frete rateados)."
                      : "Vendas registradas como saida no estoque no periodo filtrado."}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setActiveModule("finance")
                    setActiveFinanceSection("abc")
                  }}
                >
                  ABC completo
                </Button>
              </CardHeader>
              <CardContent>
                {homeProductChampions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {hasOrdersFinancialData
                      ? "Sem itens nos pedidos do periodo ou custos de produto zerados no estoque."
                      : "Sem vendas no periodo ou cadastre custos nos produtos para ver margem."}
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {homeProductChampions.map((item, index) => (
                      <li
                        key={item.productId}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-800 dark:text-amber-200">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.unitsSold} un. · margem {item.marginPercent.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right tabular-nums">
                          <p className={cn("font-semibold", valueToneClass(item.profit))}>
                            {formatCurrency(item.profit)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            rec. {formatCurrency(item.revenue)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeModule === "finance" && (
          <>
            {activeFinanceSection !== "overview" && (
              <Card>
                <CardHeader>
                  <CardTitle>Filtros financeiros</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <BrDateInput
                    value={filters.startDate ?? ""}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, startDate: value || undefined }))
                    }
                  />
                  <BrDateInput
                    value={filters.endDate ?? ""}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, endDate: value || undefined }))
                    }
                  />
                  <Select
                    value={filters.categoryId ?? "all-categories"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        categoryId: value === "all-categories" ? undefined : value,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-categories">Todas categorias</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.kind ?? "all"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        kind: value as TransactionFilters["kind"],
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Entradas e saidas</SelectItem>
                      <SelectItem value="income">Entradas</SelectItem>
                      <SelectItem value="expense">Saidas</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {activeFinanceSection === "overview" && (
              <section className="space-y-4">
                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="inline-flex items-center gap-2 text-xl">
                      <Wallet className="size-5 text-orange-500 dark:text-orange-400" />
                      Resumo Financeiro
                    </CardTitle>
                    <CardDescription>
                      Acompanhe receitas, custos e margens das suas vendas.
                      {hasOrdersFinancialData
                        ? " Base principal: pedidos vendidos do Mercado Livre."
                        : " Sem pedidos no periodo: exibindo financeiro interno."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border/70 bg-muted/15 p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <CalendarDays className="size-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
                        <span className="text-xs text-muted-foreground">
                          Periodo, movimentacoes e pedidos do Mercado Livre
                        </span>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Periodo e categorias
                          </p>
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5">
                              <BrDateInput
                                value={filters.startDate ?? ""}
                                onValueChange={(value) =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    startDate: value || undefined,
                                  }))
                                }
                              />
                              <span className="text-xs text-muted-foreground">ate</span>
                              <BrDateInput
                                value={filters.endDate ?? ""}
                                onValueChange={(value) =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    endDate: value || undefined,
                                  }))
                                }
                              />
                            </div>
                            <Select
                              value={filters.categoryId ?? "all-categories"}
                              onValueChange={(value) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  categoryId: value === "all-categories" ? undefined : value,
                                }))
                              }
                            >
                              <SelectTrigger className="h-9 w-full min-w-[160px] max-w-[220px]">
                                <SelectValue placeholder="Categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all-categories">Todas categorias</SelectItem>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={filters.kind ?? "all"}
                              onValueChange={(value) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  kind: value as TransactionFilters["kind"],
                                }))
                              }
                            >
                              <SelectTrigger className="h-9 w-full min-w-[180px] max-w-[240px]">
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Entradas e saidas</SelectItem>
                                <SelectItem value="income">Entradas</SelectItem>
                                <SelectItem value="expense">Saidas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Separator className="bg-border/60" />

                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Pedidos (tabela e metricas ML)
                          </p>
                          <div className="flex flex-wrap items-end gap-3">
                            <Input
                              className="h-9 min-w-[min(100%,200px)] max-w-[240px] flex-1"
                              placeholder="Titulo do pedido"
                              value={financeOrdersTitleFilter}
                              onChange={(event) => setFinanceOrdersTitleFilter(event.target.value)}
                            />
                            <Input
                              className="h-9 min-w-[min(100%,120px)] max-w-[160px] flex-1"
                              placeholder="SKU"
                              value={financeOrdersSkuFilter}
                              onChange={(event) => setFinanceOrdersSkuFilter(event.target.value)}
                            />
                            <Select
                              value={financeOrdersStatusFilter}
                              onValueChange={setFinanceOrdersStatusFilter}
                            >
                              <SelectTrigger className="h-9 min-w-[160px] max-w-[200px]">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos os status</SelectItem>
                                <SelectItem value="paid">Pago</SelectItem>
                                <SelectItem value="ready_to_ship">Pronto para envio</SelectItem>
                                <SelectItem value="shipped">Enviado</SelectItem>
                                <SelectItem value="delivered">Entregue</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value="all-accounts" onValueChange={() => undefined}>
                              <SelectTrigger className="h-9 min-w-[160px] max-w-[220px]">
                                <SelectValue placeholder="Conta" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all-accounts">Todas as contas</SelectItem>
                                <SelectItem value={financeAccountLabel}>
                                  {financeAccountLabel}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Comparar / projetar
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={financeOverviewCompare === "none" ? "secondary" : "outline"}
                            className="h-7 rounded-none px-2.5 text-[10px] font-normal"
                            onClick={() => setFinanceOverviewCompare("none")}
                          >
                            Sem comparar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              financeOverviewCompare === "prev_month" ? "secondary" : "outline"
                            }
                            className="h-7 rounded-none px-2.5 text-[10px] font-normal"
                            onClick={() => setFinanceOverviewCompare("prev_month")}
                          >
                            vs Mes anterior
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              financeOverviewCompare === "prev_year" ? "secondary" : "outline"
                            }
                            className="h-7 rounded-none px-2.5 text-[10px] font-normal"
                            onClick={() => setFinanceOverviewCompare("prev_year")}
                          >
                            vs Ano anterior
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={financeOverviewProjection === "none" ? "secondary" : "outline"}
                            className="h-7 rounded-none px-2.5 text-[10px] font-normal"
                            onClick={() => setFinanceOverviewProjection("none")}
                          >
                            Sem projecao
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              financeOverviewProjection === "month" ? "secondary" : "outline"
                            }
                            className="h-7 rounded-none px-2.5 text-[10px] font-normal"
                            onClick={() => setFinanceOverviewProjection("month")}
                          >
                            Projecao do mes
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Wallet className="size-3.5" />
                            Lucro Liquido
                          </CardDescription>
                          <CardTitle className={valueToneClass(operatingResultFinal)}>
                            {formatCurrency(operatingResultFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium",
                              valueBadgeClass(operatingMarginFinal),
                            )}
                          >
                            {operatingMarginFinal >= 0 ? (
                              <TrendingUp className="size-3.5" />
                            ) : (
                              <TrendingDown className="size-3.5" />
                            )}
                            {operatingMarginFinal.toFixed(1)}% margem
                          </span>
                        </CardContent>
                      </Card>
                      <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-800/50 dark:bg-blue-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                            <ShoppingBag className="size-3.5" />
                            Vendas Brutas
                          </CardDescription>
                          <CardTitle className="text-blue-700 dark:text-blue-300">
                            {formatCurrency(salesInFilterFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {soldItemsFinal} itens vendidos
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CircleDollarSign className="size-3.5" />
                            Receita
                          </CardDescription>
                          <CardTitle className="text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(salesInFilterFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {salesCountFinal} vendas confirmadas
                        </CardContent>
                      </Card>
                      <Card className="border-orange-200/70 bg-orange-50/40 dark:border-orange-800/50 dark:bg-orange-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400">
                            <TrendingDown className="size-3.5" />
                            Custos Totais
                          </CardDescription>
                          <CardTitle className="text-orange-700 dark:text-orange-400">
                            {formatCurrency(expensesInFilterFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Soma de todos os custos
                        </CardContent>
                      </Card>
                      <Card className="border-violet-200/70 bg-violet-50/40 dark:border-violet-800/50 dark:bg-violet-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300">
                            <CreditCard className="size-3.5" />
                            Ticket Medio
                          </CardDescription>
                          <CardTitle className="text-violet-700 dark:text-violet-300">
                            {formatCurrency(ticketMedioFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Valor medio por venda
                        </CardContent>
                      </Card>
                    </div>

                    {(financeOverviewCompare !== "none" ||
                      financeOverviewProjection === "month") && (
                      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/15 px-4 py-3 text-sm">
                        {financeOverviewCompare !== "none" && comparePeriodOverview && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Comparacao
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {comparePeriodOverview.subtitle}
                            </p>
                            <p className="mt-0.5 text-xs font-medium text-foreground">
                              {comparePeriodOverview.rangeLabel}
                            </p>
                            <div className="mt-2 flex flex-col gap-1.5 text-xs sm:flex-row sm:flex-wrap sm:gap-x-6">
                              <span>
                                <span className="text-muted-foreground">Receita comparada: </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatCurrency(comparePeriodOverview.revenue)}
                                </span>
                                <span className="ml-1.5 text-muted-foreground">
                                  (
                                  {formatPctVsPrevious(
                                    salesInFilterFinal,
                                    comparePeriodOverview.revenue,
                                  )}
                                  )
                                </span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Custos comparados: </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatCurrency(comparePeriodOverview.costs)}
                                </span>
                                <span className="ml-1.5 text-muted-foreground">
                                  (
                                  {formatPctVsPrevious(
                                    expensesInFilterFinal,
                                    comparePeriodOverview.costs,
                                  )}
                                  )
                                </span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Lucro comparado: </span>
                                <span
                                  className={cn(
                                    "font-medium tabular-nums",
                                    valueToneClass(comparePeriodOverview.profit),
                                  )}
                                >
                                  {formatCurrency(comparePeriodOverview.profit)}
                                </span>
                                <span className="ml-1.5 text-muted-foreground">
                                  (
                                  {formatPctVsPrevious(
                                    operatingResultFinal,
                                    comparePeriodOverview.profit,
                                  )}
                                  )
                                </span>
                              </span>
                            </div>
                            {hasOrdersFinancialData && comparePeriodOverview.ordersCount === 0 && (
                              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                Nenhum pedido no periodo de comparacao (valores podem ser zero).
                              </p>
                            )}
                          </div>
                        )}
                        {monthProjectionOverview && financeOverviewProjection === "month" && (
                          <div
                            className={cn(
                              financeOverviewCompare !== "none" && comparePeriodOverview
                                ? "border-t border-border/50 pt-3"
                                : undefined,
                            )}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Projecao do mes (linear)
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Base: {monthProjectionOverview.daysInRange} dia(s) no filtro, mes com{" "}
                              {monthProjectionOverview.daysInMonth} dias. Estimativa se o ritmo se
                              mantiver.
                            </p>
                            <div className="mt-2 flex flex-col gap-1.5 text-xs sm:flex-row sm:flex-wrap sm:gap-x-6">
                              <span>
                                <span className="text-muted-foreground">Receita projetada: </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatCurrency(monthProjectionOverview.projectedRevenue)}
                                </span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Custos projetados: </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatCurrency(monthProjectionOverview.projectedCosts)}
                                </span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Lucro projetado: </span>
                                <span
                                  className={cn(
                                    "font-medium tabular-nums",
                                    valueToneClass(monthProjectionOverview.projectedProfit),
                                  )}
                                >
                                  {formatCurrency(monthProjectionOverview.projectedProfit)}
                                </span>
                              </span>
                            </div>
                          </div>
                        )}
                        {financeOverviewProjection === "month" &&
                          monthProjectionOverview === null && (
                            <p className="text-xs text-muted-foreground">
                              O filtro ja cobre o mes civil inteiro — projecao linear nao se aplica.
                            </p>
                          )}
                      </div>
                    )}

                    <div className="grid gap-4 xl:grid-cols-3">
                      <Card className="xl:col-span-2">
                        <CardHeader className="flex flex-row items-start justify-between">
                          <div>
                            <CardDescription className="uppercase tracking-wide">
                              Evolucao
                            </CardDescription>
                            <CardTitle>Evolucao de Vendas</CardTitle>
                            <CardDescription>
                              Acompanhe o desempenho por data no intervalo filtrado.
                            </CardDescription>
                          </div>
                          <Button size="sm" variant="outline">
                            Exportar
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <FinancialEvolutionChart data={salesEvolution} />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardDescription className="uppercase tracking-wide">
                            Custos
                          </CardDescription>
                          <CardTitle>Composicao de Custos</CardTitle>
                          <CardDescription>Distribuicao dos custos</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <CostCompositionChart
                            items={costComposition}
                            total={costCompositionTotal}
                          />
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={financeOverviewTab === "sales" ? "secondary" : "outline"}
                        onClick={() => setFinanceOverviewTab("sales")}
                      >
                        Vendas
                      </Button>
                      <Button
                        type="button"
                        variant={financeOverviewTab === "ranking" ? "secondary" : "outline"}
                        onClick={() => setFinanceOverviewTab("ranking")}
                      >
                        Ranking
                      </Button>
                    </div>

                    {financeOverviewTab === "sales" ? (
                      <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                          <div>
                            <CardDescription>Detalhamento</CardDescription>
                            <CardTitle>Vendas Detalhadas</CardTitle>
                          </div>
                          <Button size="sm" variant="outline">
                            Exportar
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Pedido</TableHead>
                                <TableHead>Conta</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Valor Total</TableHead>
                                <TableHead className="text-right">Lucro</TableHead>
                                <TableHead className="text-right">Margem</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {financeDetailedOrders.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={7}
                                    className="text-center text-muted-foreground"
                                  >
                                    Sem vendas no filtro selecionado.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                financeDetailedOrders.slice(0, 10).map((order) => (
                                  <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.title}</TableCell>
                                    <TableCell className="uppercase">
                                      {financeAccountLabel}
                                    </TableCell>
                                    <TableCell>
                                      {new Date(order.orderDate).toLocaleString("pt-BR")}
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={mlStatusBadgeClass(order.status)}>
                                        {order.status === "paid" ? "Confirmado" : order.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrency(order.totalAmount)}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-semibold",
                                        valueToneClass(order.profit),
                                      )}
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        {order.profit >= 0 ? (
                                          <TrendingUp className="size-3.5" />
                                        ) : (
                                          <TrendingDown className="size-3.5" />
                                        )}
                                        {formatCurrency(order.profit)}
                                      </span>
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-semibold",
                                        valueToneClass(order.margin),
                                      )}
                                    >
                                      {order.margin.toFixed(1)}%
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                          <p className="text-xs text-muted-foreground">
                            Mostrando 1 a {Math.min(financeDetailedOrders.length, 10)} de{" "}
                            {financeDetailedOrders.length}
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardDescription>Top produtos</CardDescription>
                          <CardTitle>Ranking por lucro</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {productChampions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Sem vendas registradas no periodo filtrado.
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Produto</TableHead>
                                  <TableHead className="text-right">Unidades</TableHead>
                                  <TableHead className="text-right">Receita</TableHead>
                                  <TableHead className="text-right">Lucro</TableHead>
                                  <TableHead className="text-right">Margem</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {productChampions.map((item) => (
                                  <TableRow key={item.productId}>
                                    <TableCell className="max-w-[260px] truncate font-medium">
                                      {item.productName}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {item.unitsSold}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-blue-700 dark:text-blue-300">
                                      {formatCurrency(item.revenue)}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-semibold",
                                        valueToneClass(item.profit),
                                      )}
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        {item.profit >= 0 ? (
                                          <TrendingUp className="size-3.5" />
                                        ) : (
                                          <TrendingDown className="size-3.5" />
                                        )}
                                        {formatCurrency(item.profit)}
                                      </span>
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-semibold",
                                        valueToneClass(item.marginPercent),
                                      )}
                                    >
                                      {item.marginPercent.toFixed(1)}%
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              </section>
            )}

            {activeFinanceSection === "abc" && (
              <section className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                      <PieChart className="size-5 text-orange-500 dark:text-orange-400" />
                      Analise ABC
                    </CardTitle>
                    <CardDescription>
                      Classifique seus produtos por importancia usando a curva ABC.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-md border bg-muted/20 p-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="size-4 text-muted-foreground" />
                          <BrDateInput
                            value={filters.startDate ?? ""}
                            onValueChange={(value) =>
                              setFilters((prev) => ({
                                ...prev,
                                startDate: value || undefined,
                              }))
                            }
                          />
                          <span className="text-xs text-muted-foreground">ate</span>
                          <BrDateInput
                            value={filters.endDate ?? ""}
                            onValueChange={(value) =>
                              setFilters((prev) => ({
                                ...prev,
                                endDate: value || undefined,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <Select value="all-accounts" onValueChange={() => undefined}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as contas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all-accounts">Todas as contas</SelectItem>
                          <SelectItem value={financeAccountLabel}>{financeAccountLabel}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Filtrar por SKU"
                        value={financeOrdersSkuFilter}
                        onChange={(event) => setFinanceOrdersSkuFilter(event.target.value)}
                      />
                      <Input
                        placeholder="Filtrar por titulo"
                        value={financeOrdersTitleFilter}
                        onChange={(event) => setFinanceOrdersTitleFilter(event.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-1">
                        <Button
                          variant={financeAbcMetric === "revenue" ? "secondary" : "outline"}
                          onClick={() => setFinanceAbcMetric("revenue")}
                        >
                          Receita
                        </Button>
                        <Button
                          variant={financeAbcMetric === "quantity" ? "secondary" : "outline"}
                          onClick={() => setFinanceAbcMetric("quantity")}
                        >
                          Quantidade
                        </Button>
                        <Button
                          variant={financeAbcMetric === "profit" ? "secondary" : "outline"}
                          onClick={() => setFinanceAbcMetric("profit")}
                        >
                          Lucro
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          abcUsesOrdersData
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        }
                      >
                        {abcUsesOrdersData
                          ? "Fonte: pedidos Mercado Livre"
                          : "Fonte: movimentacoes internas (fallback)"}
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="bg-muted/20">
                        <CardHeader className="pb-2">
                          <CardDescription>Total de produtos</CardDescription>
                          <CardTitle>{abcRowsFiltered.length}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Itens analisados
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Classe A</CardDescription>
                          <CardTitle className="text-emerald-700 dark:text-emerald-400">
                            {abcSummary.A.count} ({abcSummary.A.share.toFixed(1)}%)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Maior impacto
                        </CardContent>
                      </Card>
                      <Card className="border-amber-200/70 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Classe B</CardDescription>
                          <CardTitle className="text-amber-700 dark:text-amber-300">
                            {abcSummary.B.count} ({abcSummary.B.share.toFixed(1)}%)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Impacto moderado
                        </CardContent>
                      </Card>
                      <Card className="border-rose-200/70 bg-rose-50/40 dark:border-rose-800/50 dark:bg-rose-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Classe C</CardDescription>
                          <CardTitle className="text-rose-700 dark:text-rose-300">
                            {abcSummary.C.count} ({abcSummary.C.share.toFixed(1)}%)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Baixo impacto
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Curva ABC - Grafico de Pareto</CardTitle>
                        <CardDescription>
                          Relacao entre participacao por produto e acumulado da classe.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <AbcParetoChart rows={abcRowsFiltered} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-start justify-between">
                        <CardTitle>Ranking de Produtos</CardTitle>
                        <Button size="sm" variant="outline">
                          Exportar CSV
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rank</TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right">Quantidade</TableHead>
                              <TableHead className="text-right">Receita</TableHead>
                              <TableHead className="text-right">Custo</TableHead>
                              <TableHead className="text-right">Lucro</TableHead>
                              <TableHead className="text-right">% Acumulado</TableHead>
                              <TableHead>Classe</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {abcRowsFiltered.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={8}
                                  className="text-center text-muted-foreground"
                                >
                                  Sem vendas suficientes para analise ABC no periodo.
                                </TableCell>
                              </TableRow>
                            ) : (
                              abcRowsFiltered.map((row, index) => (
                                <TableRow key={row.productId}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{row.productName}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {row.sku || "-"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{row.quantitySold}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(row.revenue)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(row.totalCost)}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right font-semibold",
                                      valueToneClass(row.profit),
                                    )}
                                  >
                                    {formatCurrency(row.profit)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {row.cumulativePercent.toFixed(1)}%
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={cn(
                                        row.abcClass === "A" &&
                                          "border-emerald-600/30 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
                                        row.abcClass === "B" &&
                                          "border-amber-600/30 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
                                        row.abcClass === "C" &&
                                          "border-rose-600/30 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
                                      )}
                                    >
                                      Classe {row.abcClass}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeFinanceSection === "dre" && (
              <section className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>DRE - Demonstracao de Resultados</CardTitle>
                      <CardDescription>
                        Analise completa de receitas, custos e resultados do periodo.
                      </CardDescription>
                    </div>
                    <Button size="sm" variant="outline">
                      Exportar
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 rounded-none border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Periodo</p>
                        <div className="grid grid-cols-[32px_1fr_80px_32px] gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              const prev = previousMonth(dreYear, dreMonth)
                              setDreMonth(prev.month)
                              setDreYear(prev.year)
                            }}
                          >
                            {"<"}
                          </Button>
                          <Select
                            value={String(dreMonth)}
                            onValueChange={(value) => setDreMonth(Number(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dreMonthOptions.map((item) => (
                                <SelectItem key={item.value} value={String(item.value)}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={String(dreYear)}
                            onChange={(event) => setDreYear(Number(event.target.value) || dreYear)}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              if (dreMonth === 12) {
                                setDreMonth(1)
                                setDreYear((prev) => prev + 1)
                                return
                              }
                              setDreMonth((prev) => prev + 1)
                            }}
                          >
                            {">"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Referencia</p>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const now = new Date()
                            setDreMonth(now.getMonth() + 1)
                            setDreYear(now.getFullYear())
                          }}
                        >
                          Mes Atual
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Contas</p>
                        <Select value="all-accounts" onValueChange={() => undefined}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todas as contas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all-accounts">Todas as contas</SelectItem>
                            <SelectItem value={financeAccountLabel}>
                              {financeAccountLabel}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 xl:col-span-2">
                        <p className="text-xs text-muted-foreground">Opcoes</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={dreComparePrevious ? "secondary" : "outline"}
                            onClick={() => setDreComparePrevious((prev) => !prev)}
                          >
                            Comparar com mes anterior
                          </Button>
                          <Button
                            variant={dreIncludeMovements ? "secondary" : "outline"}
                            onClick={() => setDreIncludeMovements((prev) => !prev)}
                          >
                            Movimentacoes incluidas
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-800/50 dark:bg-blue-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Vendas Brutas</CardDescription>
                          <CardTitle className="text-blue-700 dark:text-blue-300">
                            {formatCurrency(dreSnapshot.revenueConfirmed)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {dreSnapshot.ordersCount} pedidos
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Vendas Confirmadas</CardDescription>
                          <CardTitle className="text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(dreSnapshot.netReceived)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Ticket medio:{" "}
                          {formatCurrency(
                            dreSnapshot.ordersCount > 0
                              ? dreSnapshot.revenueConfirmed / dreSnapshot.ordersCount
                              : 0,
                          )}
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Margem de Contribuicao</CardDescription>
                          <CardTitle className={valueToneClass(dreSnapshot.grossProfit)}>
                            {formatCurrency(dreSnapshot.grossProfit)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {(dreSnapshot.revenueConfirmed > 0
                            ? (dreSnapshot.grossProfit / dreSnapshot.revenueConfirmed) * 100
                            : 0
                          ).toFixed(2)}
                          % margem
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Lucro Liquido</CardDescription>
                          <CardTitle className={valueToneClass(dreSnapshot.netProfit)}>
                            {formatCurrency(dreSnapshot.netProfit)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {(dreSnapshot.revenueConfirmed > 0
                            ? (dreSnapshot.netProfit / dreSnapshot.revenueConfirmed) * 100
                            : 0
                          ).toFixed(2)}
                          % margem
                        </CardContent>
                      </Card>
                    </div>

                    {dreComparePrevious && (
                      <div className="rounded-none border bg-muted/20 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Variacao vs mes anterior:</span>{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            valueToneClass(dreSnapshot.netProfit - drePreviousSnapshot.netProfit),
                          )}
                        >
                          {formatCurrency(dreSnapshot.netProfit - drePreviousSnapshot.netProfit)}
                        </span>
                      </div>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle>Demonstrativo de Resultados</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Categoria</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="text-right">% Receita</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dreRows.map((row) => (
                              <TableRow key={row.label} className={row.strong ? "bg-muted/20" : ""}>
                                <TableCell className={cn(row.strong && "font-semibold")}>
                                  {row.label}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right font-medium",
                                    row.color ? row.color : valueToneClass(row.value),
                                  )}
                                >
                                  {formatCurrency(row.value)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {((Math.abs(row.value) / dreRevenueBase) * 100).toFixed(2)}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <p className="text-right text-xs text-muted-foreground">
                      Periodo: {String(dreMonth).padStart(2, "0")}/{dreYear} •{" "}
                      {dreSnapshot.ordersCount} pedidos.
                    </p>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeFinanceSection === "expenses" && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2">
                    <ReceiptText className="size-5 text-primary" />
                    Registrar lancamento
                  </CardTitle>
                  <CardDescription>
                    Lance despesas da empresa ou entradas de capital com tipo e periodicidade. Use a
                    area de comprovantes abaixo ao registrar o custo; em{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => setActiveFinanceSection("history")}
                    >
                      Historico
                    </button>{" "}
                    voce ainda pode abrir o modal de anexos por linha.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {launchFeedback && (
                    <div
                      className={cn(
                        "md:col-span-2 flex items-center gap-2 rounded-none border px-3 py-2 text-sm",
                        launchFeedback.type === "success"
                          ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                          : "border-destructive/30 bg-destructive/10 text-destructive",
                      )}
                    >
                      {launchFeedback.type === "success" ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <AlertCircle className="size-4" />
                      )}
                      <span>{launchFeedback.message}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Tag className="size-3.5" />
                      Tipo do lancamento
                    </p>
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
                      <SelectTrigger className="w-full border-primary/20 bg-background">
                        <SelectValue placeholder="Tipo do lancamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Entrada de capital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CircleDollarSign className="size-3.5" />
                      Valor
                    </p>
                    <Input
                      type="number"
                      className="border-primary/20 bg-background"
                      placeholder="Valor"
                      value={launchForm.amount}
                      onChange={(event) =>
                        setLaunchForm((prev) => ({ ...prev, amount: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      Data
                    </p>
                    <BrDateInput
                      className="border-primary/20 bg-background"
                      value={launchForm.date}
                      onValueChange={(value) => setLaunchForm((prev) => ({ ...prev, date: value }))}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="size-3.5" />
                      Descricao
                    </p>
                    <Input
                      className="border-primary/20 bg-background"
                      placeholder="Descricao"
                      value={launchForm.description}
                      onChange={(event) =>
                        setLaunchForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <FolderTree className="size-3.5" />
                      Categoria
                    </p>
                    <Select
                      value={launchForm.categoryId || undefined}
                      onValueChange={(value) =>
                        setLaunchForm((prev) => ({
                          ...prev,
                          categoryId: value as Id<"categories">,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full border-primary/20 bg-background">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {(launchForm.kind === "income" ? incomeCategories : expenseCategories).map(
                          (category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {launchForm.kind === "expense" ? (
                    <div className="space-y-1">
                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CreditCard className="size-3.5" />
                        Tipo da despesa
                      </p>
                      <Select
                        value={launchForm.expenseType}
                        onValueChange={(value) =>
                          setLaunchForm((prev) => ({ ...prev, expenseType: value as ExpenseType }))
                        }
                      >
                        <SelectTrigger className="w-full border-primary/20 bg-background">
                          <SelectValue placeholder="Tipo da despesa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixo</SelectItem>
                          <SelectItem value="variable">Variavel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Store className="size-3.5" />
                        Origem da entrada
                      </p>
                      <Input
                        className="border-primary/20 bg-background"
                        placeholder="Origem da entrada (ex: aporte)"
                        value={launchForm.origin}
                        onChange={(event) =>
                          setLaunchForm((prev) => ({ ...prev, origin: event.target.value }))
                        }
                      />
                    </div>
                  )}
                  <div className="space-y-1 md:col-span-2">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Repeat className="size-3.5" />
                      Periodicidade
                    </p>
                    <Select
                      value={launchForm.periodicity}
                      onValueChange={(value) =>
                        setLaunchForm((prev) => ({
                          ...prev,
                          periodicity: value as TransactionPeriodicity,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full border-primary/20 bg-background">
                        <SelectValue placeholder="Periodicidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">Unico</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {launchForm.kind === "expense" ? (
                    <>
                      <div className="space-y-1 md:col-span-2">
                        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CreditCard className="size-3.5" />
                          Forma de pagamento
                        </p>
                        <Select
                          value={launchForm.paymentMethod}
                          onValueChange={(value) =>
                            setLaunchForm((prev) => ({
                              ...prev,
                              paymentMethod: value as PaymentMethod,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full border-primary/20 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pix">Pix</SelectItem>
                            <SelectItem value="debit">Debito</SelectItem>
                            <SelectItem value="credit">Credito (parcelas)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {launchForm.paymentMethod === "credit" ? (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Parcelas (1 a 24)</p>
                            <Input
                              type="number"
                              min={1}
                              max={24}
                              className="border-primary/20 bg-background"
                              value={launchForm.installmentCount}
                              onChange={(event) =>
                                setLaunchForm((prev) => ({
                                  ...prev,
                                  installmentCount: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Primeira cobranca</p>
                            <BrDateInput
                              className="border-primary/20 bg-background"
                              value={launchForm.firstChargeDate}
                              onValueChange={(value) =>
                                setLaunchForm((prev) => ({ ...prev, firstChargeDate: value }))
                              }
                            />
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <LancamentoFormAnexos
                    anexos={launchFormAnexos}
                    onAnexosChange={setLaunchFormAnexos}
                    disabled={launchSaving}
                  />
                  <Button
                    className="md:col-span-2 gap-2 bg-primary hover:bg-primary/90"
                    onClick={saveLaunch}
                    disabled={launchSaving}
                  >
                    {launchSaving ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {launchSaving ? "Salvando..." : "Salvar lancamento"}
                  </Button>
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
                    <Input
                      placeholder="Nome da categoria"
                      value={newCategory.name}
                      onChange={(event) =>
                        setNewCategory((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    <Select
                      value={newCategory.kind}
                      onValueChange={(value) =>
                        setNewCategory((prev) => ({
                          ...prev,
                          kind: value as FinancialCategory["kind"],
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={saveCategory}>Salvar categoria</Button>
                  </div>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex flex-wrap items-center gap-2 rounded-none border border-border p-2"
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
                              variant="outline"
                              onClick={() => {
                                setEditingCategoryId(null)
                                setEditingCategoryName("")
                              }}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{category.name}</span>
                            <Badge variant={category.kind === "income" ? "default" : "secondary"}>
                              {category.kind === "income" ? "Receita" : "Despesa"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-auto"
                              onClick={() => {
                                setEditingCategoryId(category.id as Id<"categories">)
                                setEditingCategoryName(category.name)
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
            )}

            {activeFinanceSection === "reports" && (
              <section className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Fluxo de caixa (dia/semana/mes)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {(["day", "week", "month"] as FinancialPeriod[]).map((value) => (
                          <Button
                            key={value}
                            size="sm"
                            variant={period === value ? "default" : "outline"}
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
                              <TableCell className="text-right">
                                {formatCurrency(item.net)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Evolucao mensal</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {evolutionReport.map((item) => (
                        <div
                          key={item.monthLabel}
                          className="flex items-center justify-between rounded-none border border-border p-2 text-sm"
                        >
                          <span>{item.monthLabel}</span>
                          <span>{formatCurrency(item.result)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                      <LineChart className="size-4 text-primary" />
                      Previsao de custos e lucros (proximos meses)
                    </CardTitle>
                    <CardDescription>
                      Projecao baseada na media e tendencia dos ultimos 6 meses.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge
                        variant="secondary"
                        className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                      >
                        Entrada prevista
                      </Badge>
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                        Custo previsto
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      >
                        Lucro previsto
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {forecastReport.map((item) => (
                        <Card key={item.monthLabel} className="rounded-none border-dashed">
                          <CardHeader className="pb-2">
                            <CardDescription>{item.monthLabel}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <ProgressBlock
                              label="Entrada"
                              value={item.incomeForecast}
                              maxValue={forecastMaxValue}
                              barClassName="bg-emerald-500"
                            />
                            <ProgressBlock
                              label="Custos"
                              value={item.expenseForecast}
                              maxValue={forecastMaxValue}
                              barClassName="bg-destructive"
                            />
                            <LineItem label="Lucro previsto" value={item.profitForecast} strong />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeFinanceSection === "history" && (
              <section className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>Movimentacoes Financeiras</CardTitle>
                      <CardDescription>
                        Gerencie receitas e despesas da empresa com acesso ao historico completo.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() =>
                          exportTransactionsToCsv(historyTransactions, categoryMap, {
                            attachmentCounts: attachmentCountByTransaction,
                          })
                        }
                      >
                        Exportar CSV
                      </Button>
                      <Button variant="outline" size="sm">
                        Importar
                      </Button>
                      <Button size="sm" onClick={() => setActiveFinanceSection("expenses")}>
                        Nova Movimentacao
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                      <Input
                        className="xl:col-span-2"
                        placeholder="Buscar por descricao, origem ou categoria..."
                        value={historySearch}
                        onChange={(event) => setHistorySearch(event.target.value)}
                      />
                      <Select
                        value={historyKindFilter}
                        onValueChange={(value) =>
                          setHistoryKindFilter(value as "all" | "income" | "expense")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="income">Entradas</SelectItem>
                          <SelectItem value="expense">Despesas</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={historyExpenseTypeFilter}
                        onValueChange={(value) =>
                          setHistoryExpenseTypeFilter(value as "all" | "fixed" | "variable")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de despesa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="fixed">Custo fixo</SelectItem>
                          <SelectItem value="variable">Custo operacional</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={historyPeriodicityFilter}
                        onValueChange={(value) =>
                          setHistoryPeriodicityFilter(value as "all" | TransactionPeriodicity)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Periodicidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="one_time">Unico</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="semiannual">Semestral</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-1">
                        <BrDateInput value={historyStartDate} onValueChange={setHistoryStartDate} />
                        <BrDateInput value={historyEndDate} onValueChange={setHistoryEndDate} />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Entradas</CardDescription>
                          <CardTitle className="text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(historySummary.entries)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Total de receitas
                        </CardContent>
                      </Card>
                      <Card className="border-amber-200/70 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Custo Fixo</CardDescription>
                          <CardTitle className="text-amber-700 dark:text-amber-300">
                            {formatCurrency(historySummary.fixedCost)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Custos fixos mensais
                        </CardContent>
                      </Card>
                      <Card className="border-orange-200/70 bg-orange-50/40 dark:border-orange-800/50 dark:bg-orange-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Custo Operacional</CardDescription>
                          <CardTitle className="text-orange-700 dark:text-orange-400">
                            {formatCurrency(historySummary.operationalCost)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Custos operacionais
                        </CardContent>
                      </Card>
                      <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-800/50 dark:bg-blue-950/30">
                        <CardHeader className="pb-2">
                          <CardDescription>Recorrentes</CardDescription>
                          <CardTitle className="text-blue-700 dark:text-blue-300">
                            {historySummary.recurring}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Movimentacoes recorrentes
                        </CardContent>
                      </Card>
                    </div>

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
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
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
                            setTransactionEditForm((prev) => ({
                              ...prev,
                              amount: event.target.value,
                            }))
                          }
                        />
                        <BrDateInput
                          value={transactionEditForm.date}
                          onValueChange={(value) =>
                            setTransactionEditForm((prev) => ({ ...prev, date: value }))
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
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Categoria" />
                          </SelectTrigger>
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
                            <SelectTrigger className="w-full md:col-span-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixo</SelectItem>
                              <SelectItem value="variable">Variavel</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Select
                          value={transactionEditForm.periodicity}
                          onValueChange={(value) =>
                            setTransactionEditForm((prev) => ({
                              ...prev,
                              periodicity: value as TransactionPeriodicity,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full md:col-span-2">
                            <SelectValue placeholder="Periodicidade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one_time">Unico</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="quarterly">Trimestral</SelectItem>
                            <SelectItem value="semiannual">Semestral</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 md:col-span-2">
                          <Button onClick={saveTransactionEdit}>Salvar alteracoes</Button>
                          <Button variant="outline" onClick={() => setEditingTransactionId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    {historyTransactions.length === 0 ? (
                      <div className="rounded-none border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
                        <p className="font-medium">Nenhuma movimentacao encontrada</p>
                        <p className="text-sm text-muted-foreground">
                          Ajuste os filtros ou registre uma nova movimentacao para visualizar o
                          historico.
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descricao</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Periodicidade</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-[140px]">Anexos</TableHead>
                            <TableHead>Acoes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyTransactions.map((transaction) => {
                            const anexoList = anexosByLancamentoId[transaction.id] ?? []
                            const anexoCount =
                              attachmentCountByTransaction[transaction.id] ?? anexoList.length
                            const firstThumb = anexoList.find(
                              (a) =>
                                a.remoteUrl &&
                                (a.mimeType?.startsWith("image/") ||
                                  /\.(jpe?g|png|webp)$/i.test(a.fileName ?? "")),
                            )
                            const isOverdue =
                              transaction.kind === "expense" &&
                              transaction.payStatus === "pending" &&
                              transaction.date < today
                            const hasReturn = returnBySourceId.has(transaction.id)
                            return (
                              <TableRow key={transaction.id}>
                                <TableCell>{formatDate(transaction.date)}</TableCell>
                                <TableCell className="max-w-[280px]">
                                  <div className="truncate font-medium">
                                    {transaction.description}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {transaction.installmentIndex != null &&
                                    transaction.installmentCount != null ? (
                                      <Badge variant="outline" className="text-[10px]">
                                        Parc. {transaction.installmentIndex}/
                                        {transaction.installmentCount}
                                      </Badge>
                                    ) : null}
                                    {transaction.paymentMethod ? (
                                      <Badge variant="secondary" className="text-[10px] uppercase">
                                        {transaction.paymentMethod}
                                      </Badge>
                                    ) : null}
                                    {transaction.payStatus === "pending" ? (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px]",
                                          isOverdue && "border-amber-600 text-amber-700",
                                        )}
                                      >
                                        {isOverdue ? "Atrasada" : "Pendente"}
                                      </Badge>
                                    ) : null}
                                    {transaction.payStatus === "paid" ? (
                                      <Badge variant="default" className="text-[10px]">
                                        Pago
                                      </Badge>
                                    ) : null}
                                    {hasReturn ? (
                                      <Badge variant="destructive" className="text-[10px]">
                                        Devolucao iniciada
                                      </Badge>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {categoryMap.get(transaction.categoryId)?.name ?? "Sem categoria"}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      transaction.kind === "income" ? "default" : "secondary"
                                    }
                                  >
                                    {transaction.kind === "income" ? "Entrada" : "Despesa"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {transaction.origin || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {periodicityLabel(transaction.periodicity)}
                                  </Badge>
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right font-semibold",
                                    transaction.kind === "income"
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-destructive",
                                  )}
                                >
                                  {transaction.kind === "income" ? "+" : "-"}
                                  {formatCurrency(transaction.amount)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {firstThumb?.remoteUrl ? (
                                      <img
                                        src={firstThumb.remoteUrl}
                                        alt=""
                                        className="size-9 shrink-0 rounded border object-cover"
                                      />
                                    ) : null}
                                    <Button
                                      type="button"
                                      variant={anexoCount > 0 ? "secondary" : "outline"}
                                      size="sm"
                                      className="h-8 max-w-full gap-1.5 px-2"
                                      onClick={() =>
                                        setAnexosModalLancamento({
                                          id: transaction.id,
                                          description: transaction.description,
                                        })
                                      }
                                    >
                                      <Paperclip
                                        className={cn(
                                          "size-3.5 shrink-0",
                                          anexoCount === 0 && "text-muted-foreground",
                                        )}
                                        aria-hidden
                                      />
                                      {anexoCount > 0 ? (
                                        <>
                                          <AnexosCountBadge count={anexoCount} />
                                          <span className="sr-only">{anexoCount} anexos</span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          Anexar
                                        </span>
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {transaction.origin === "Venda online" ? (
                                    <Badge variant="secondary">Editar no estoque</Badge>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {transaction.kind === "expense" &&
                                      transaction.payStatus === "pending" &&
                                      transaction.installmentPlanId ? (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          type="button"
                                          onClick={() => {
                                            if (!userId) return
                                            void markInstallmentPaidMutation({
                                              userId,
                                              transactionId: transaction.id as Id<"transactions">,
                                            })
                                          }}
                                        >
                                          Marcar pago
                                        </Button>
                                      ) : null}
                                      {transaction.kind === "expense" &&
                                      !hasReturn &&
                                      !transaction.linkedSourceTransactionId ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          type="button"
                                          onClick={() => {
                                            setReturnModal({ transaction })
                                            setReturnForm((f) => ({
                                              ...f,
                                              creditAmount: String(transaction.amount),
                                            }))
                                          }}
                                        >
                                          Devolucao
                                        </Button>
                                      ) : null}
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
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Dialog.Root
                  open={returnModal !== null}
                  onOpenChange={(o) => {
                    if (!o) setReturnModal(null)
                  }}
                >
                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-xl">
                      <Dialog.Title className="text-base font-semibold">
                        Iniciar devolucao
                      </Dialog.Title>
                      <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                        {returnModal?.transaction.description}
                      </Dialog.Description>
                      <div className="mt-4 space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Motivo</label>
                          <Select
                            value={returnForm.reason}
                            onValueChange={(v) =>
                              setReturnForm((f) => ({
                                ...f,
                                reason: v as (typeof returnForm)["reason"],
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="defect">Produto com defeito</SelectItem>
                              <SelectItem value="wrong_item">Item errado</SelectItem>
                              <SelectItem value="regret">Arrependimento</SelectItem>
                              <SelectItem value="other">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Observacao</label>
                          <Input
                            value={returnForm.note}
                            onChange={(e) => setReturnForm((f) => ({ ...f, note: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Valor do credito (R$)
                          </label>
                          <Input
                            type="number"
                            value={returnForm.creditAmount}
                            onChange={(e) =>
                              setReturnForm((f) => ({ ...f, creditAmount: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Produto (opcional — Kanban Devolvido)
                          </label>
                          <Select
                            value={returnForm.productId || "__none__"}
                            onValueChange={(v) =>
                              setReturnForm((f) => ({
                                ...f,
                                productId: v === "__none__" ? "" : (v as Id<"stockProducts">),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Nenhum" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setReturnModal(null)}
                          >
                            Cancelar
                          </Button>
                          <Button type="button" onClick={() => void submitReturn()}>
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>

                <AnexosLancamentoModal
                  open={anexosModalLancamento !== null}
                  onOpenChange={(next) => {
                    if (!next) setAnexosModalLancamento(null)
                  }}
                  lancamentoDescription={anexosModalLancamento?.description ?? ""}
                  anexos={
                    anexosModalLancamento
                      ? (anexosByLancamentoId[anexosModalLancamento.id] ?? [])
                      : []
                  }
                  onAnexosChange={(next) => {
                    if (!anexosModalLancamento) return
                    setAnexosByLancamentoId((prev) => ({
                      ...prev,
                      [anexosModalLancamento.id]: next,
                    }))
                  }}
                  persistToTransaction={
                    userId && anexosModalLancamento
                      ? {
                          uploadFiles: (files) =>
                            uploadFilesToExistingTransaction(anexosModalLancamento.id, files),
                          deleteAttachment: async (attachmentId: string): Promise<void> => {
                            await deleteTransactionAttachment({
                              userId,
                              attachmentId: attachmentId as Id<"transactionAttachments">,
                            })
                          },
                        }
                      : undefined
                  }
                />
              </section>
            )}

            {activeFinanceSection === "cashflow" && (
              <section className="mx-auto max-w-md space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">Mercado Pago</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={mpLoading}
                    onClick={fetchMpData}
                    className="text-sky-600 dark:text-sky-400 hover:text-sky-700"
                  >
                    <RefreshCw className={cn("mr-1 size-4", mpLoading && "animate-spin")} />
                    {mpLoading ? "Atualizando..." : "Atualizar"}
                  </Button>
                </div>

                {mpError && <p className="text-sm text-destructive">{mpError}</p>}

                <div className="rounded-xl border border-border/80 bg-muted/50 px-4 py-3 shadow-sm dark:bg-muted/30">
                  <p className="text-xs text-muted-foreground">Dinheiro em garantia</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(MP_SALDO_ESTIMADO_GARANTIA_MANUAL_BRL)}
                  </p>
                </div>

                <Card className="overflow-hidden border-border/80 shadow-sm">
                  <CardContent className="space-y-5 pt-6 pb-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {mpBalanceUnavailable ? (
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                Saldo estimado
                              </p>
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-normal uppercase tracking-wide"
                              >
                                Estimado
                              </Badge>
                            </div>
                            <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                              {formatCurrency(mpSaldoEstimadoSemApi)}
                            </p>
                            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                              A API nao libera o saldo oficial para esta conta. A estimativa usa os
                              ultimos lancamentos (valor{" "}
                              <span className="font-medium text-foreground">liquido</span> nas
                              vendas, como no MP) mais liberacoes previstas para{" "}
                              <span className="font-medium text-foreground">hoje</span>. Nao inclui
                              movimentos fora dessa janela nem saldo anterior — o numero do app
                              Mercado Pago e a referencia. Garantia no box acima, separada deste
                              saldo.
                            </p>
                          </div>
                        ) : mpSaldoOculto && mpBalance ? (
                          <p className="text-4xl font-bold tracking-tight tabular-nums">R$ ••••</p>
                        ) : (
                          <p className="text-4xl font-bold tracking-tight tabular-nums">
                            {mpBalance ? formatCurrency(mpBalance.availableBalance) : "—"}
                          </p>
                        )}
                      </div>
                      {!mpBalanceUnavailable && mpBalance && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-sky-600 dark:text-sky-400 hover:text-sky-700"
                          onClick={() => setMpSaldoOculto((v) => !v)}
                          aria-label={mpSaldoOculto ? "Mostrar saldo" : "Ocultar saldo"}
                        >
                          {mpSaldoOculto ? (
                            <EyeOff className="size-5" />
                          ) : (
                            <Eye className="size-5" />
                          )}
                        </Button>
                      )}
                    </div>

                    {!mpBalanceUnavailable && (
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          disabled
                          className="h-auto flex-col gap-1 border-sky-200/80 bg-sky-50 py-3 text-sky-900 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
                        >
                          <ArrowDownLeft className="size-5" />
                          <span className="text-sm font-medium">Depositar</span>
                        </Button>
                        <Button
                          variant="outline"
                          disabled
                          className="h-auto flex-col gap-1 border-sky-200/80 bg-sky-50 py-3 text-sky-900 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
                        >
                          <ArrowUpRight className="size-5" />
                          <span className="text-sm font-medium">Transferir</span>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lancamentos futuros */}
                <div className="rounded-xl border border-border/80 bg-card px-4 py-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold">Lançamentos futuros</h3>
                    <button
                      type="button"
                      disabled={mpFutureLoading}
                      onClick={() => void fetchFutureReleases()}
                      className="text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50"
                    >
                      {mpFutureLoading ? "Consultando..." : "Consultar →"}
                    </button>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-6 border-b border-border/60 pb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">A receber</p>
                      <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        + {formatCurrency(mpFuturePendingTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">A pagar</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatCurrency(mpFutureAPagarTotal)}
                      </p>
                    </div>
                  </div>

                  {mpFutureStatus && (
                    <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
                      {mpFutureStatus}
                    </p>
                  )}

                  {mpDayGroups.length === 0 && !mpFutureLoading && !mpFutureStatus ? (
                    <p className="text-sm text-muted-foreground">
                      Toque em Consultar para carregar as datas de liberacao.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {mpDayGroups.map((day) => {
                        const isOpen = mpExpandedDays.has(day.date)
                        return (
                          <div key={day.date}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between py-3 text-left hover:bg-muted/40"
                              onClick={() => {
                                setMpExpandedDays((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(day.date)) next.delete(day.date)
                                  else next.add(day.date)
                                  return next
                                })
                              }}
                            >
                              <span className="text-sm font-medium">{day.dayLabel}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                  + {formatCurrency(day.total)}
                                </span>
                                <svg
                                  className={cn(
                                    "size-4 text-muted-foreground transition-transform",
                                    isOpen && "rotate-180",
                                  )}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </div>
                            </button>
                            {isOpen && (
                              <div className="space-y-0 pb-2 pl-1">
                                {day.releases.map((r) => {
                                  const time = r.releaseDate.slice(11, 16).replace(":", "h") || "—"
                                  return (
                                    <div
                                      key={r.sourceId}
                                      className="flex items-center justify-between border-b border-border/40 py-2.5 last:border-0"
                                    >
                                      <div>
                                        <p className="text-sm">Liberação de dinheiro</p>
                                        <p className="text-xs text-muted-foreground">{time}</p>
                                      </div>
                                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                        + {formatCurrency(r.amount)}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Extrato */}
                <div className="rounded-xl border border-border/80 bg-card px-4 py-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold">Extrato</h3>
                    {mpTransactions.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setMpExtratoVerTudo((v) => !v)}
                        className="text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        {mpExtratoVerTudo ? "Ver menos" : "Ver tudo →"}
                      </button>
                    )}
                  </div>

                  {mpTransactions.length === 0 && !mpLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma movimentacao. Use Atualizar acima.
                    </p>
                  ) : (
                    <ul className="space-y-0 divide-y divide-border/60">
                      {(mpExtratoVerTudo ? mpTransactions : mpTransactions.slice(0, 3)).map(
                        (tx) => (
                          <li key={tx.id} className="flex gap-3 py-3 first:pt-0">
                            <div
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-full",
                                tx.type === "credit"
                                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Banknote className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {tx.description || "Movimentação"}
                              </p>
                              <p className="text-xs text-muted-foreground">Conta Mercado Pago</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  tx.type === "credit"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-foreground",
                                )}
                              >
                                {tx.type === "credit" ? "+" : "-"}{" "}
                                {formatCurrency(Math.abs(tx.amount))}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(tx.date).toLocaleDateString("pt-BR", {
                                  day: "numeric",
                                  month: "long",
                                })}
                              </p>
                            </div>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {activeModule === "stock" && (
          <>
            <StockLevelLegend />
            {activeStockSection === "overview" && (
              <section className="space-y-4">
                {productFeedback && (
                  <StockFeedbackAlert
                    type={productFeedback.type}
                    message={productFeedback.message}
                  />
                )}
                {!showManualStockForm ? (
                  <div className="flex justify-end">
                    <Button type="button" onClick={() => setShowManualStockForm(true)}>
                      Adicionar ao estoque / Kanban
                    </Button>
                  </div>
                ) : null}
                {showManualStockForm ? (
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                      <div>
                        <CardTitle className="text-base">Entrada manual (fornecedor)</CardTitle>
                        <CardDescription>
                          Cria produto com etapa no Kanban conforme a localizacao. Dedup: mesmo nome
                          + fornecedor + data.
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualStockForm(false)}
                      >
                        Fechar
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">Nome do produto</label>
                        <Input
                          value={manualStockForm.name}
                          onChange={(e) =>
                            setManualStockForm((p) => ({ ...p, name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Quantidade</label>
                        <Input
                          type="number"
                          min={0}
                          value={manualStockForm.quantity}
                          onChange={(e) =>
                            setManualStockForm((p) => ({ ...p, quantity: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Custo unitario</label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={manualStockForm.unitCost}
                          onChange={(e) =>
                            setManualStockForm((p) => ({ ...p, unitCost: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">Fornecedor</label>
                        <Input
                          value={manualStockForm.supplier}
                          onChange={(e) =>
                            setManualStockForm((p) => ({ ...p, supplier: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Data (dedup)</label>
                        <BrDateInput
                          value={manualStockForm.manualEntryDate}
                          onValueChange={(v) =>
                            setManualStockForm((p) => ({ ...p, manualEntryDate: v }))
                          }
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">Local / etapa</label>
                        <Select
                          value={manualStockForm.location}
                          onValueChange={(value) =>
                            setManualStockForm((p) => ({
                              ...p,
                              location: value as (typeof manualStockForm)["location"],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_stock_physical">Estoque fisico</SelectItem>
                            <SelectItem value="in_transit">Em transito</SelectItem>
                            <SelectItem value="awaiting_delivery">Aguardando entrega</SelectItem>
                            <SelectItem value="returned_supplier">
                              Devolvido ao fornecedor
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {manualStockForm.location === "in_transit" ? (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs text-muted-foreground">
                            Previsao de chegada
                          </label>
                          <BrDateInput
                            value={manualStockForm.estimatedArrival}
                            onValueChange={(v) =>
                              setManualStockForm((p) => ({ ...p, estimatedArrival: v }))
                            }
                          />
                        </div>
                      ) : null}
                      <div className="space-y-1 sm:col-span-3">
                        <label className="text-xs text-muted-foreground">Observacoes</label>
                        <Input
                          value={manualStockForm.observations}
                          onChange={(e) =>
                            setManualStockForm((p) => ({ ...p, observations: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        className="sm:col-span-2"
                        onClick={saveManualInboundStock}
                      >
                        Adicionar ao estoque / Kanban
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
                <KanbanBoard
                  products={kanbanProducts}
                  movements={movements.map((m) => ({
                    id: m.id,
                    productId: m.productId,
                    type: m.type,
                    quantity: m.quantity,
                    date: m.date,
                    note: m.note,
                  }))}
                  stockSummary={stockSummary}
                  onUpdateKanbanStatus={handleKanbanUpdateStatus}
                  onSaveProductEdits={handleKanbanSaveEdits}
                  onDeleteProduct={handleKanbanDelete}
                  onToggleProductHidden={handleToggleProductHidden}
                  kanbanTimelineEvents={kanbanTimelineEvents}
                />
              </section>
            )}

            {activeStockSection === "products" && (
              <section className="mx-auto max-w-5xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Produtos</h2>
                    <p className="text-sm text-muted-foreground">
                      Cadastre itens manualmente ou edite custo e dados; a sync do Mercado Livre
                      atualiza anuncios vinculados sem apagar produtos manuais.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveModule("mercadolivre")
                    }}
                  >
                    Ir para Mercado Livre
                  </Button>
                </div>

                {productFeedback && (
                  <StockFeedbackAlert
                    type={productFeedback.type}
                    message={productFeedback.message}
                  />
                )}

                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Novo produto</CardTitle>
                    <CardDescription>
                      Produtos sem ML ficam so aqui; com ML, prefira sync e depois ajuste custo
                      abaixo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Nome</p>
                      <Input
                        placeholder="Ex.: Liquidificador Philco 1200W"
                        value={productForm.name}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">SKU</p>
                      <Input
                        placeholder="Codigo unico"
                        value={productForm.sku}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, sku: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">Categoria</p>
                      <Input
                        placeholder="Ex.: Eletroportateis"
                        value={productForm.category}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, category: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Quantidade em estoque
                      </p>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={productForm.quantity}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, quantity: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Estoque minimo</p>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={productForm.minStock}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, minStock: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Custo unitario (R$)
                      </p>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0,00"
                        value={productForm.unitCost}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, unitCost: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Preco de venda (opcional)
                      </p>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="—"
                        value={productForm.sellingPrice}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, sellingPrice: event.target.value }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button onClick={() => void saveProduct()} disabled={!userId}>
                        Adicionar produto
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {editingProductId && (
                  <Card className="border-primary/30 bg-primary/3 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Editar produto</CardTitle>
                      <CardDescription>
                        Altere o custo unitario para refletir no financeiro, DRE e pedidos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Nome</p>
                        <Input
                          value={productEditForm.name}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">SKU</p>
                        <Input
                          value={productEditForm.sku}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, sku: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <p className="text-xs font-medium text-muted-foreground">Categoria</p>
                        <Input
                          value={productEditForm.category}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({
                              ...prev,
                              category: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Quantidade</p>
                        <Input
                          type="number"
                          min={0}
                          value={productEditForm.quantity}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({
                              ...prev,
                              quantity: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Estoque minimo</p>
                        <Input
                          type="number"
                          min={0}
                          value={productEditForm.minStock}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({
                              ...prev,
                              minStock: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Custo unitario (R$)
                        </p>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={productEditForm.unitCost}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({
                              ...prev,
                              unitCost: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Preco de venda (opcional)
                        </p>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={productEditForm.sellingPrice}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({
                              ...prev,
                              sellingPrice: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <Button onClick={() => void saveProductEdit()}>Salvar alteracoes</Button>
                        <Button variant="outline" onClick={() => setEditingProductId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Catalogo</CardTitle>
                    <CardDescription>
                      {products.length === 0
                        ? "Nenhum produto ainda. Adicione acima ou sincronize no Mercado Livre."
                        : `${products.length} produto(s).`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Produto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                          <TableHead className="text-right">Custo un.</TableHead>
                          <TableHead className="hidden md:table-cell text-right">Preco</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id} className="align-middle">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                      —
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="line-clamp-2 font-medium leading-snug">
                                    {product.name}
                                  </p>
                                  {product.mlItemId && (
                                    <p className="text-xs text-muted-foreground">
                                      ML {product.mlItemId}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {product.category}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatCurrency(product.unitCost)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                              {product.sellingPrice != null
                                ? formatCurrency(product.sellingPrice)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <StockQuantityIndicator quantity={product.quantity} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditProduct(product)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
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

            {activeStockSection === "movements" && (
              <section className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Movimentacao de estoque</CardTitle>
                    <CardDescription>
                      Use “Venda” para registrar a saida e refletir automaticamente no financeiro.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Select
                      value={movementForm.productId || undefined}
                      onValueChange={(value) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          productId: value as Id<"stockProducts">,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={movementForm.type}
                      onValueChange={(value) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          type: value as StockMovement["type"],
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Venda</SelectItem>
                        <SelectItem value="in">Entrada</SelectItem>
                        <SelectItem value="out">Saida</SelectItem>
                        <SelectItem value="adjustment">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Quantidade"
                      value={movementForm.quantity}
                      onChange={(event) =>
                        setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))
                      }
                    />
                    <BrDateInput
                      value={movementForm.date}
                      onValueChange={(value) =>
                        setMovementForm((prev) => ({ ...prev, date: value }))
                      }
                    />
                    {movementForm.type === "sale" && (
                      <Input
                        type="number"
                        placeholder="Preco unitario da venda"
                        value={movementForm.unitPrice}
                        onChange={(event) =>
                          setMovementForm((prev) => ({ ...prev, unitPrice: event.target.value }))
                        }
                      />
                    )}
                    <Input
                      placeholder="Observacao"
                      value={movementForm.note}
                      onChange={(event) =>
                        setMovementForm((prev) => ({ ...prev, note: event.target.value }))
                      }
                    />
                    <Button onClick={saveMovement} disabled={products.length === 0}>
                      Salvar movimentacao
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Ultimas movimentacoes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements
                          .slice()
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .slice(0, 10)
                          .map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell>{formatDate(movement.date)}</TableCell>
                              <TableCell>
                                {productMap.get(movement.productId)?.name ?? "Produto removido"}
                              </TableCell>
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
                <CardHeader>
                  <CardTitle>Historico de estoque</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Observacao</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements
                        .slice()
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>{formatDate(movement.date)}</TableCell>
                            <TableCell>
                              {productMap.get(movement.productId)?.name ?? "Produto removido"}
                            </TableCell>
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
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Store className="size-5" />
                  Mercado Livre
                </CardTitle>
                <CardDescription>
                  Conecte sua conta e consulte anuncios, pedidos e metricas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mlLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando status da conexao...</p>
                ) : mlConnectionStatus?.connected ? (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Status:</span>{" "}
                      <Badge variant="default" className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Conectado
                      </Badge>
                    </p>
                    <p>
                      <span className="font-medium">Conta ML:</span>{" "}
                      {mlConnectionStatus.mlNickname ?? mlConnectionStatus.mlUserId}
                    </p>
                    <p className="text-muted-foreground">
                      Token expira em:{" "}
                      {new Date(mlConnectionStatus.expiresAt).toLocaleString("pt-BR")}
                    </p>
                    <div className="pt-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void disconnectMlAccount()}
                        disabled={mlDisconnecting}
                      >
                        {mlDisconnecting ? "Desconectando..." : "Desconectar Mercado Livre"}
                      </Button>
                    </div>
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
                      <Store className="size-4" />
                      Conectar Mercado Livre
                    </Button>
                  </div>
                )}
                {mlError && <p className="text-sm text-destructive">{mlError}</p>}
                {mlInfo && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">{mlInfo}</p>
                )}
              </CardContent>
            </Card>

            {mlConnectionStatus?.connected && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LayoutDashboard className="size-5" />
                      Mini hub Mercado Livre
                    </CardTitle>
                    <CardDescription>
                      Consulte indicadores e gerencie seus anuncios sem sair do BranchHub.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {mlSyncingStock && (
                        <Badge variant="outline" className="border-warning text-warning">
                          <RefreshCw className="mr-1 size-3.5 animate-spin" />
                          Sincronizando estoque...
                        </Badge>
                      )}
                      {!mlSyncingStock && mlLastSyncAt && (
                        <div className="inline-flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="border-emerald-600/50 text-emerald-700 dark:text-emerald-400"
                          >
                            Ultima sync ha {formatElapsedSeconds(mlLastSyncAt, mlNowTimestamp)}
                            {mlLastSyncDurationMs !== null
                              ? ` (durou ${(mlLastSyncDurationMs / 1000).toFixed(1)}s)`
                              : ""}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full"
                            aria-label="Atualizar sincronizacao"
                            title="Atualizar sincronizacao"
                            onClick={() => void refreshMlSync()}
                          >
                            <RefreshCw className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Card className="rounded-none border-dashed">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1">
                            <ShoppingBag className="size-3.5" />
                            Anuncios
                          </CardDescription>
                          <CardTitle className="text-lg">{mlListingsCount ?? "-"}</CardTitle>
                        </CardHeader>
                      </Card>
                      <Card className="rounded-none border-dashed">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1">
                            <ClipboardList className="size-3.5" />
                            Pedidos
                          </CardDescription>
                          <CardTitle className="text-lg">{mlOrdersCount ?? "-"}</CardTitle>
                        </CardHeader>
                      </Card>
                      <Card className="rounded-none border-dashed">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1">
                            <DollarSign className="size-3.5" />
                            Faturamento amostral
                          </CardDescription>
                          <CardTitle className="text-lg">
                            {mlMetrics ? formatCurrency(mlMetrics.grossAmountSample) : "-"}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      <Card className="rounded-none border-dashed">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1">
                            <LineChart className="size-3.5" />
                            Ticket medio
                          </CardDescription>
                          <CardTitle className="text-lg">
                            {mlMetrics ? formatCurrency(mlMetrics.averageTicketSample) : "-"}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {activeMlSection === "listings" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Catalogos</CardTitle>
                      <CardDescription>
                        Inclui anuncios de catalogo ativos e pausados; ordem padrao prioriza
                        ganhando e deixa pausados por ultimo. Itens sem catalog_product_id ou alem
                        dos primeiros 50 IDs da busca ML nao entram.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <Card className="rounded-none border-dashed">
                          <CardHeader className="pb-2">
                            <CardDescription>Total</CardDescription>
                            <CardTitle className="text-lg">
                              {mlCatalogCompetitionSummary?.total ?? 0}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card className="rounded-none border-dashed">
                          <CardHeader className="pb-2">
                            <CardDescription className="text-emerald-700 dark:text-emerald-400">
                              Ganhando
                            </CardDescription>
                            <CardTitle className="text-lg text-emerald-700 dark:text-emerald-400">
                              {mlCatalogCompetitionSummary?.winning ?? 0}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card className="rounded-none border-dashed">
                          <CardHeader className="pb-2">
                            <CardDescription className="text-amber-700 dark:text-amber-300">
                              Dividindo 1o
                            </CardDescription>
                            <CardTitle className="text-lg text-amber-700 dark:text-amber-300">
                              {mlCatalogCompetitionSummary?.sharingFirstPlace ?? 0}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card className="rounded-none border-dashed">
                          <CardHeader className="pb-2">
                            <CardDescription className="text-red-700 dark:text-red-300">
                              Perdendo
                            </CardDescription>
                            <CardTitle className="text-lg text-red-700 dark:text-red-300">
                              {mlCatalogCompetitionSummary?.competing ?? 0}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card className="rounded-none border-dashed">
                          <CardHeader className="pb-2">
                            <CardDescription className="text-slate-700 dark:text-slate-300">
                              Listado / sem exposicao
                            </CardDescription>
                            <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
                              {mlCatalogCompetitionSummary?.listed ?? 0}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                        <Card className="rounded-none border-dashed">
                          <CardHeader className="pb-2">
                            <CardDescription className="text-amber-800 dark:text-amber-200">
                              Pausados
                            </CardDescription>
                            <CardTitle className="text-lg text-amber-800 dark:text-amber-200">
                              {mlCatalogCompetitionSummary?.paused ?? 0}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <Input
                          placeholder="Buscar por titulo, item ou catalogo..."
                          value={mlCatalogSearchTerm}
                          onChange={(event) => setMlCatalogSearchTerm(event.target.value)}
                          className="xl:col-span-2"
                        />
                        <Select
                          value={mlCatalogStatusFilter}
                          onValueChange={setMlCatalogStatusFilter}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todos os status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="winning">Ganhando</SelectItem>
                            <SelectItem value="sharing_first_place">Dividindo 1o</SelectItem>
                            <SelectItem value="competing">Perdendo</SelectItem>
                            <SelectItem value="listed">Listado</SelectItem>
                            <SelectItem value="not_listed">Sem exposicao</SelectItem>
                            <SelectItem value="paused">Pausado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={mlCatalogSortBy} onValueChange={setMlCatalogSortBy}>
                          <SelectTrigger>
                            <SelectValue placeholder="Ordenar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="priority_desc">
                              Prioridade (ativos/ganhando primeiro, pausados por ultimo)
                            </SelectItem>
                            <SelectItem value="difference_desc">
                              Diferenca de preco (maior)
                            </SelectItem>
                            <SelectItem value="difference_asc">
                              Diferenca de preco (menor)
                            </SelectItem>
                            <SelectItem value="price_desc">Maior preco</SelectItem>
                            <SelectItem value="price_asc">Menor preco</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => void loadMlCatalogCompetition()}>
                          Recarregar
                        </Button>
                        <Button variant="outline" onClick={exportCatalogCompetitionCsv}>
                          Exportar
                        </Button>
                      </div>

                      {mlCatalogCompetitionLoading ? (
                        <p className="text-sm text-muted-foreground">
                          Carregando competicao de catalogo...
                        </p>
                      ) : filteredCatalogCompetitionRows.length === 0 ? (
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>Nenhum item de catalogo na lista com os filtros atuais.</p>
                          <p className="text-xs leading-relaxed">
                            Isso e normal se voce alterou o anuncio no site do ML (saiu do catalogo,
                            item em revisao ou sem buy box) ou se os anuncios estao pausados sem
                            competicao de buy box. O card &quot;Anuncios&quot; acima usa o total
                            geral; esta grade so mostra ofertas elegiveis a competicao. Use
                            Recarregar apos mudancas no ML.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredCatalogCompetitionRows.map((row) => {
                            const product = productMapByMlItemId.get(row.itemId)
                            const unitCost = product?.unitCost ?? 0
                            const difference = row.price - (row.winnerPrice ?? row.price)
                            const estimatedFees = row.price * HUB_ML_AVG_FEE_RATE
                            const estimatedProfitPerSale =
                              row.price -
                              unitCost -
                              estimatedFees -
                              HUB_CENTRALIZE_SHIPPING_PER_ITEM -
                              HUB_CENTRALIZE_PACKAGING_PER_ITEM
                            return (
                              <Card key={row.itemId} className="rounded-none border">
                                <CardContent className="pt-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className="h-12 w-12 overflow-hidden rounded border bg-muted">
                                        {row.thumbnail ? (
                                          <img
                                            src={row.thumbnail}
                                            alt={row.title}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                            Sem imagem
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-medium">{row.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {row.catalogProductId ?? row.itemId}
                                        </p>
                                      </div>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={catalogCompetitionBadgeClass(
                                        row.competitionStatus,
                                      )}
                                    >
                                      {catalogCompetitionLabel(row.competitionStatus)}
                                    </Badge>
                                  </div>

                                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                                    <div>
                                      <p className="text-muted-foreground">Seu Preco</p>
                                      <p className="font-semibold">{formatCurrency(row.price)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Preco Ganhador</p>
                                      <p className="font-semibold">
                                        {row.winnerPrice !== null
                                          ? formatCurrency(row.winnerPrice)
                                          : "-"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Diferenca</p>
                                      <p
                                        className={cn(
                                          "font-semibold",
                                          difference > 0
                                            ? "text-red-700 dark:text-red-300"
                                            : difference < 0
                                              ? "text-emerald-700 dark:text-emerald-400"
                                              : "text-muted-foreground",
                                        )}
                                      >
                                        {difference > 0 ? "+" : ""}
                                        {formatCurrency(difference)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Lucro/Venda</p>
                                      <p
                                        className={cn(
                                          "font-semibold",
                                          estimatedProfitPerSale >= 0
                                            ? "text-emerald-700 dark:text-emerald-400"
                                            : "text-red-700 dark:text-red-300",
                                        )}
                                      >
                                        ~ {formatCurrency(estimatedProfitPerSale)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openAnalysis(row.itemId)}
                                    >
                                      Abrir Analise
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {activeMlSection === "orders" && (
                  <section className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="size-5" />
                          Pedidos
                        </CardTitle>
                        <CardDescription>
                          Monitore pedidos com filtros e detalhes operacionais.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                        <BrDateInput
                          value={mlOrdersPeriodDate}
                          onValueChange={setMlOrdersPeriodDate}
                          ariaLabel="Selecionar periodo"
                        />
                        <Input
                          placeholder="Buscar pedido..."
                          value={mlOrdersSearch}
                          onChange={(event) => setMlOrdersSearch(event.target.value)}
                          aria-label="Buscar pedido"
                        />
                        <Input
                          placeholder="Filtrar por SKU"
                          value={mlOrdersSkuFilter}
                          onChange={(event) => setMlOrdersSkuFilter(event.target.value)}
                        />
                        <Select
                          value={mlOrdersStatusFilter}
                          onValueChange={setMlOrdersStatusFilter}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Todos os status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="paid">paid</SelectItem>
                            <SelectItem value="confirmed">confirmed</SelectItem>
                            <SelectItem value="cancelled">cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={mlOrdersShippingFilter}
                          onValueChange={setMlOrdersShippingFilter}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Tipo de envio" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tipo de envio</SelectItem>
                            <SelectItem value="me2">me2</SelectItem>
                            <SelectItem value="custom">custom</SelectItem>
                            <SelectItem value="not_specified">not_specified</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 rounded-none border px-3">
                          <input
                            id="orders-no-sku"
                            type="checkbox"
                            checked={mlOrdersOnlyNoSku}
                            onChange={(event) => setMlOrdersOnlyNoSku(event.target.checked)}
                          />
                          <label htmlFor="orders-no-sku" className="text-sm text-muted-foreground">
                            Sem SKU
                          </label>
                        </div>
                        <Select value={mlOrdersSortBy} onValueChange={setMlOrdersSortBy}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Ordenar por" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date_desc">Mais recentes</SelectItem>
                            <SelectItem value="date_asc">Mais antigos</SelectItem>
                            <SelectItem value="amount_desc">Maior valor</SelectItem>
                            <SelectItem value="amount_asc">Menor valor</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>

                    {mlOrdersLoading ? (
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
                        </CardContent>
                      </Card>
                    ) : filteredMlOrders.length === 0 ? (
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">
                            Nenhum pedido encontrado com os filtros atuais.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      filteredMlOrders.map((order) => {
                        const step = mlShippingStep(order.shippingStatus)
                        const firstItem = order.items[0]
                        const stockProduct = firstItem?.id
                          ? productMapByMlItemId.get(firstItem.id)
                          : undefined
                        const quantity = firstItem?.quantity ?? 0
                        const estimatedCost =
                          (stockProduct?.unitCost ?? 0) * quantity +
                          quantity * HUB_CENTRALIZE_SHIPPING_PER_ITEM +
                          quantity * HUB_CENTRALIZE_PACKAGING_PER_ITEM
                        const payout = order.totalPaidAmount
                        const profit = payout - estimatedCost
                        const margin = payout > 0 ? (profit / payout) * 100 : 0
                        return (
                          <Card key={order.id} className="rounded-none">
                            <CardContent className="space-y-4 pt-6">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`Selecionar pedido ${order.id}`}
                                  />
                                  <p className="font-semibold">#{order.id}</p>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(order.id)
                                      setMlInfo(`Numero do pedido #${order.id} copiado.`)
                                    }}
                                    aria-label={`Copiar pedido ${order.id}`}
                                  >
                                    <Copy className="size-3.5" />
                                  </Button>
                                  <Badge variant="outline" className="text-xs">
                                    <Truck className="mr-1 size-3.5" />
                                    {mlShippingLabel(order)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <p className="inline-flex items-center gap-1">
                                    <DollarSign className="size-3.5 text-muted-foreground" />
                                    {formatCurrency(order.totalAmount)}
                                  </p>
                                  <p
                                    className={cn(
                                      "inline-flex items-center gap-1",
                                      profit >= 0
                                        ? "text-emerald-700 dark:text-emerald-400"
                                        : "text-destructive",
                                    )}
                                  >
                                    <TrendingUp className="size-3.5" />
                                    {profit >= 0 ? "+" : "-"}
                                    {formatCurrency(Math.abs(profit))}
                                  </p>
                                  <p className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                    <Percent className="size-3.5" />
                                    {margin.toFixed(1)}%
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                                <div className="flex gap-3">
                                  <div className="h-12 w-12 overflow-hidden rounded border bg-muted">
                                    {order.itemThumbnail ? (
                                      <img
                                        src={order.itemThumbnail}
                                        alt={firstItem?.title ?? "Item"}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                      />
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    <Package className="mr-1 inline size-3.5" />
                                    {firstItem?.title ?? "Sem item"}
                                  </p>
                                  {order.isCatalogListing && (
                                    <Badge variant="outline" className="text-xs">
                                      <Tag className="mr-1 size-3.5" />
                                      Catalogo
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <Badge
                                    variant="outline"
                                    className={mlStatusBadgeClass(order.status)}
                                  >
                                    {mlOrderStatusLabel(order.status)}
                                  </Badge>
                                </div>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                                <div className="space-y-1 text-xs">
                                  <p>
                                    <CreditCard className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Comprador:</span>{" "}
                                    {order.buyerNickname}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    <Wallet className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Pagamento:</span>{" "}
                                    {order.paymentMethod}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    <MapPin className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Endereco:</span>{" "}
                                    {[order.receiverAddressLine, order.receiverCityState]
                                      .filter(Boolean)
                                      .join(" - ") || "Nao informado"}
                                  </p>
                                </div>
                                <div className="space-y-1 text-xs">
                                  <p>
                                    <CalendarDays className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Data:</span>{" "}
                                    {order.dateCreated
                                      ? new Date(order.dateCreated).toLocaleString("pt-BR")
                                      : "-"}
                                  </p>
                                  <p>
                                    <CalendarDays className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Liberacao:</span>{" "}
                                    {order.dateClosed
                                      ? new Date(order.dateClosed).toLocaleDateString("pt-BR")
                                      : "-"}
                                  </p>
                                  <p>
                                    <CalendarDays className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Entrega:</span>{" "}
                                    {order.dateDelivered
                                      ? new Date(order.dateDelivered).toLocaleDateString("pt-BR")
                                      : "-"}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span
                                      className={cn(
                                        "h-2.5 w-2.5 rounded-full",
                                        step >= 1 ? "bg-emerald-600" : "bg-muted",
                                      )}
                                    />
                                    Pronto
                                    <span
                                      className={cn(
                                        "ml-2 h-2.5 w-2.5 rounded-full",
                                        step >= 2 ? "bg-emerald-600" : "bg-muted",
                                      )}
                                    />
                                    Em transito
                                    <span
                                      className={cn(
                                        "ml-2 h-2.5 w-2.5 rounded-full",
                                        step >= 3 ? "bg-emerald-600" : "bg-muted",
                                      )}
                                    />
                                    Entregue
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    <Truck className="mr-1 inline size-3.5" />
                                    Envio: {order.shippingStatus} ({order.shippingMode})
                                  </p>
                                </div>
                                <div className="grid min-w-[160px] gap-2">
                                  <Button size="sm" variant="outline">
                                    <Printer className="size-3.5" />
                                    Imprimir
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openOrderCostAnalysis(
                                        order,
                                        stockProduct?.unitCost ?? 0,
                                        firstItem?.quantity ?? 0,
                                      )
                                    }
                                  >
                                    <BarChart3 className="size-3.5" />
                                    Custos da venda
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })
                    )}
                  </section>
                )}

                {activeMlSection === "metrics" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Metricas</CardTitle>
                      <CardDescription>
                        Resumo de desempenho baseado na amostra atual.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mlMetricsLoading ? (
                        <p className="text-sm text-muted-foreground">Carregando metricas...</p>
                      ) : !mlMetrics ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Nenhuma metrica carregada no momento.
                          </p>
                          <Button variant="outline" onClick={() => void loadMlMetrics()}>
                            Carregar metricas
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Card className="rounded-none border-dashed">
                              <CardHeader className="pb-2">
                                <CardDescription>Pedidos na amostra</CardDescription>
                                <CardTitle className="text-lg">{mlMetrics.sampleSize}</CardTitle>
                              </CardHeader>
                            </Card>
                            <Card className="rounded-none border-dashed">
                              <CardHeader className="pb-2">
                                <CardDescription>Pedidos concluidos</CardDescription>
                                <CardTitle className="text-lg">
                                  {mlMetrics.completedOrdersSample}
                                </CardTitle>
                              </CardHeader>
                            </Card>
                            <Card className="rounded-none border-dashed">
                              <CardHeader className="pb-2">
                                <CardDescription>Pedidos cancelados</CardDescription>
                                <CardTitle className="text-lg">
                                  {mlMetrics.cancelledOrdersSample}
                                </CardTitle>
                              </CardHeader>
                            </Card>
                            <Card className="rounded-none border-dashed">
                              <CardHeader className="pb-2">
                                <CardDescription>Ultimo pedido</CardDescription>
                                <CardTitle className="text-sm">
                                  {mlMetrics.lastOrderDate
                                    ? new Date(mlMetrics.lastOrderDate).toLocaleString("pt-BR")
                                    : "-"}
                                </CardTitle>
                              </CardHeader>
                            </Card>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-muted-foreground">Faturamento amostral:</span>{" "}
                              <span className="font-medium">
                                {formatCurrency(mlMetrics.grossAmountSample)}
                              </span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Ticket medio:</span>{" "}
                              <span className="font-medium">
                                {formatCurrency(mlMetrics.averageTicketSample)}
                              </span>
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {mlOrderCostAnalysis && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-none">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle>Analise detalhada de custos e margens</CardTitle>
                          <CardDescription>
                            Pedido #{mlOrderCostAnalysis.orderId} - {mlOrderCostAnalysis.title}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setMlOrderCostAnalysis(null)}
                        >
                          <X className="size-4" />
                          Fechar
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-none border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          Fonte dos custos:{" "}
                          {mlOrderCostAnalysis.source === "ml_api"
                            ? "API Mercado Livre"
                            : "API Mercado Livre + fallback interno"}
                        </div>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Wallet className="size-4" />
                              Resumo financeiro
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 sm:grid-cols-4">
                            <div className="rounded-none border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground">Receita total</p>
                              <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(mlOrderCostAnalysis.revenueTotal)}
                              </p>
                            </div>
                            <div className="rounded-none border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground">Valor recebido</p>
                              <p className="text-2xl font-semibold">
                                {formatCurrency(mlOrderCostAnalysis.receivedAmount)}
                              </p>
                            </div>
                            <div className="rounded-none border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground">Custo do produto</p>
                              <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400">
                                {formatCurrency(mlOrderCostAnalysis.productCost)}
                              </p>
                            </div>
                            <div className="rounded-none border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground">Lucro liquido</p>
                              <p
                                className={cn(
                                  "text-2xl font-semibold",
                                  mlOrderCostAnalysis.netProfit >= 0
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-destructive",
                                )}
                              >
                                {formatCurrency(mlOrderCostAnalysis.netProfit)}
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <BarChart3 className="size-4" />
                              Composicao de custos
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {[
                              {
                                label: "Custo do produto",
                                value: mlOrderCostAnalysis.productCost,
                                color: "bg-orange-500",
                              },
                              {
                                label: "Frete",
                                value: mlOrderCostAnalysis.shippingCost,
                                color: "bg-violet-500",
                              },
                              {
                                label: "Centralize - envio fixo",
                                value: mlOrderCostAnalysis.centralizeShipping,
                                color: "bg-cyan-500",
                              },
                              {
                                label: "Centralize - embalagem fixa",
                                value: mlOrderCostAnalysis.centralizePackaging,
                                color: "bg-sky-500",
                              },
                              {
                                label: "Taxa ML",
                                value: mlOrderCostAnalysis.mlFee,
                                color: "bg-amber-500",
                              },
                              {
                                label: "Impostos",
                                value: mlOrderCostAnalysis.taxes,
                                color: "bg-red-500",
                              },
                              {
                                label: "Bonus frete",
                                value: mlOrderCostAnalysis.shippingBonus,
                                color: "bg-emerald-500",
                                positive: true,
                              },
                            ].map((row) => {
                              const base = mlOrderCostAnalysis.revenueTotal || 1
                              const percent = Math.max(0, (row.value / base) * 100)
                              return (
                                <div key={row.label} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <p>{row.label}</p>
                                    <p
                                      className={cn(
                                        "font-medium",
                                        row.positive
                                          ? "text-emerald-700 dark:text-emerald-400"
                                          : "text-foreground",
                                      )}
                                    >
                                      {row.positive ? "+" : ""}
                                      {formatCurrency(row.value)} ({percent.toFixed(1)}%)
                                    </p>
                                  </div>
                                  <div className="h-2 rounded-none bg-muted">
                                    <div
                                      className={cn("h-2 rounded-none", row.color)}
                                      style={{ width: `${Math.min(percent, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                              <span>Total de custos</span>
                              <span>{formatCurrency(mlOrderCostAnalysis.totalCosts)}</span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <LineChart className="size-4" />
                              Analise de margens
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-none bg-emerald-500/10 p-3">
                              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                Margem de contribuicao
                              </p>
                              <p className="text-3xl font-semibold text-emerald-700 dark:text-emerald-400">
                                {mlOrderCostAnalysis.contributionMargin.toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(mlOrderCostAnalysis.netProfit)} de lucro liquido
                              </p>
                            </div>
                            <div className="rounded-none bg-primary/10 p-3">
                              <p className="text-sm font-medium text-primary">ROI</p>
                              <p className="text-3xl font-semibold text-primary">
                                {mlOrderCostAnalysis.roi.toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Retorno sobre investimento em produto
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeModule === "branchhunter" && activeHunterSection === "padrao" && (
          <Card className="border-emerald-600/40">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-400">
                Branch Hunter
              </CardTitle>
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

        {activeModule === "branchhunter" && activeHunterSection === "analise-anuncio" && (
          <HunterAnalysisPage />
        )}

        {activeModule === "mercadolivre" && analysisItemId && (
          <AnalysisModal itemId={analysisItemId} onClose={() => setAnalysisItemId(null)} />
        )}
      </section>
    </main>
  )
}

function FinancialEvolutionChart({ data }: { data: SalesEvolutionPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sem dados suficientes para montar o grafico.</p>
    )
  }

  const width = 760
  const height = 280
  const paddingLeft = 58
  const paddingRight = 48
  const paddingTop = 18
  const paddingBottom = 38
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const revenueMax = Math.max(...data.map((item) => item.revenue), 1)
  const profitMax = Math.max(...data.map((item) => Math.max(0, item.profit)), 1)
  const moneyMax = Math.max(revenueMax, profitMax, 1)
  const ordersMax = Math.max(...data.map((item) => item.orders), 1)

  const xForIndex = (index: number) =>
    paddingLeft + (index / Math.max(1, data.length - 1)) * chartWidth
  const yForMoney = (value: number) =>
    paddingTop + (1 - Math.max(0, value) / moneyMax) * chartHeight
  const yForOrders = (value: number) =>
    paddingTop + (1 - Math.max(0, value) / Math.max(1, ordersMax)) * chartHeight

  const toPolyline = (values: number[], yFn: (v: number) => number) =>
    values.map((value, index) => `${xForIndex(index)},${yFn(value)}`).join(" ")

  const revenueValues = data.map((item) => item.revenue)
  const profitValues = data.map((item) => item.profit)
  const ordersValues = data.map((item) => item.orders)

  const revenuePoints = toPolyline(revenueValues, yForMoney)
  const profitPoints = toPolyline(profitValues, yForMoney)
  const revenueArea = `${paddingLeft},${paddingTop + chartHeight} ${revenuePoints} ${paddingLeft + chartWidth},${paddingTop + chartHeight}`
  const yTicks = [0, 0.25, 0.5, 0.75, 1]
  const barStep = chartWidth / Math.max(1, data.length)
  const barWidth = Math.max(8, Math.min(20, barStep * 0.45))

  return (
    <div className="space-y-3">
      <div className="h-[280px] rounded-none border border-border bg-muted/10 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          {yTicks.map((tick) => {
            const y = paddingTop + (1 - tick) * chartHeight
            const moneyValue = moneyMax * tick
            const ordersValue = Math.round(ordersMax * tick)
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke="rgba(148,163,184,0.28)"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  className="fill-muted-foreground"
                >
                  {formatCurrency(moneyValue)}
                </text>
                <text
                  x={paddingLeft + chartWidth + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="10"
                  className="fill-muted-foreground"
                >
                  {ordersValue}
                </text>
              </g>
            )
          })}

          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={paddingLeft + chartWidth}
            y2={paddingTop + chartHeight}
            stroke="rgba(100,116,139,0.55)"
          />

          {ordersValues.map((value, index) => {
            const xCenter = xForIndex(index)
            const y = yForOrders(value)
            const h = paddingTop + chartHeight - y
            return (
              <rect
                key={`order-bar-${data[index]?.key ?? index}`}
                x={xCenter - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(1, h)}
                fill="rgba(168,85,247,0.38)"
                stroke="rgba(168,85,247,0.75)"
                strokeWidth="0.8"
                rx="3"
              />
            )
          })}

          <polygon points={revenueArea} fill="rgba(59, 130, 246, 0.12)" />
          <polyline points={revenuePoints} fill="none" stroke="#2563eb" strokeWidth="3" />
          <polyline points={profitPoints} fill="none" stroke="#16a34a" strokeWidth="2.5" />

          {revenueValues.map((value, index) => (
            <circle
              key={`rev-dot-${data[index]?.key ?? index}`}
              cx={xForIndex(index)}
              cy={yForMoney(value)}
              r="3.2"
              fill="#2563eb"
            />
          ))}

          {profitValues.map((value, index) => (
            <circle
              key={`profit-dot-${data[index]?.key ?? index}`}
              cx={xForIndex(index)}
              cy={yForMoney(value)}
              r="2.8"
              fill="#16a34a"
            />
          ))}

          {data.map((item, index) => (
            <text
              key={`xlabel-${item.key}`}
              x={xForIndex(index)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              className="fill-muted-foreground"
            >
              {item.label}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          Receita
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Lucro
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Pedidos (barras)
        </span>
      </div>
    </div>
  )
}

function CostCompositionChart({
  items,
  total,
}: {
  items: Array<{ categoryName: string; total: number }>
  total: number
}) {
  if (!items.length || total <= 0) {
    return (
      <p className="text-sm text-muted-foreground">Sem custos suficientes para compor grafico.</p>
    )
  }

  const palette = [
    "#06b6d4",
    "#22c55e",
    "#ef4444",
    "#8b5cf6",
    "#3b82f6",
    "#f97316",
    "#d946ef",
    "#14b8a6",
    "#eab308",
    "#84cc16",
    "#fb923c",
    "#f59e0b",
  ]
  const segments: string[] = []
  let accumulated = 0
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const start = (accumulated / total) * 360
    accumulated += item.total
    const end = (accumulated / total) * 360
    segments.push(`${palette[index % palette.length]} ${start}deg ${end}deg`)
  }

  return (
    <div className="grid gap-4 md:grid-cols-[170px_1fr] md:items-center">
      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-8 border-background bg-background shadow-inner">
        <div
          className="relative h-36 w-36 rounded-full"
          style={{
            background: `conic-gradient(${segments.join(",")})`,
          }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-background text-center shadow-inner">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
            <span className="text-xs font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {items.map((item, index) => {
          const percentage = (item.total / total) * 100
          return (
            <div key={item.categoryName} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                <span className="max-w-[170px] truncate">{item.categoryName}</span>
              </span>
              <span className="font-medium">
                {formatCurrency(item.total)} ({percentage.toFixed(1)}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AbcParetoChart({ rows }: { rows: AbcProductRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Sem dados para montar curva ABC.</p>
  }

  const width = 860
  const height = 260
  const paddingX = 42
  const paddingY = 24
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2
  const barGap = 8
  const barWidth = Math.max(12, (chartWidth - barGap * (rows.length - 1)) / rows.length)
  const maxValue = Math.max(...rows.map((row) => row.metricValue), 1)

  return (
    <div className="space-y-3">
      <div className="h-[260px] rounded-none border border-border bg-muted/10 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          {[0, 25, 50, 75, 100].map((level) => {
            const y = paddingY + ((100 - level) / 100) * chartHeight
            return (
              <line
                key={level}
                x1={paddingX}
                y1={y}
                x2={paddingX + chartWidth}
                y2={y}
                stroke="rgba(148,163,184,0.35)"
                strokeDasharray="3 3"
              />
            )
          })}

          {rows.map((row, index) => {
            const x = paddingX + index * (barWidth + barGap)
            const barHeight = (row.metricValue / maxValue) * chartHeight
            const y = paddingY + chartHeight - barHeight
            const fill =
              row.abcClass === "A" ? "#10b981" : row.abcClass === "B" ? "#f59e0b" : "#ef4444"
            return (
              <rect
                key={`${row.productId}-bar`}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                fill={fill}
                opacity="0.9"
                rx="2"
              />
            )
          })}

          <polyline
            fill="none"
            stroke="#7c3aed"
            strokeWidth="2.5"
            points={rows
              .map((row, index) => {
                const x = paddingX + index * (barWidth + barGap) + barWidth / 2
                const y = paddingY + ((100 - row.cumulativePercent) / 100) * chartHeight
                return `${x},${y}`
              })
              .join(" ")}
          />

          {rows.map((row, index) => {
            const x = paddingX + index * (barWidth + barGap) + barWidth / 2
            const y = paddingY + ((100 - row.cumulativePercent) / 100) * chartHeight
            return <circle key={`${row.productId}-dot`} cx={x} cy={y} r="2.8" fill="#7c3aed" />
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Classe A
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Classe B
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Classe C
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-violet-600" />% acumulado
        </span>
      </div>
    </div>
  )
}

function BrDateInput({
  value,
  onValueChange,
  className,
  ariaLabel,
}: {
  value: string
  onValueChange: (nextIsoDate: string) => void
  className?: string
  ariaLabel?: string
}) {
  const [displayValue, setDisplayValue] = useState(formatIsoToBrDate(value))

  useEffect(() => {
    setDisplayValue(formatIsoToBrDate(value))
  }, [value])

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      className={className}
      aria-label={ariaLabel}
      value={displayValue}
      onChange={(event) => {
        const nextDisplay = normalizeBrDateInput(event.target.value)
        setDisplayValue(nextDisplay)
        if (!nextDisplay) {
          onValueChange("")
          return
        }
        const parsed = parseBrDateToIso(nextDisplay)
        if (parsed) {
          onValueChange(parsed)
        }
      }}
      onBlur={() => {
        if (!displayValue) {
          onValueChange("")
          return
        }
        const parsed = parseBrDateToIso(displayValue)
        if (parsed) {
          setDisplayValue(formatIsoToBrDate(parsed))
          onValueChange(parsed)
          return
        }
        setDisplayValue(formatIsoToBrDate(value))
      }}
    />
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
        <div
          className={cn("h-3 rounded-none", barClassName)}
          style={{ width: `${(value / maxValue) * 100}%` }}
        />
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
