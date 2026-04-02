"use client"

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
  FileText,
  CircleDollarSign,
  Copy,
  Home,
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
  Wrench,
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
  ExpenseType,
  FinancialCategory,
  FinancialPeriod,
  FinancialTransaction,
  TransactionPeriodicity,
  TransactionFilters,
} from "@/lib/finance/types"
import { cn } from "@/lib/utils"

type ModuleKey = "home" | "finance" | "stock" | "mercadolivre" | "branchhunter"
type FinanceSection = "overview" | "abc" | "dre" | "expenses" | "categories" | "reports" | "history"
type StockSection = "overview" | "products" | "movements" | "history"
type MlSection = "listings" | "orders" | "metrics"
type MlSidebarGroup = "anuncios" | "pedidos" | "metricas"

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

type MlCatalogData = {
  itemId: string
  itemTitle: string
  catalogProductId: string | null
  sellers: Array<{
    sellerId: string
    sellerNickname: string
    listingsCount: number
  }>
  listings: Array<{
    id: string
    title: string
    price: number
    permalink?: string
    thumbnail?: string
    availableQuantity: number
    sellerId: string
    sellerNickname: string
  }>
  totalListings?: number
  message?: string
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
    return "border-blue-600/40 bg-blue-600/10 text-blue-700"
  }
  if (
    normalizedStatus === "shipped" ||
    normalizedStatus === "sent" ||
    normalizedStatus === "enviado" ||
    normalizedStatus === "ready_to_ship"
  ) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700"
  }
  if (normalizedStatus === "delivered" || normalizedStatus === "entregue") {
    return "border-emerald-600/40 bg-emerald-600/10 text-emerald-700"
  }
  if (normalizedStatus === "active") {
    return "border-emerald-600/40 bg-emerald-600/10 text-emerald-700"
  }
  if (normalizedStatus === "paused") {
    return "border-warning/40 bg-warning/10 text-warning"
  }
  return "border-destructive/40 bg-destructive/10 text-destructive"
}

function mlShippingStep(status: string) {
  const normalized = status.toLowerCase()
  if (["delivered", "ready_to_ship", "shipped"].includes(normalized)) return 3
  if (["handling", "to_be_agreed", "pending"].includes(normalized)) return 2
  if (["cancelled", "not_delivered"].includes(normalized)) return 0
  return 1
}

function valueToneClass(value: number) {
  if (value > 0) return "text-emerald-700"
  if (value < 0) return "text-destructive"
  return "text-foreground"
}

function valueBadgeClass(value: number) {
  if (value > 0) return "bg-emerald-100 text-emerald-700"
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
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
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
  let shippingBonus = 0
  let returnsAmount = 0
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
    revenueConfirmed += Math.max(0, order.totalAmount)
    marketplaceFees += Math.max(0, order.mlFeeAmount)
    shippingPaidBySeller += Math.max(0, order.shippingCostAmount)
    taxes += Math.max(0, order.taxesAmount)

    if (order.productAmount > 0) {
      productCosts += order.productAmount
      continue
    }

    const estimated = order.items.reduce((total, item) => {
      const byItem = item.id ? productByMlItemId.get(item.id) : undefined
      const bySku = item.sku ? productBySku.get(item.sku.toLowerCase()) : undefined
      const mapped = byItem ?? bySku
      return total + (mapped?.unitCost ?? 0) * Math.max(0, item.quantity)
    }, 0)
    productCosts += estimated
  }

  const netReceived = revenueConfirmed - marketplaceFees - shippingPaidBySeller + shippingBonus
  const grossProfit =
    netReceived - returnsAmount - productCosts - packagingCost - taxes

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

    const fallbackProductCost = order.items.reduce((sum, item) => {
      const mappedProduct = productByMlItemId.get(item.id)
      const unitCost = mappedProduct?.unitCost ?? 0
      return sum + unitCost * item.quantity
    }, 0)
    const productCost = order.productAmount > 0 ? order.productAmount : fallbackProductCost
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
      const estimatedFallbackProductCost = order.items.reduce((total, item) => {
        const mappedProduct = productByMlItemId.get(item.id)
        const unitCost = mappedProduct?.unitCost ?? 0
        return total + unitCost * item.quantity
      }, 0)

      const productCost = order.productAmount > 0 ? order.productAmount : estimatedFallbackProductCost
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
  }

  for (const order of filteredOrders) {
    const estimatedFallbackProductCost = order.items.reduce((sum, item) => {
      const mappedProduct = productByMlItemId.get(item.id)
      const unitCost = mappedProduct?.unitCost ?? 0
      return sum + unitCost * item.quantity
    }, 0)

    totals.products += Math.max(
      0,
      order.productAmount > 0 ? order.productAmount : estimatedFallbackProductCost,
    )
    totals.fees += Math.max(0, order.mlFeeAmount)
    totals.shipping += Math.max(0, order.shippingCostAmount)
    totals.taxes += Math.max(0, order.taxesAmount)
  }

  return [
    { categoryName: "Produtos", total: totals.products },
    { categoryName: "Taxas ML", total: totals.fees },
    { categoryName: "Envio", total: totals.shipping },
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
  const rowsBase = groupedRows
    .map((row) => {
      const metricValue =
        metric === "quantity" ? row.quantitySold : metric === "profit" ? row.profit : row.revenue
      return {
        ...row,
        metricValue: Math.max(0, metricValue),
      }
    })
    .sort((a, b) => b.metricValue - a.metricValue)

  const totalMetric = rowsBase.reduce((total, row) => total + row.metricValue, 0)
  let cumulative = 0
  return rowsBase.map((row) => {
    const sharePercent = totalMetric > 0 ? (row.metricValue / totalMetric) * 100 : 0
    cumulative += sharePercent
    const abcClass = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C"
    const marginPercent = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0
    return {
      ...row,
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
    for (const item of order.items) {
      const quantity = Math.max(0, item.quantity)
      if (quantity <= 0) continue

      const mappedByItem = item.id ? productByMlItemId.get(item.id) : undefined
      const mappedBySku = item.sku ? productBySku.get(item.sku.toLowerCase()) : undefined
      const mappedProduct = mappedByItem ?? mappedBySku

      const unitCost = mappedProduct?.unitCost ?? 0
      const revenue = Math.max(0, item.unitPrice) * quantity
      const totalCost = unitCost * quantity
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

function StockLevelLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-none border bg-muted/30 px-3 py-2 text-xs">
      <span className="font-medium text-muted-foreground">Volume em estoque:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-red-600 ring-2 ring-background shadow-sm" />
        0
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-amber-400 ring-2 ring-background shadow-sm" />
        1 a 10
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
  const [mlListings, setMlListings] = useState<MlListing[]>([])
  const [mlListingsLoading, setMlListingsLoading] = useState(false)
  const [editingMlListingId, setEditingMlListingId] = useState<string | null>(null)
  const [mlListingEditForm, setMlListingEditForm] = useState({
    title: "",
    price: "",
    availableQuantity: "",
    status: "active" as "active" | "paused" | "closed",
  })
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
  const [mlCatalogLoadingId, setMlCatalogLoadingId] = useState<string | null>(null)
  const [mlCatalogData, setMlCatalogData] = useState<MlCatalogData | null>(null)
  const [mlOrderCostAnalysis, setMlOrderCostAnalysis] = useState<OrderCostAnalysis | null>(null)
  const [financeOrdersTitleFilter, setFinanceOrdersTitleFilter] = useState("")
  const [financeOrdersSkuFilter, setFinanceOrdersSkuFilter] = useState("")
  const [financeOrdersStatusFilter, setFinanceOrdersStatusFilter] = useState("all")
  const [financeOverviewTab, setFinanceOverviewTab] = useState<"sales" | "ranking">("sales")
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
  const [dreMonth, setDreMonth] = useState(new Date().getMonth() + 1)
  const [dreYear, setDreYear] = useState(new Date().getFullYear())
  const [dreIncludeMovements, setDreIncludeMovements] = useState(true)
  const [dreComparePrevious, setDreComparePrevious] = useState(false)

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
  const syncStockFromMercadoLivre = useMutation(api.stock.syncFromMercadoLivre)

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
        setMlError(error instanceof Error ? error.message : "Erro ao consultar conta Mercado Livre.")
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
      .filter((transaction) => transaction.kind === "expense" && transaction.expenseType === "fixed")
      .reduce((total, transaction) => total + transaction.amount, 0)
    const operationalCost = historyTransactions
      .filter((transaction) => transaction.kind === "expense" && transaction.expenseType !== "fixed")
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
  const maxBarValue = Math.max(summary.income, summary.expense, 1)
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
  const operatingMargin = salesInFilter > 0 ? (operatingResult / salesInFilter) * 100 : 0
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
  const salesInFilterFinal = hasOrdersFinancialData ? ordersFinancialSummary.grossRevenue : salesInFilter
  const expensesInFilterFinal = hasOrdersFinancialData ? ordersFinancialSummary.totalCosts : expensesInFilter
  const operatingResultFinal = hasOrdersFinancialData ? ordersFinancialSummary.netProfit : operatingResult
  const soldItemsFinal = hasOrdersFinancialData ? ordersFinancialSummary.soldItems : soldUnitsInFilter
  const salesCountFinal = hasOrdersFinancialData ? ordersFinancialSummary.ordersCount : salesCountInFilter
  const operatingMarginFinal =
    salesInFilterFinal > 0 ? (operatingResultFinal / salesInFilterFinal) * 100 : 0
  const ticketMedioFinal = salesCountFinal > 0 ? salesInFilterFinal / salesCountFinal : 0
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
          const skuMatch = order.items.some((item) => item.sku.toLowerCase().includes(normalizedSku))
          if (!skuMatch) return false
        }
        return true
      })
      .map((order) => {
        const productCost = Math.max(0, order.productAmount)
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
  ])

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
    [
      dreIncludeMovements,
      dreRange,
      mlOrders,
      productMapByMlItemId,
      productMapBySku,
      transactions,
    ],
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
      { label: "Receita Confirmada", value: dreSnapshot.revenueConfirmed, strong: true, color: "text-emerald-700" },
      { label: "(-) Taxas de Marketplace", value: -dreSnapshot.marketplaceFees },
      { label: "(-) Frete Pago pelo Vendedor", value: -dreSnapshot.shippingPaidBySeller },
      { label: "(+) Bonus de Frete", value: dreSnapshot.shippingBonus, color: "text-emerald-700" },
      { label: "= Valor Liquido Recebido", value: dreSnapshot.netReceived, strong: true, color: "text-emerald-700" },
      { label: "(-) Devolucoes", value: -dreSnapshot.returnsAmount },
      { label: "(-) Custo dos Produtos (SKU)", value: -dreSnapshot.productCosts },
      { label: "(-) Custo de Embalagem", value: -dreSnapshot.packagingCost },
      { label: "(-) Impostos", value: -dreSnapshot.taxes },
      { label: "= Lucro Bruto", value: dreSnapshot.grossProfit, strong: true, color: valueToneClass(dreSnapshot.grossProfit) },
      { label: "(-) Despesas Operacionais", value: -dreSnapshot.operationalExpenses },
      { label: "(-) Custos Fixos", value: -dreSnapshot.fixedCosts },
      { label: "= LUCRO LIQUIDO", value: dreSnapshot.netProfit, strong: true, color: valueToneClass(dreSnapshot.netProfit) },
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

      const matchesDate =
        !mlOrdersPeriodDate || order.dateCreated.startsWith(mlOrdersPeriodDate)

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

    setLaunchSaving(true)
    setLaunchFeedback(null)
    try {
      await addTransaction({
        userId,
        kind: launchForm.kind,
        amount: Number(launchForm.amount),
        date: launchForm.date,
        description: launchForm.description,
        categoryId: launchForm.categoryId,
        origin: launchForm.kind === "income" ? launchForm.origin || undefined : undefined,
        expenseType: launchForm.kind === "expense" ? launchForm.expenseType : undefined,
        periodicity: launchForm.periodicity,
      })
      setLaunchForm((previous) => ({
        ...previous,
        amount: "",
        description: "",
        origin: "",
        expenseType: "variable",
        periodicity: "one_time",
      }))
      setLaunchFeedback({
        type: "success",
        message: "Lancamento salvo com sucesso no financeiro.",
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
        transactionEditForm.kind === "income"
          ? transactionEditForm.origin || undefined
          : undefined,
      expenseType:
        transactionEditForm.kind === "expense"
          ? transactionEditForm.expenseType
          : undefined,
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
    setMlListingsLoading(true)
    try {
      const response = await fetch("/api/ml/listings?limit=20&offset=0", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar anuncios.")
      }
      setMlListingsCount(payload.data.total ?? 0)
      setMlListings((payload.data.listings ?? []) as MlListing[])
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar anuncios.")
    } finally {
      setMlListingsLoading(false)
    }
  }

  const startEditMlListing = (listing: MlListing) => {
    setEditingMlListingId(listing.id)
    setMlListingEditForm({
      title: listing.title,
      price: String(listing.price),
      availableQuantity: String(listing.available_quantity),
      status:
        listing.status === "active" || listing.status === "paused" || listing.status === "closed"
          ? listing.status
          : "active",
    })
  }

  const cancelEditMlListing = () => {
    setEditingMlListingId(null)
    setMlListingEditForm({ title: "", price: "", availableQuantity: "", status: "active" })
  }

  const saveMlListing = async (listingId: string) => {
    const parsedPrice = Number(mlListingEditForm.price)
    const parsedAvailable = Number(mlListingEditForm.availableQuantity)

    if (
      !mlListingEditForm.title.trim() ||
      Number.isNaN(parsedPrice) ||
      Number.isNaN(parsedAvailable) ||
      parsedPrice < 0 ||
      parsedAvailable < 0
    ) {
      setMlError("Preencha titulo, preco e estoque com valores validos.")
      return
    }

    setMlError(null)
    setMlInfo(null)

    try {
      const response = await fetch(`/api/ml/listings/${listingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: mlListingEditForm.title,
          price: parsedPrice,
          availableQuantity: Math.floor(parsedAvailable),
          status: mlListingEditForm.status,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao atualizar anuncio.")
      }
      setMlInfo("Anuncio atualizado com sucesso.")
      cancelEditMlListing()
      await loadMlListings()
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao atualizar anuncio.")
    }
  }

  const updateMlListingStatus = async (
    listingId: string,
    status: "active" | "paused" | "closed",
  ) => {
    setMlError(null)
    setMlInfo(null)
    try {
      const response = await fetch(`/api/ml/listings/${listingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao atualizar status do anuncio.")
      }
      setMlInfo(`Status atualizado para "${status}" com sucesso.`)
      await loadMlListings()
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao atualizar status do anuncio.")
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
      setMlError(error instanceof Error ? error.message : "Erro ao carregar resumo do Mercado Livre.")
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
      setMlListings(listings)
      setMlInfo(
        `Sincronizacao concluida: ${syncResult.updated} atualizados, ${syncResult.created} criados, ${syncResult.removedManual} manuais removidos.`,
      )
      setMlLastSyncAt(Date.now())
      setMlLastSyncDurationMs(Date.now() - startedAt)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao sincronizar estoque com Mercado Livre.")
    } finally {
      setMlSyncingStock(false)
    }
  }

  const refreshMlSync = async () => {
    if (!mlConnectionStatus?.connected || mlSyncingStock) return
    await Promise.all([syncStockWithMl(), loadMlOverviewCards()])
  }

  const loadMlCatalog = async (listingId: string) => {
    setMlError(null)
    setMlCatalogLoadingId(listingId)
    try {
      const response = await fetch(`/api/ml/catalog/${listingId}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao consultar catalogo.")
      }
      setMlCatalogData(payload.data as MlCatalogData)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao consultar catalogo do anuncio.")
    } finally {
      setMlCatalogLoadingId(null)
    }
  }

  const openOrderCostAnalysis = (order: MlOrder, unitCost: number, quantity: number) => {
    const revenueTotal = order.totalAmount
    const receivedAmount = order.totalPaidAmount
    const productCostFromApi = Math.max(0, order.productAmount)
    const productCost = productCostFromApi > 0 ? productCostFromApi : Math.max(0, unitCost * quantity)
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
      source: productCostFromApi > 0 ? "ml_api" : "fallback",
    })
  }

  useEffect(() => {
    if (activeModule !== "mercadolivre" || !mlConnectionStatus?.connected) return

    if (activeMlSection === "listings" && mlListings.length === 0 && !mlListingsLoading) {
      void loadMlListings()
      return
    }
    if (activeMlSection === "orders" && mlOrders.length === 0 && !mlOrdersLoading) {
      void loadMlOrders()
      return
    }
    if (activeMlSection === "metrics" && !mlMetrics && !mlMetricsLoading) {
      void loadMlMetrics()
    }
  }, [
    activeMlSection,
    activeModule,
    mlConnectionStatus?.connected,
    mlListings.length,
    mlListingsLoading,
    mlMetrics,
    mlMetricsLoading,
    mlOrders.length,
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
          <UserButton />
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">Modulos</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={activeModule === "home" ? "default" : "outline"} size="sm" onClick={() => setActiveModule("home")}>
            <Home className="size-4" />
            Home
          </Button>
          <Button variant={activeModule === "finance" ? "default" : "outline"} size="sm" onClick={() => setActiveModule("finance")}>
            <Wallet className="size-4" />
            Financeiro
          </Button>
          <Button variant={activeModule === "stock" ? "default" : "outline"} size="sm" onClick={() => setActiveModule("stock")}>
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
                : "border-emerald-600 text-emerald-700 hover:bg-emerald-50",
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
            <SidebarButton icon={LayoutDashboard} label="Visao geral" isActive={activeFinanceSection === "overview"} onClick={() => setActiveFinanceSection("overview")} />
            <SidebarButton icon={PieChart} label="Analise ABC" isActive={activeFinanceSection === "abc"} onClick={() => setActiveFinanceSection("abc")} />
            <SidebarButton icon={FileText} label="Analise DRE" isActive={activeFinanceSection === "dre"} onClick={() => setActiveFinanceSection("dre")} />
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
              <SummaryCard title="Vendas (filtro)" value={salesInFilterFinal} />
              <SummaryCard title="Despesas (filtro)" value={expensesInFilterFinal} negative />
              <SummaryCard
                title="Resultado operacional"
                value={operatingResultFinal}
                positive={operatingResultFinal >= 0}
                negative={operatingResultFinal < 0}
              />
              <SummaryCard title="Valor em estoque" value={stockSummary.stockValue} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Margem operacional"
                value={operatingMarginFinal}
                format="percent"
                positive={operatingMarginFinal >= 0}
                negative={operatingMarginFinal < 0}
              />
              <SummaryCard title="Custo operacional" value={costBreakdown.operationalCost} negative />
              <SummaryCard title="Custos fixos" value={costBreakdown.fixedCost} negative />
              <SummaryCard title="Ferramentas fixas" value={costBreakdown.toolsFixedCost} negative />
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
            <Card>
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Trophy className="size-4 text-amber-500" />
                  Produtos campeoes (lucro)
                </CardTitle>
                <CardDescription>Ranking por lucro estimado com base nas vendas registradas no periodo.</CardDescription>
              </CardHeader>
              <CardContent>
                {productChampions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ainda nao ha vendas suficientes para classificar produtos campeoes.
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
                          <TableCell className="max-w-[260px] truncate font-medium">{item.productName}</TableCell>
                          <TableCell className="text-right">{item.unitsSold}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.profit)}</TableCell>
                          <TableCell className="text-right">{item.marginPercent.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {activeModule === "finance" && (
          <>
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
                <Card className="border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="inline-flex items-center gap-2 text-xl">
                      <Wallet className="size-5 text-orange-500" />
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
                      <Input
                        placeholder="Filtrar por titulo"
                        value={financeOrdersTitleFilter}
                        onChange={(event) => setFinanceOrdersTitleFilter(event.target.value)}
                      />
                      <Input
                        placeholder="Filtrar por SKU"
                        value={financeOrdersSkuFilter}
                        onChange={(event) => setFinanceOrdersSkuFilter(event.target.value)}
                      />
                      <Select
                        value={financeOrdersStatusFilter}
                        onValueChange={setFinanceOrdersStatusFilter}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os status" />
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
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as contas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all-accounts">Todas as contas</SelectItem>
                          <SelectItem value={financeAccountLabel}>{financeAccountLabel}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Sem comparar</Badge>
                      <Badge variant="outline">vs Mes anterior</Badge>
                      <Badge variant="outline">vs Ano anterior</Badge>
                      <Badge variant="outline">Sem projecao</Badge>
                      <Badge variant="outline">Projecao do mes</Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <Card className="border-emerald-200/70 bg-emerald-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-emerald-700">
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
                      <Card className="border-blue-200/70 bg-blue-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-blue-700">
                            <ShoppingBag className="size-3.5" />
                            Vendas Brutas
                          </CardDescription>
                          <CardTitle className="text-blue-700">{formatCurrency(salesInFilterFinal)}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {soldItemsFinal} itens vendidos
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-emerald-700">
                            <CircleDollarSign className="size-3.5" />
                            Receita
                          </CardDescription>
                          <CardTitle className="text-emerald-700">
                            {formatCurrency(salesInFilterFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {salesCountFinal} vendas confirmadas
                        </CardContent>
                      </Card>
                      <Card className="border-orange-200/70 bg-orange-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-orange-700">
                            <TrendingDown className="size-3.5" />
                            Custos Totais
                          </CardDescription>
                          <CardTitle className="text-orange-700">
                            {formatCurrency(expensesInFilterFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Soma de todos os custos
                        </CardContent>
                      </Card>
                      <Card className="border-violet-200/70 bg-violet-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-violet-700">
                            <CreditCard className="size-3.5" />
                            Ticket Medio
                          </CardDescription>
                          <CardTitle className="text-violet-700">{formatCurrency(ticketMedioFinal)}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">Valor medio por venda</CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <Card className="xl:col-span-2">
                        <CardHeader className="flex flex-row items-start justify-between">
                          <div>
                            <CardDescription className="uppercase tracking-wide">Evolucao</CardDescription>
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
                          <CardDescription className="uppercase tracking-wide">Custos</CardDescription>
                          <CardTitle>Composicao de Custos</CardTitle>
                          <CardDescription>Distribuicao dos custos</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <CostCompositionChart items={costComposition} total={costCompositionTotal} />
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
                                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                                    Sem vendas no filtro selecionado.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                financeDetailedOrders.slice(0, 10).map((order) => (
                                  <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.title}</TableCell>
                                    <TableCell className="uppercase">{financeAccountLabel}</TableCell>
                                    <TableCell>{new Date(order.orderDate).toLocaleString("pt-BR")}</TableCell>
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
                                    <TableCell className="text-right font-medium">{item.unitsSold}</TableCell>
                                    <TableCell className="text-right font-medium text-blue-700">
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
                      <PieChart className="size-5 text-orange-500" />
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
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
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
                        <CardContent className="text-xs text-muted-foreground">Itens analisados</CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Classe A</CardDescription>
                          <CardTitle className="text-emerald-700">
                            {abcSummary.A.count} ({abcSummary.A.share.toFixed(1)}%)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">Maior impacto</CardContent>
                      </Card>
                      <Card className="border-amber-200/70 bg-amber-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Classe B</CardDescription>
                          <CardTitle className="text-amber-700">
                            {abcSummary.B.count} ({abcSummary.B.share.toFixed(1)}%)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">Impacto moderado</CardContent>
                      </Card>
                      <Card className="border-rose-200/70 bg-rose-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Classe C</CardDescription>
                          <CardTitle className="text-rose-700">
                            {abcSummary.C.count} ({abcSummary.C.share.toFixed(1)}%)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">Baixo impacto</CardContent>
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
                                <TableCell colSpan={8} className="text-center text-muted-foreground">
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
                                      <span className="text-xs text-muted-foreground">{row.sku || "-"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{row.quantitySold}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(row.totalCost)}</TableCell>
                                  <TableCell
                                    className={cn("text-right font-semibold", valueToneClass(row.profit))}
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
                                          "border-emerald-600/30 bg-emerald-100 text-emerald-700",
                                        row.abcClass === "B" &&
                                          "border-amber-600/30 bg-amber-100 text-amber-700",
                                        row.abcClass === "C" &&
                                          "border-rose-600/30 bg-rose-100 text-rose-700",
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
                            <SelectItem value={financeAccountLabel}>{financeAccountLabel}</SelectItem>
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
                      <Card className="border-blue-200/70 bg-blue-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Vendas Brutas</CardDescription>
                          <CardTitle className="text-blue-700">
                            {formatCurrency(dreSnapshot.revenueConfirmed)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {dreSnapshot.ordersCount} pedidos
                        </CardContent>
                      </Card>
                      <Card className="border-emerald-200/70 bg-emerald-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Vendas Confirmadas</CardDescription>
                          <CardTitle className="text-emerald-700">
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
                      <Card className="border-emerald-200/70 bg-emerald-50/40">
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
                      <Card className="border-emerald-200/70 bg-emerald-50/40">
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
                                <TableCell className={cn(row.strong && "font-semibold")}>{row.label}</TableCell>
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
                      Periodo: {String(dreMonth).padStart(2, "0")}/{dreYear} • {dreSnapshot.ordersCount}{" "}
                      pedidos.
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
                    Lance despesas da empresa ou entradas de capital com tipo e periodicidade.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {launchFeedback && (
                    <div
                      className={cn(
                        "md:col-span-2 flex items-center gap-2 rounded-none border px-3 py-2 text-sm",
                        launchFeedback.type === "success"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
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
                      onChange={(event) => setLaunchForm((prev) => ({ ...prev, amount: event.target.value }))}
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
                      onChange={(event) => setLaunchForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <FolderTree className="size-3.5" />
                      Categoria
                    </p>
                    <Select value={launchForm.categoryId || undefined} onValueChange={(value) => setLaunchForm((prev) => ({ ...prev, categoryId: value as Id<"categories"> }))}>
                      <SelectTrigger className="w-full border-primary/20 bg-background"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>
                        {(launchForm.kind === "income" ? incomeCategories : expenseCategories).map((category) => (
                          <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {launchForm.kind === "expense" ? (
                    <div className="space-y-1">
                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CreditCard className="size-3.5" />
                        Tipo da despesa
                      </p>
                      <Select value={launchForm.expenseType} onValueChange={(value) => setLaunchForm((prev) => ({ ...prev, expenseType: value as ExpenseType }))}>
                        <SelectTrigger className="w-full border-primary/20 bg-background"><SelectValue placeholder="Tipo da despesa" /></SelectTrigger>
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
                        onChange={(event) => setLaunchForm((prev) => ({ ...prev, origin: event.target.value }))}
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
                  <Button className="md:col-span-2 gap-2 bg-primary hover:bg-primary/90" onClick={saveLaunch} disabled={launchSaving}>
                    {launchSaving ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
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
              <section className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
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
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Entrada prevista</Badge>
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive">Custo previsto</Badge>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">Lucro previsto</Badge>
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
                    <div className="flex gap-2">
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
                      <Select value={historyKindFilter} onValueChange={(value) => setHistoryKindFilter(value as "all" | "income" | "expense")}>
                        <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
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
                        <SelectTrigger><SelectValue placeholder="Tipo de despesa" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="fixed">Custo fixo</SelectItem>
                          <SelectItem value="variable">Custo operacional</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={historyPeriodicityFilter}
                        onValueChange={(value) =>
                          setHistoryPeriodicityFilter(
                            value as "all" | TransactionPeriodicity,
                          )
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Periodicidade" /></SelectTrigger>
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
                        <BrDateInput
                          value={historyStartDate}
                          onValueChange={setHistoryStartDate}
                        />
                        <BrDateInput
                          value={historyEndDate}
                          onValueChange={setHistoryEndDate}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="border-emerald-200/70 bg-emerald-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Entradas</CardDescription>
                          <CardTitle className="text-emerald-700">{formatCurrency(historySummary.entries)}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Total de receitas
                        </CardContent>
                      </Card>
                      <Card className="border-amber-200/70 bg-amber-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Custo Fixo</CardDescription>
                          <CardTitle className="text-amber-700">{formatCurrency(historySummary.fixedCost)}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Custos fixos mensais
                        </CardContent>
                      </Card>
                      <Card className="border-orange-200/70 bg-orange-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Custo Operacional</CardDescription>
                          <CardTitle className="text-orange-700">
                            {formatCurrency(historySummary.operationalCost)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Custos operacionais
                        </CardContent>
                      </Card>
                      <Card className="border-blue-200/70 bg-blue-50/40">
                        <CardHeader className="pb-2">
                          <CardDescription>Recorrentes</CardDescription>
                          <CardTitle className="text-blue-700">{historySummary.recurring}</CardTitle>
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
                          Ajuste os filtros ou registre uma nova movimentacao para visualizar o historico.
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Data</TableHead><TableHead>Descricao</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead>Origem</TableHead><TableHead>Periodicidade</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Acoes</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDate(transaction.date)}</TableCell>
                              <TableCell className="max-w-[240px] truncate">{transaction.description}</TableCell>
                              <TableCell>{categoryMap.get(transaction.categoryId)?.name ?? "Sem categoria"}</TableCell>
                              <TableCell>
                                <Badge variant={transaction.kind === "income" ? "default" : "secondary"}>
                                  {transaction.kind === "income" ? "Entrada" : "Despesa"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {transaction.origin || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{periodicityLabel(transaction.periodicity)}</Badge>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right font-semibold",
                                  transaction.kind === "income" ? "text-emerald-700" : "text-destructive",
                                )}
                              >
                                {transaction.kind === "income" ? "+" : "-"}
                                {formatCurrency(transaction.amount)}
                              </TableCell>
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
                    )}
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}

        {activeModule === "stock" && (
          <>
            <StockLevelLegend />
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
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 overflow-hidden rounded border bg-muted">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : null}
                                </div>
                                <span>{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>
                              <StockQuantityIndicator quantity={product.quantity} />
                            </TableCell>
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
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-9 w-9 overflow-hidden rounded border bg-muted">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : null}
                                </div>
                                <div className="space-y-0.5">
                                  <p>{product.name}</p>
                                  {product.mlItemId && (
                                    <p className="text-xs text-muted-foreground">ML: {product.mlItemId}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell>
                              <StockQuantityIndicator quantity={product.quantity} />
                            </TableCell>
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
                  <CardHeader>
                    <CardTitle>Cadastro manual desativado</CardTitle>
                    <CardDescription>
                      Por enquanto o estoque sera mantido apenas pelas sincronizacoes do Mercado Livre.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActiveModule("mercadolivre")
                      }}
                    >
                      Ir para aba Mercado Livre
                    </Button>
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
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 overflow-hidden rounded border bg-muted">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : null}
                                </div>
                                <span>{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell>
                              <StockQuantityIndicator quantity={product.quantity} />
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
                    <BrDateInput
                      value={movementForm.date}
                      onValueChange={(value) => setMovementForm((prev) => ({ ...prev, date: value }))}
                    />
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
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Store className="size-5" />
                  Mercado Livre
                </CardTitle>
                <CardDescription>Conecte sua conta e consulte anuncios, pedidos e metricas.</CardDescription>
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
                      <Store className="size-4" />
                      Conectar Mercado Livre
                    </Button>
                  </div>
                )}
                {mlError && <p className="text-sm text-destructive">{mlError}</p>}
                {mlInfo && <p className="text-sm text-emerald-700">{mlInfo}</p>}
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
                          <Badge variant="outline" className="border-emerald-600/50 text-emerald-700">
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
                        Itens com catalogo do Mercado Livre vinculados a sua conta.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {mlListingsLoading ? (
                        <p className="text-sm text-muted-foreground">Carregando anuncios...</p>
                      ) : mlListings.filter((listing) => listing.catalogProductId).length === 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Nenhum item de catalogo encontrado nos anuncios carregados.
                          </p>
                          <Button variant="outline" onClick={() => void loadMlListings()}>
                            Carregar anuncios
                          </Button>
                        </div>
                      ) : (
                        <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Titulo</TableHead>
                            <TableHead className="w-[140px] text-right">Preco</TableHead>
                            <TableHead className="w-[130px] text-right">Estoque</TableHead>
                            <TableHead className="w-[130px]">Status</TableHead>
                            <TableHead className="w-[220px] text-right">Acoes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mlListings.filter((listing) => listing.catalogProductId).map((listing) => (
                            <TableRow key={listing.id}>
                              <TableCell>
                                {editingMlListingId === listing.id ? (
                                  <Input
                                    value={mlListingEditForm.title}
                                    onChange={(event) =>
                                      setMlListingEditForm((prev) => ({
                                        ...prev,
                                        title: event.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <div className="flex items-start gap-3">
                                    <div className="h-14 w-14 overflow-hidden rounded border bg-muted">
                                      {listing.thumbnail ? (
                                        <img
                                          src={listing.thumbnail}
                                          alt={listing.title}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                          Sem imagem
                                        </div>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="font-medium">{listing.title}</p>
                                      {listing.permalink && (
                                        <a
                                          href={listing.permalink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs text-primary underline-offset-2 hover:underline"
                                        >
                                          Ver anuncio no Mercado Livre
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {editingMlListingId === listing.id ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={mlListingEditForm.price}
                                    onChange={(event) =>
                                      setMlListingEditForm((prev) => ({
                                        ...prev,
                                        price: event.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  formatCurrency(listing.price)
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {editingMlListingId === listing.id ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={mlListingEditForm.availableQuantity}
                                    onChange={(event) =>
                                      setMlListingEditForm((prev) => ({
                                        ...prev,
                                        availableQuantity: event.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  listing.available_quantity
                                )}
                              </TableCell>
                              <TableCell>
                                {editingMlListingId === listing.id ? (
                                  <Select
                                    value={mlListingEditForm.status}
                                    onValueChange={(value) =>
                                      setMlListingEditForm((prev) => ({
                                        ...prev,
                                        status: value as "active" | "paused" | "closed",
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">active</SelectItem>
                                      <SelectItem value="paused">paused</SelectItem>
                                      <SelectItem value="closed">closed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="outline" className={mlStatusBadgeClass(listing.status)}>
                                    {listing.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {editingMlListingId === listing.id ? (
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" onClick={() => void saveMlListing(listing.id)}>
                                      Salvar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={cancelEditMlListing}>
                                      Cancelar
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => startEditMlListing(listing)}>
                                      Editar
                                    </Button>
                                    {listing.status === "active" ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void updateMlListingStatus(listing.id, "paused")}
                                      >
                                        Pausar
                                      </Button>
                                    ) : listing.status === "paused" ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void updateMlListingStatus(listing.id, "active")}
                                      >
                                        Ativar
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => void loadMlCatalog(listing.id)}
                                      disabled={mlCatalogLoadingId === listing.id}
                                    >
                                      {mlCatalogLoadingId === listing.id
                                        ? "Buscando..."
                                        : "Catalogo/vendedores"}
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        </Table>
                      )}

                      {mlCatalogData && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle className="text-base">Catalogo e vendedores</CardTitle>
                            <CardDescription>
                              {mlCatalogData.itemTitle}{" "}
                              {mlCatalogData.catalogProductId
                                ? `- Catalogo: ${mlCatalogData.catalogProductId}`
                                : "- Sem catalogo vinculado"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {mlCatalogData.message && (
                              <p className="text-sm text-muted-foreground">{mlCatalogData.message}</p>
                            )}
                            {mlCatalogData.sellers.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Vendedores ({mlCatalogData.sellers.length})</p>
                                <div className="grid gap-1 text-sm">
                                  {mlCatalogData.sellers.map((seller) => (
                                    <p key={seller.sellerId} className="text-muted-foreground">
                                      {seller.sellerNickname} ({seller.listingsCount} anuncio{seller.listingsCount > 1 ? "s" : ""})
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
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
                        <CardDescription>Monitore pedidos com filtros e detalhes operacionais.</CardDescription>
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
                        <Select value={mlOrdersStatusFilter} onValueChange={setMlOrdersStatusFilter}>
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
                        <Select value={mlOrdersShippingFilter} onValueChange={setMlOrdersShippingFilter}>
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
                        const stockProduct = firstItem?.id ? productMapByMlItemId.get(firstItem.id) : undefined
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
                                  <input type="checkbox" aria-label={`Selecionar pedido ${order.id}`} />
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
                                      profit >= 0 ? "text-emerald-700" : "text-destructive",
                                    )}
                                  >
                                    <TrendingUp className="size-3.5" />
                                    {profit >= 0 ? "+" : "-"}
                                    {formatCurrency(Math.abs(profit))}
                                  </p>
                                  <p className="inline-flex items-center gap-1 text-amber-700">
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
                                  <Badge variant="outline" className={mlStatusBadgeClass(order.status)}>
                                    {mlOrderStatusLabel(order.status)}
                                  </Badge>
                                </div>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                                <div className="space-y-1 text-xs">
                                  <p>
                                    <CreditCard className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Comprador:</span> {order.buyerNickname}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    <Wallet className="mr-1 inline size-3.5" />
                                    <span className="text-muted-foreground">Pagamento:</span> {order.paymentMethod}
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
                                    {order.dateClosed ? new Date(order.dateClosed).toLocaleDateString("pt-BR") : "-"}
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
                      <CardDescription>Resumo de desempenho baseado na amostra atual.</CardDescription>
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
                                <CardTitle className="text-lg">{mlMetrics.completedOrdersSample}</CardTitle>
                              </CardHeader>
                            </Card>
                            <Card className="rounded-none border-dashed">
                              <CardHeader className="pb-2">
                                <CardDescription>Pedidos cancelados</CardDescription>
                                <CardTitle className="text-lg">{mlMetrics.cancelledOrdersSample}</CardTitle>
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
                              <p className="text-2xl font-semibold text-emerald-700">
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
                              <p className="text-2xl font-semibold text-orange-600">
                                {formatCurrency(mlOrderCostAnalysis.productCost)}
                              </p>
                            </div>
                            <div className="rounded-none border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground">Lucro liquido</p>
                              <p
                                className={cn(
                                  "text-2xl font-semibold",
                                  mlOrderCostAnalysis.netProfit >= 0
                                    ? "text-emerald-700"
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
                                    <p>
                                      {row.label}
                                    </p>
                                    <p
                                      className={cn(
                                        "font-medium",
                                        row.positive ? "text-emerald-700" : "text-foreground",
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
                              <p className="text-sm font-medium text-emerald-700">Margem de contribuicao</p>
                              <p className="text-3xl font-semibold text-emerald-700">
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

function FinancialEvolutionChart({ data }: { data: SalesEvolutionPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados suficientes para montar o grafico.</p>
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
  const yForMoney = (value: number) => paddingTop + (1 - Math.max(0, value) / moneyMax) * chartHeight
  const yForOrders = (value: number) =>
    paddingTop + (1 - Math.max(0, value) / Math.max(1, ordersMax)) * chartHeight

  const toPolyline = (values: number[], yFn: (v: number) => number) =>
    values
      .map((value, index) => `${xForIndex(index)},${yFn(value)}`)
      .join(" ")

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
                  fill="rgb(100 116 139)"
                >
                  {formatCurrency(moneyValue)}
                </text>
                <text
                  x={paddingLeft + chartWidth + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="10"
                  fill="rgb(100 116 139)"
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
              fill="rgb(100 116 139)"
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
    return <p className="text-sm text-muted-foreground">Sem custos suficientes para compor grafico.</p>
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
  let accumulated = 0
  const segments = items.map((item, index) => {
    const start = (accumulated / total) * 360
    accumulated += item.total
    const end = (accumulated / total) * 360
    return `${palette[index % palette.length]} ${start}deg ${end}deg`
  })

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
          <span className="h-2 w-2 rounded-full bg-violet-600" />
          % acumulado
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
  format?: "currency" | "number" | "percent"
}) {
  const formattedValue =
    format === "currency"
      ? formatCurrency(value)
      : format === "percent"
        ? `${value.toFixed(1)}%`
        : Math.trunc(value)

  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn(positive && "text-primary", negative && "text-destructive")}>
          {formattedValue}
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
