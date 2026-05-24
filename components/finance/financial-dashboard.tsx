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
  Activity,
  Database,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  CircleDollarSign,
  Copy,
  Home,
  ArrowRight,
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
  Settings,
  ShieldCheck,
  Trophy,
  TrendingDown,
  Wallet,
  Wifi as WifiIcon,
  Wrench,
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
  calculateProductChampions,
  filterTransactions,
  formatCurrency,
  formatDate,
  monthlyEvolution,
  summarizeTransactions,
} from "@/lib/finance/calculations"
import type { DayGroup } from "@/lib/mercadopago/future-releases"
import type {
  AnexoLancamento,
  ExpenseType,
  FinancialBill,
  FinancialCategory,
  FinancialPeriod,
  FinancialTransaction,
  PaymentMethod,
  TransactionPeriodicity,
  TransactionFilters,
} from "@/lib/finance/types"
import { exportTransactionsToCsv } from "@/lib/finance/export-csv"
import { exportStockMovementHistoryToCsv } from "@/lib/stock/export-stock-history-csv"
import {
  AnexosCountBadge,
  AnexosLancamentoModal,
  LancamentoFormAnexos,
} from "@/components/finance/anexos-lancamento-modal"
import { cn } from "@/lib/utils"
import { AnalysisModal } from "@/features/product-analysis/components/AnalysisModal"
import { HunterAnalysisPage } from "@/features/product-analysis/components/HunterAnalysisPage"
import { KanbanBoard } from "@/components/estoque/KanbanBoard"
import { ProductNameInputWithSuggestions } from "@/components/estoque/ProductNameInputWithSuggestions"
import type { ProductKanbanEventRow } from "@/components/estoque/ProductDetailModal"
import { StockFeedbackAlert } from "@/components/estoque/stock-feedback-alert"
import type { KanbanColumnId, KanbanProduct, KanbanStatus } from "@/components/estoque/types"
import type { ProductSuggestionCandidate } from "@/lib/stock/product-name-suggestions"
import { normalizeMercadoLibreItemId } from "@/lib/mercadolivre/item-id"
import { suggestUnitCostFromInventory, type ProductCostLookup } from "@/lib/stock/suggest-unit-cost"

type ModuleKey = "home" | "finance" | "stock" | "mercadolivre" | "branchhunter" | "connections"
type FinanceSection =
  | "overview"
  | "abc"
  | "dre"
  | "expenses"
  | "categories"
  | "reports"
  | "history"
  | "cashflow"
type FinanceSourceFilter = "all" | "mercado_livre" | "mercado_pago" | "manual"
type FinanceTypeFilter = "all" | "income" | "expense"
type FinanceInsightKey = "profit" | "revenue" | "costs" | "sales" | "margin" | "ticket"
type HistorySummaryFilter = "entries" | "fixed" | "operational" | "recurring"
type StockSection = "overview" | "history"
type MlSection = "catalogo" | "anuncios" | "orders" | "metrics"
type MlSidebarGroup = "anuncios" | "pedidos" | "metricas"
type HunterSection =
  | "padrao"
  | "analise-anuncio"
  | "quirografados"
  | "concorrentes"
  | "metricas-analise"
type CostDetailTarget = "orders" | "history"

type CostDetailGroup = {
  label: string
  total: number
  target: CostDetailTarget
  items: { label: string; value: number; detail?: string }[]
}

type InsightValueFormat = "currency" | "number" | "percent"

type FinanceInsightDetailGroup = {
  label: string
  total: number
  format?: InsightValueFormat
  target?: CostDetailTarget
  items: { label: string; value: number; detail?: string; format?: InsightValueFormat }[]
}

type HomeActionItem = {
  title: string
  description: string
  tone: "danger" | "warning" | "info" | "success"
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}

type StockProduct = {
  id: string
  name: string
  sku: string
  mlItemId?: string
  mlItemAliases?: string[]
  imageUrl?: string
  category: string
  quantity: number
  minStock: number
  unitCost: number
  sellingPrice?: number
  stockSource?: "manual" | "ml_full"
  kanbanStatus?: KanbanStatus
  kanbanNote?: string
  estimatedArrival?: string
  kanbanHidden?: boolean
  supplier?: string
}

type StockKanbanCard = {
  id: string
  productId: string
  kanbanStatus: KanbanStatus
  quantity: number
  note?: string
  estimatedArrival?: string
}

type StockMovement = {
  id: string
  productId: string
  type: "in" | "out" | "adjustment" | "sale"
  quantity: number
  date: string
  unitPrice?: number
  note?: string
  createdAt?: number
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
  /** true = vitrine catalogo ML; false = anuncio classico (par sincronizado); null = API sem campo */
  catalogListing?: boolean | null
  permalink?: string
  thumbnail?: string
  logisticType?: string | null
}

/** Dados minimos para vincular estoque ao anuncio (catalogo ou lista classica). */
type MlListingStockEditSource = {
  itemId: string
  title: string
  price: number
  availableQuantity: number
  sellerSku?: string | null
  thumbnail?: string
}

/** Classico = `catalog_listing:false`. Sem flag, cai no heuristic antigo (sem catalog_product_id). */
function isMlClassicListingRow(l: MlListing): boolean {
  if (l.catalogListing === true) return false
  if (l.catalogListing === false) return true
  return l.catalogProductId == null
}

function mlListingToStockEditSource(listing: MlListing): MlListingStockEditSource {
  return {
    itemId: normalizeMercadoLibreItemId(listing.id),
    title: listing.title,
    price: listing.price,
    availableQuantity: listing.available_quantity,
    sellerSku: listing.sku?.trim() ? listing.sku.trim() : null,
    thumbnail: listing.thumbnail,
  }
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

type StockSalesReconcileReport = {
  totalMlOrdersFetched?: number
  totalOrders?: number
  processedItems?: number
  skippedAlreadyProcessed?: number
  unmatchedItems?: number
  movementsCreated?: number
  transactionsCreated?: number
  stockShortages?: number
  adjusted?: Array<{
    orderId: string
    productName: string
    soldQuantity: number
    previousQuantity: number
    nextQuantity: number
    matchMethod: string
  }>
  unmatched?: Array<{
    orderId: string
    mlItemId: string
    title: string
    quantity: number
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
  /** SKU do anuncio (seller_custom_field no ML), se informado. */
  sellerSku?: string | null
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
  /** R$ 5,00 / item — taxa de envio/processamento Centralize. */
  centralizeShipping: number
  /** custo medio de embalagem por produto. */
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
/**
 * Custos reais da operacao Centralize, cobrados por item processado. Aplicados
 * em CIMA de `order.shippingCostAmount` (que e o frete ML cobrado do vendedor),
 * porque sao etapas distintas:
 *  - HUB_CENTRALIZE_SHIPPING_PER_ITEM: taxa fixa de logistica/processamento por item (R$ 5,00).
 *  - HUB_CENTRALIZE_PACKAGING_PER_ITEM: custo medio padrao de embalagem por item (R$ 1,50).
 *  - Multiprocessador usa 3 embalagens por item (R$ 4,50).
 * Entram na DRE em "Custos de Fulfillment", separados de Frete ML, Taxas ML e CMV.
 */
const HUB_CENTRALIZE_SHIPPING_PER_ITEM = 5
const HUB_CENTRALIZE_PACKAGING_PER_ITEM = 1.5
const HUB_CENTRALIZE_MULTIPROCESSADOR_PACKAGING_PER_ITEM = 4.5
const HUB_ML_AVG_FEE_RATE = 0.16

// Mesmo tokenize usado em convex/stock.ts enrichPhotosFromMl — fallback para
// casar pedidos com produtos cadastrados manualmente quando o mlItemId nao
// esta vinculado ainda.
function tokenizeTitle(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function isMultiprocessadorProduct(product?: Pick<StockProduct, "name"> | null, title = "") {
  const text = `${product?.name ?? ""} ${title}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  return text.includes("multiprocessador")
}

function centralizePackagingPerItem(product?: Pick<StockProduct, "name"> | null, title = "") {
  return isMultiprocessadorProduct(product, title)
    ? HUB_CENTRALIZE_MULTIPROCESSADOR_PACKAGING_PER_ITEM
    : HUB_CENTRALIZE_PACKAGING_PER_ITEM
}

function centralizeFulfillmentCostForItem(
  product: Pick<StockProduct, "name"> | undefined,
  quantity: number,
  title = "",
) {
  const safeQuantity = Math.max(0, quantity)
  return (
    safeQuantity * (HUB_CENTRALIZE_SHIPPING_PER_ITEM + centralizePackagingPerItem(product, title))
  )
}

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

function firstDayOfIsoMonth(isoDate: string) {
  return `${isoDate.slice(0, 7)}-01`
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
  let fulfillmentCost = 0
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
    fulfillmentCost += order.items.reduce((sum, item) => {
      const byItem = item.id ? productByMlItemId.get(item.id) : undefined
      const bySku = item.sku ? productBySku.get(item.sku.toLowerCase()) : undefined
      return (
        sum +
        centralizeFulfillmentCostForItem(byItem ?? bySku, Math.max(0, item.quantity), item.title)
      )
    }, 0)

    const cogs = order.items.reduce((total, item) => {
      const byItem = item.id ? productByMlItemId.get(item.id) : undefined
      const bySku = item.sku ? productBySku.get(item.sku.toLowerCase()) : undefined
      const mapped = byItem ?? bySku
      return total + (mapped?.unitCost ?? 0) * Math.max(0, item.quantity)
    }, 0)
    productCosts += cogs
  }

  const netReceived = revenueConfirmed - marketplaceFees - shippingPaidBySeller + shippingBonus
  const grossProfit = netReceived - returnsAmount - productCosts - fulfillmentCost - taxes

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
    fulfillmentCost,
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

type SalesEvolutionPoint = {
  key: string
  label: string
  revenue: number
  costs: number
  profit: number
  orders: number
}

type CommerceCashFlowRow = {
  label: string
  salesIncome: number
  manualIncome: number
  mpReleases: number
  mpDebits: number
  cogs: number
  mlFees: number
  shipping: number
  /** Custo Centralize: envio fixo + embalagem por produto. */
  fulfillment: number
  taxes: number
  manualExpenses: number
  income: number
  expense: number
  net: number
  details: string[]
}

function financePeriodKey(dateValue: string, period: FinancialPeriod) {
  if (period === "day") return dateValue
  const [year, month, day] = dateValue.split("-").map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  if (period === "week") {
    const start = new Date(date)
    const weekday = date.getDay()
    const diff = weekday === 0 ? -6 : 1 - weekday
    start.setDate(date.getDate() + diff)
    return start.toISOString().slice(0, 10)
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
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
  imageUrl?: string
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

type TopProductRow = AbcProductRow & {
  mlbId: string
  cogs: number
  feesAndShipping: number
  velocity: number
  stockCritical: boolean
  stockQuantity: number
}

type DreSnapshot = {
  revenueConfirmed: number
  marketplaceFees: number
  shippingPaidBySeller: number
  shippingBonus: number
  netReceived: number
  returnsAmount: number
  productCosts: number
  /** Custo Centralize: envio fixo + embalagem por produto. */
  fulfillmentCost: number
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
      { key, label: bucketLabel(key, options.period), revenue: 0, costs: 0, profit: 0, orders: 0 },
    ]),
  )

  for (const transaction of transactions) {
    const key = toBucketKey(transaction.date, options.period)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (transaction.kind === "income" && transaction.origin === "Venda online") {
      bucket.revenue += transaction.amount
    }
    if (transaction.kind === "expense") {
      bucket.costs += transaction.amount
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

// Resolver flexivel: usa mlItemId direto; quando nao acha, deixa o caller
// providenciar um fallback por similaridade de titulo / SKU.
type OrderItemForLookup = { id: string; title?: string; sku?: string }
type ProductLookupResolver = (item: OrderItemForLookup) => StockProduct | undefined

function defaultProductResolver(
  productByMlItemId: Map<string, StockProduct>,
): ProductLookupResolver {
  return (item) => productByMlItemId.get(item.id)
}

function buildOrdersSalesEvolutionData(
  orders: MlOrder[],
  productByMlItemId: Map<string, StockProduct>,
  options: {
    period: FinancialPeriod
    range: { startDate?: string; endDate?: string }
  },
  resolveProduct?: ProductLookupResolver,
): SalesEvolutionPoint[] {
  const resolve = resolveProduct ?? defaultProductResolver(productByMlItemId)
  const bucketKeys = buildBucketKeys(options.range, options.period)
  const buckets = new Map<string, SalesEvolutionPoint>(
    bucketKeys.map((key) => [
      key,
      { key, label: bucketLabel(key, options.period), revenue: 0, costs: 0, profit: 0, orders: 0 },
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
      const mappedProduct = resolve({ id: item.id, title: item.title, sku: item.sku })
      return sum + (mappedProduct?.unitCost ?? 0) * Math.max(0, item.quantity)
    }, 0)
    const shippingCost = Math.max(0, order.shippingCostAmount)
    const taxes = Math.max(0, order.taxesAmount)
    const mlFee = Math.max(0, order.mlFeeAmount)
    const fulfillmentCost = order.items.reduce((sum, item) => {
      const mappedProduct = resolve({ id: item.id, title: item.title, sku: item.sku })
      return (
        sum +
        centralizeFulfillmentCostForItem(mappedProduct, Math.max(0, item.quantity), item.title)
      )
    }, 0)
    const totalCosts = productCost + shippingCost + taxes + mlFee + fulfillmentCost
    const revenue = Math.max(0, order.totalAmount)

    bucket.revenue += revenue
    bucket.costs += totalCosts
    bucket.profit += revenue - totalCosts
    bucket.orders += 1
  }

  return Array.from(buckets.values())
}

function buildOrdersFinancialSummary(
  orders: MlOrder[],
  productByMlItemId: Map<string, StockProduct>,
  range?: { startDate?: string; endDate?: string },
  resolveProduct?: ProductLookupResolver,
): OrdersFinancialSummary {
  const resolve = resolveProduct ?? defaultProductResolver(productByMlItemId)
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
      const totalQty = order.items.reduce((s, i) => s + Math.max(0, i.quantity), 0)
      const productCost = order.items.reduce((total, item) => {
        const mappedProduct = resolve({ id: item.id, title: item.title, sku: item.sku })
        return total + (mappedProduct?.unitCost ?? 0) * Math.max(0, item.quantity)
      }, 0)
      const shippingCost = Math.max(0, order.shippingCostAmount)
      const taxes = Math.max(0, order.taxesAmount)
      const mlFee = Math.max(0, order.mlFeeAmount)
      const fulfillmentCost = order.items.reduce((sum, item) => {
        const mappedProduct = resolve({ id: item.id, title: item.title, sku: item.sku })
        return (
          sum +
          centralizeFulfillmentCostForItem(mappedProduct, Math.max(0, item.quantity), item.title)
        )
      }, 0)
      const orderCosts = productCost + shippingCost + taxes + mlFee + fulfillmentCost

      acc.grossRevenue += Math.max(0, order.totalAmount)
      acc.totalCosts += orderCosts
      acc.netProfit += Math.max(0, order.totalAmount) - orderCosts
      acc.ordersCount += 1
      acc.soldItems += totalQty
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

function isValidMarketplaceOrder(order: MlOrder) {
  return order.status.toLowerCase() !== "cancelled"
}

function orderInRange(order: MlOrder, range?: { startDate?: string; endDate?: string }) {
  const orderDate = order.dateCreated.slice(0, 10)
  if (range?.startDate && orderDate < range.startDate) return false
  if (range?.endDate && orderDate > range.endDate) return false
  return true
}

function daysBetweenInclusive(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return 30
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const diff = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  return Math.max(1, diff)
}

function transactionIsManualAdjustment(transaction: FinancialTransaction) {
  return transaction.origin !== "Venda online"
}

function buildTopProductRows({
  abcRows,
  products,
  rangeDays,
}: {
  abcRows: AbcProductRow[]
  products: StockProduct[]
  rangeDays: number
}): TopProductRow[] {
  const bySku = new Map<string, StockProduct>()
  const byMl = new Map<string, StockProduct>()
  for (const product of products) {
    bySku.set(product.sku.toLowerCase(), product)
    if (product.mlItemId) byMl.set(product.mlItemId, product)
    for (const alias of product.mlItemAliases ?? []) byMl.set(alias, product)
  }

  return abcRows
    .map((row) => {
      const product = byMl.get(row.productId) ?? bySku.get(row.sku.toLowerCase())
      const cogs = (product?.unitCost ?? 0) * row.quantitySold
      const feesAndShipping = Math.max(0, row.totalCost - cogs)
      const stockQuantity = product?.quantity ?? 0
      const minStock = product?.minStock ?? 0
      return {
        ...row,
        mlbId: product?.mlItemId ?? row.productId,
        cogs,
        feesAndShipping,
        velocity: row.quantitySold / rangeDays,
        stockCritical: stockQuantity <= minStock,
        stockQuantity,
      }
    })
    .sort((a, b) => b.profit - a.profit)
}

function dedupeTopProductRows(rows: TopProductRow[]) {
  const deduped = new Map<string, TopProductRow>()
  for (const row of rows) {
    const key = normalizeMercadoLibreItemId(row.mlbId) || row.sku.toLowerCase() || row.productId
    const current = deduped.get(key)
    if (!current) {
      deduped.set(key, row)
      continue
    }
    deduped.set(key, {
      ...current,
      quantitySold: current.quantitySold + row.quantitySold,
      revenue: current.revenue + row.revenue,
      totalCost: current.totalCost + row.totalCost,
      profit: current.profit + row.profit,
      cogs: current.cogs + row.cogs,
      feesAndShipping: current.feesAndShipping + row.feesAndShipping,
      velocity: current.velocity + row.velocity,
      stockCritical: current.stockCritical || row.stockCritical,
      stockQuantity: Math.max(current.stockQuantity, row.stockQuantity),
      marginPercent:
        current.revenue + row.revenue > 0
          ? ((current.profit + row.profit) / (current.revenue + row.revenue)) * 100
          : 0,
    })
  }
  return Array.from(deduped.values()).sort((a, b) => b.profit - a.profit)
}

function finalizeAbcRows(
  groupedRows: Array<{
    productId: string
    productName: string
    sku: string
    imageUrl?: string
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
      imageUrl: row.imageUrl,
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
      imageUrl?: string
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
        imageUrl: mappedProduct?.imageUrl,
        quantitySold: 0,
        revenue: 0,
        totalCost: 0,
        profit: 0,
      }
      current.quantitySold += quantity
      current.revenue += revenue
      current.totalCost += totalCost
      current.profit += profit
      if (!current.imageUrl && mappedProduct?.imageUrl) {
        current.imageUrl = mappedProduct.imageUrl
      }
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
  const [activeFinanceInsight, setActiveFinanceInsight] = useState<FinanceInsightKey>("costs")
  const [financeInsightModalOpen, setFinanceInsightModalOpen] = useState(false)
  const [activeFinanceSection, setActiveFinanceSection] = useState<FinanceSection>("overview")
  const [activeStockSection, setActiveStockSection] = useState<StockSection>("overview")
  const [activeMlSection, setActiveMlSection] = useState<MlSection>("catalogo")
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
    mlItemId: "",
    category: "",
    quantity: "",
    minStock: "",
    unitCost: "",
    sellingPrice: "",
  })
  /** Foto copiada de sugestão (catálogo / ML) ao criar produto manual. */
  const [productFormImageUrl, setProductFormImageUrl] = useState<string | undefined>(undefined)
  const [manualStockImageUrl, setManualStockImageUrl] = useState<string | undefined>(undefined)
  const [manualStockForm, setManualStockForm] = useState({
    name: "",
    mlItemId: "",
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
    mlItemId: "",
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
  const [mlPlainListings, setMlPlainListings] = useState<MlListing[]>([])
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
  const mlCatalogTabBootstrapped = useRef(false)
  const mlAnunciosTabBootstrapped = useRef(false)
  const mlOrdersSectionBootstrapped = useRef(false)
  const mlAppBootstrapUserRef = useRef<string | null>(null)
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
  const [stockSalesReconcileReport, setStockSalesReconcileReport] =
    useState<StockSalesReconcileReport | null>(null)
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
  const [mlCatalogStockDialogOpen, setMlCatalogStockDialogOpen] = useState(false)
  const [mlCatalogStockEditRow, setMlCatalogStockEditRow] =
    useState<MlListingStockEditSource | null>(null)
  const [mlCatalogStockEditProductId, setMlCatalogStockEditProductId] =
    useState<Id<"stockProducts"> | null>(null)
  const [mlCatalogStockEditSuggestion, setMlCatalogStockEditSuggestion] = useState<ReturnType<
    typeof suggestUnitCostFromInventory
  > | null>(null)
  const [mlCatalogStockEditSaving, setMlCatalogStockEditSaving] = useState(false)
  const [mlCatalogStockEditError, setMlCatalogStockEditError] = useState<string | null>(null)
  const [mlCatalogStockForm, setMlCatalogStockForm] = useState({
    name: "",
    mlItemId: "",
    category: "",
    quantity: "",
    minStock: "",
    unitCost: "",
    sellingPrice: "",
  })
  const [mlOrderCostAnalysis, setMlOrderCostAnalysis] = useState<OrderCostAnalysis | null>(null)
  const [financeOrdersTitleFilter, setFinanceOrdersTitleFilter] = useState("")
  const [financeOrdersSkuFilter, setFinanceOrdersSkuFilter] = useState("")
  const [financeOrdersStatusFilter, setFinanceOrdersStatusFilter] = useState("all")
  const [financeOverviewCompare, setFinanceOverviewCompare] = useState<
    "none" | "prev_month" | "prev_year"
  >("none")
  const [financeOverviewProjection, setFinanceOverviewProjection] = useState<"none" | "month">(
    "none",
  )
  const [financeSourceFilter, setFinanceSourceFilter] = useState<FinanceSourceFilter>("all")
  const [financeTypeFilter, setFinanceTypeFilter] = useState<FinanceTypeFilter>("all")
  const [expandedReportMonth, setExpandedReportMonth] = useState<string | null>(null)
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
  const [historySummaryFilter, setHistorySummaryFilter] = useState<HistorySummaryFilter | null>(
    null,
  )
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
  const [mpSyncLoading, setMpSyncLoading] = useState(false)
  const [globalSyncLoading, setGlobalSyncLoading] = useState(false)
  const [mpError, setMpError] = useState<string | null>(null)
  const [mpSyncStatus, setMpSyncStatus] = useState<string | null>(null)
  const [mpSyncState, setMpSyncState] = useState<"idle" | "pending" | "success" | "failed">("idle")
  const [globalSyncStatus, setGlobalSyncStatus] = useState<string | null>(null)
  const [mpConnectionStatus, setMpConnectionStatus] = useState<{
    connected: boolean
    source?: "mp_oauth" | "mp_app_token"
    mpUserId?: string | null
    updatedAt?: number | null
  } | null>(null)
  const [externalSyncStatuses, setExternalSyncStatuses] = useState<
    Array<{
      provider: "all" | "mercado_livre" | "mercado_pago" | "stock"
      status: "idle" | "running" | "success" | "failed"
      lastStartedAt?: number
      lastFinishedAt?: number
      lastSuccessAt?: number
      message?: string
    }>
  >([])
  const [mpBalanceUnavailable, setMpBalanceUnavailable] = useState(false)
  const [mpSaldoOculto, setMpSaldoOculto] = useState(false)
  const [mpAnchorBalance, setMpAnchorBalance] = useState("")
  const [, setMpTxSummary] = useState<{
    totalCredits: number
    totalDebits: number
    windowSinceIso: string
  } | null>(null)
  const [mpExtractSource, setMpExtractSource] = useState<"ledger" | "recent_fallback">("ledger")
  const [mpExtratoVerTudo, setMpExtratoVerTudo] = useState(false)

  type DayGroupUI = DayGroup
  const [mpDayGroups, setMpDayGroups] = useState<DayGroupUI[]>([])
  const [, setMpFuturePendingTotal] = useState(0)
  const [mpFutureLoading, setMpFutureLoading] = useState(false)
  const [mpFutureStatus, setMpFutureStatus] = useState<string | null>(null)
  const [mpExpandedDays, setMpExpandedDays] = useState<Set<string>>(new Set())

  const fetchMpData = useCallback(async () => {
    setMpLoading(true)
    setMpError(null)
    try {
      const ledgerRes = await fetch("/api/mp/ledger", { cache: "no-store" })
      const ledgerJson = await ledgerRes.json()

      if (ledgerJson.ok && ledgerJson.data) {
        const d = ledgerJson.data as {
          anchor?: unknown
          balance?: {
            availableBalance?: number | null
            unavailableBalance?: number | null
            totalAmount?: number | null
            currencyId?: string | null
          }
          movementNet?: number
          movements?: Array<{
            _id?: string
            movementKey?: string
            date: string
            description: string
            amount: number
            type: "credit" | "debit"
            status: string
          }>
          lastSync?: {
            status?: string
            fileName?: string
            createdAt?: number
            message?: string
          } | null
        }
        const hasAnchor = Boolean(d.anchor)
        setMpBalanceUnavailable(!hasAnchor)
        setMpBalance(
          hasAnchor
            ? {
                availableBalance: d.balance?.availableBalance ?? 0,
                unavailableBalance: d.balance?.unavailableBalance ?? 0,
                totalAmount: d.balance?.totalAmount ?? d.balance?.availableBalance ?? 0,
                currencyId: d.balance?.currencyId ?? "BRL",
              }
            : null,
        )
        setMpTransactions(
          (d.movements ?? []).map((movement) => ({
            id: movement._id ?? movement.movementKey ?? `${movement.date}:${movement.description}`,
            date: movement.date,
            description: movement.description,
            amount: movement.amount,
            type: movement.type,
            status: movement.status,
          })),
        )
        setMpExtractSource((d.movements ?? []).length > 0 ? "ledger" : "recent_fallback")
        setMpTxSummary({
          totalCredits: Math.max(0, d.movementNet ?? 0),
          totalDebits: Math.max(0, -(d.movementNet ?? 0)),
          windowSinceIso: new Date(d.lastSync?.createdAt ?? Date.now()).toISOString(),
        })
        if (d.lastSync?.status === "failed") {
          setMpSyncState("failed")
          setMpSyncStatus(d.lastSync.message ?? "Falha ao atualizar saldo Mercado Pago.")
        } else if (d.lastSync?.status === "success") {
          setMpSyncState("success")
          setMpSyncStatus(null)
        }
        if ((d.movements ?? []).length === 0) {
          const txResponse = await fetch("/api/mp/transactions?windowDays=180&limit=1000", {
            cache: "no-store",
          })
          const txPayload = await txResponse.json()
          if (txResponse.ok && txPayload.ok && txPayload.data) {
            const txData = txPayload.data as
              | Array<{
                  id: string
                  date: string
                  description: string
                  amount: number
                  type: "credit" | "debit"
                  status: string
                }>
              | {
                  transactions?: Array<{
                    id: string
                    date: string
                    description: string
                    amount: number
                    type: "credit" | "debit"
                    status: string
                  }>
                }
            setMpTransactions(Array.isArray(txData) ? txData : (txData.transactions ?? []))
            setMpExtractSource("recent_fallback")
          }
        }
      } else {
        setMpBalance(null)
        setMpBalanceUnavailable(true)
        setMpError(ledgerJson.error ?? "Erro ao buscar ledger Mercado Pago")
      }
    } catch (err) {
      console.error("[mp] fetch error:", err)
      setMpError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setMpLoading(false)
    }
  }, [])

  const syncMpReports = useCallback(
    async (options: { manual?: boolean } = {}) => {
      setMpSyncLoading(true)
      if (options.manual) {
        setMpSyncState("idle")
        setMpSyncStatus(null)
      }
      setMpError(null)
      try {
        const res = await fetch("/api/mp/reports/sync", { method: "POST" })
        const json = await res.json()
        if (!json.ok) {
          const detail = typeof json.details === "string" ? json.details : null
          if (options.manual) {
            setMpSyncState("failed")
            setMpSyncStatus(
              detail
                ? `${json.error ?? "Erro ao atualizar saldo."} ${detail}`
                : (json.error ?? "Erro ao atualizar saldo."),
            )
          }
          return
        }
        const data = json.data as {
          status?: string
          imported?: number
          skipped?: number
          message?: string
        }
        if (options.manual || data.status === "success") {
          if (data.status === "pending") {
            setMpSyncState("pending")
            setMpSyncStatus(
              data.message ?? "Saldo em atualização. O app tentara importar automaticamente.",
            )
          } else if (data.status === "failed") {
            setMpSyncState("failed")
            setMpSyncStatus(data.message ?? "Falha ao atualizar saldo Mercado Pago.")
          } else {
            setMpSyncState("success")
            setMpSyncStatus(null)
          }
        }
        await fetchMpData()
      } catch (err) {
        console.error("[mp] sync error:", err)
        if (options.manual) {
          setMpSyncState("failed")
          setMpSyncStatus(err instanceof Error ? err.message : "Erro desconhecido")
        }
      } finally {
        setMpSyncLoading(false)
      }
    },
    [fetchMpData],
  )

  const loadExternalSyncStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/sync/status", { cache: "no-store" })
      const payload = await response.json()
      if (response.ok && payload.ok) {
        setExternalSyncStatuses(payload.data ?? [])
      }
    } catch (error) {
      console.error("[sync] status error:", error)
    }
  }, [])

  const loadMpConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/mp/account", { cache: "no-store" })
      const payload = await response.json()
      if (response.ok && payload.ok) {
        setMpConnectionStatus(payload.data)
      }
    } catch (error) {
      console.error("[mp] account status error:", error)
    }
  }, [])

  const loadMlConnectionStatus = useCallback(async () => {
    setMlLoading(true)
    try {
      const response = await fetch("/api/ml/account", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao carregar status do Mercado Livre.")
      }
      const connectionData = payload.data as MlConnectionStatus
      setMlConnectionStatus(connectionData)
      return connectionData
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao consultar conta Mercado Livre.")
      return null
    } finally {
      setMlLoading(false)
    }
  }, [])

  const syncAllExternalData = useCallback(
    async (force = false) => {
      if (globalSyncLoading) return
      setGlobalSyncLoading(true)
      setGlobalSyncStatus("Sincronizando dados externos...")
      try {
        const response = await fetch(`/api/sync/all${force ? "?force=1" : ""}`, {
          method: "POST",
          cache: "no-store",
        })
        const payload = await response.json()
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Falha ao sincronizar dados externos.")
        }
        setGlobalSyncStatus(
          payload.data?.skipped
            ? "Dados externos ainda recentes; usando cache salvo."
            : "Sincronizacao geral concluida.",
        )
        const stockSalesResult = payload.data?.results?.stockSales
        if (stockSalesResult && typeof stockSalesResult === "object") {
          setStockSalesReconcileReport(stockSalesResult as StockSalesReconcileReport)
        }
        await Promise.all([loadExternalSyncStatuses(), fetchMpData()])
      } catch (error) {
        setGlobalSyncStatus(error instanceof Error ? error.message : "Erro ao sincronizar dados.")
      } finally {
        setGlobalSyncLoading(false)
      }
    },
    [fetchMpData, globalSyncLoading, loadExternalSyncStatuses],
  )

  const saveMpAnchor = useCallback(async () => {
    const balance = Number(mpAnchorBalance.replace(/\./g, "").replace(",", "."))
    if (!Number.isFinite(balance)) {
      setMpSyncStatus("Informe um saldo numerico.")
      return
    }

    setMpLoading(true)
    setMpSyncStatus(null)
    try {
      const res = await fetch("/api/mp/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance,
          currencyId: "BRL",
          anchoredAt: new Date().toISOString(),
          note: "Saldo disponivel informado pelo painel Mercado Pago.",
        }),
      })
      const json = await res.json()
      if (!json.ok) {
        setMpSyncStatus(json.error ?? "Erro ao salvar saldo inicial.")
        return
      }
      setMpAnchorBalance("")
      setMpSyncStatus("Saldo inicial salvo. O saldo passa a ser calculado pelo extrato oficial.")
      await fetchMpData()
    } catch (err) {
      console.error("[mp] anchor error:", err)
      setMpSyncStatus(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setMpLoading(false)
    }
  }, [fetchMpData, mpAnchorBalance])

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

  useEffect(() => {
    if (activeModule !== "finance" || activeFinanceSection !== "cashflow") return
    if (!mpConnectionStatus?.connected) return
    if (mpSyncLoading) return

    const latestMpStatus = externalSyncStatuses.find((status) => status.provider === "mercado_pago")
    const lastRunAt = latestMpStatus?.lastStartedAt ?? latestMpStatus?.lastSuccessAt ?? 0
    const isRecent = lastRunAt > 0 && Date.now() - lastRunAt < 30 * 60 * 1000
    const shouldPollPending = latestMpStatus?.status === "running" || mpSyncStatus?.includes("Task")

    if (isRecent && !shouldPollPending) return

    const timeoutId = window.setTimeout(
      () => {
        void syncMpReports()
      },
      shouldPollPending ? 15_000 : 1_000,
    )

    return () => window.clearTimeout(timeoutId)
  }, [
    activeFinanceSection,
    activeModule,
    externalSyncStatuses,
    mpConnectionStatus?.connected,
    mpSyncLoading,
    mpSyncStatus,
    syncMpReports,
  ])

  useEffect(() => {
    if (!userId) return
    void loadExternalSyncStatuses()
    void loadMpConnectionStatus()
    void syncAllExternalData(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap only when account is ready
  }, [userId])

  const mpFutureGross = useMemo(
    () => mpDayGroups.reduce((s, g) => s + g.grossTotal, 0),
    [mpDayGroups],
  )

  const mpFutureNet = useMemo(() => mpDayGroups.reduce((s, g) => s + g.total, 0), [mpDayGroups])

  const mpFutureFees = useMemo(() => mpFutureGross - mpFutureNet, [mpFutureGross, mpFutureNet])

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
  const addKanbanCard = useMutation(api.stock.addKanbanCard)
  const updateKanbanCard = useMutation(api.stock.updateKanbanCard)
  const deleteKanbanCard = useMutation(api.stock.deleteKanbanCard)
  const setProductKanbanHidden = useMutation(api.stock.setProductKanbanHidden)
  const saveKanbanColumnOrder = useMutation(api.stock.saveKanbanColumnOrder)
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
    const mpErrorCode = params.get("mp_error")
    const mpConnected = params.get("mp_connected")

    if (!mlErrorCode && !mlConnected && !mpErrorCode && !mpConnected) return

    setActiveModule("connections")

    if (mlConnected === "1") {
      setMlInfo("Conta do Mercado Livre conectada com sucesso.")
      setMlError(null)
      void loadMlConnectionStatus()
      void syncAllExternalData(true)
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

    if (mpConnected === "1") {
      setGlobalSyncStatus("Conta do Mercado Pago conectada com sucesso.")
    }

    if (mpErrorCode) {
      const errorMap: Record<string, string> = {
        configuracao_oauth:
          "Configuração OAuth do Mercado Pago incorreta. Confira MERCADO_PAGO_CLIENT_ID numérico, CLIENT_SECRET e REDIRECT_URI.",
        falha_conexao: "Não foi possível iniciar a conexão com o Mercado Pago.",
        callback_sem_code: "Retorno do Mercado Pago sem código de autorização.",
        state_invalido: "Falha de segurança no OAuth do Mercado Pago. Tente conectar novamente.",
        falha_callback:
          "Não foi possível concluir a autenticação Mercado Pago. Confira redirect URI e credenciais.",
      }
      setGlobalSyncStatus(errorMap[mpErrorCode] ?? `Erro no Mercado Pago: ${mpErrorCode}`)
    }

    const cleanUrl = `${window.location.pathname}`
    window.history.replaceState({}, "", cleanUrl)
  }, [loadMlConnectionStatus, syncAllExternalData])

  useEffect(() => {
    if ((activeModule !== "finance" && activeModule !== "home") || !userId) return

    const loadOrdersForFinancial = async () => {
      try {
        const connectionResponse = await fetch("/api/ml/account", { cache: "no-store" })
        const connectionPayload = await connectionResponse.json()
        if (!connectionResponse.ok || !connectionPayload.ok || !connectionPayload.data?.connected) {
          return
        }

        await loadMlOrders({
          startDate: filters.startDate,
          endDate: filters.endDate,
        })
      } catch {
        // Keep financial module resilient when ML integration is unavailable.
      }
    }

    void loadOrdersForFinancial()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMlOrders is a local fetch helper; reload is driven by module/user/date range.
  }, [activeModule, filters.endDate, filters.startDate, userId])

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

  const bills = useMemo<FinancialBill[]>(
    () =>
      (financeData?.bills ?? []).map((item) => ({
        id: item._id,
        title: item.title,
        amount: item.amount,
        dueDate: item.dueDate,
        status: item.status,
        kind: item.kind,
        categoryId: item.categoryId,
      })),
    [financeData?.bills],
  )

  const products = useMemo<StockProduct[]>(
    () =>
      (stockData?.products ?? []).map((item) => ({
        id: item._id,
        name: item.name,
        sku: item.sku,
        mlItemId: item.mlItemId,
        mlItemAliases: item.mlItemAliases,
        imageUrl: item.imageUrl,
        category: item.category,
        quantity: item.quantity,
        minStock: item.minStock,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
        stockSource: item.stockSource,
        kanbanStatus: item.kanbanStatus,
        kanbanNote: item.kanbanNote,
        estimatedArrival: item.estimatedArrival,
        kanbanHidden: item.kanbanHidden,
        supplier: item.supplier,
      })),
    [stockData?.products],
  )

  const stockKanbanCards = useMemo<StockKanbanCard[]>(
    () =>
      (stockData?.kanbanCards ?? []).map((item) => ({
        id: item._id,
        productId: item.productId,
        kanbanStatus: item.kanbanStatus,
        quantity: item.quantity,
        note: item.note,
        estimatedArrival: item.estimatedArrival,
      })),
    [stockData?.kanbanCards],
  )

  const productNameSuggestionCandidates = useMemo<ProductSuggestionCandidate[]>(
    () =>
      products
        .filter((p) => Boolean(p.mlItemId || p.imageUrl))
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          imageUrl: p.imageUrl,
          mlItemId: p.mlItemId,
          sellingPrice: p.sellingPrice,
        })),
    [products],
  )

  const kanbanProducts = useMemo<KanbanProduct[]>(() => {
    const baseProducts = products.map((p) => ({
      id: p.id,
      stockProductId: p.id,
      name: p.name,
      sku: p.sku,
      mlItemId: p.mlItemId,
      mlItemAliases: p.mlItemAliases,
      imageUrl: p.imageUrl,
      category: p.category,
      quantity: p.quantity,
      minStock: p.minStock,
      unitCost: p.unitCost,
      sellingPrice: p.sellingPrice,
      kanbanStatus: p.kanbanStatus ?? (p.quantity > 0 ? "in_stock" : "purchased"),
      kanbanNote: p.kanbanNote,
      estimatedArrival: p.estimatedArrival,
      kanbanHidden: p.kanbanHidden,
      supplier: p.supplier,
    }))
    const byProductId = new Map(products.map((product) => [product.id, product]))
    const extraCards = stockKanbanCards.flatMap((card) => {
      const p = byProductId.get(card.productId)
      if (!p) return []
      return [
        {
          id: `kanban-card:${card.id}`,
          stockProductId: p.id,
          kanbanCardId: card.id,
          isExtraKanbanCard: true,
          name: p.name,
          sku: p.sku,
          mlItemId: p.mlItemId,
          mlItemAliases: p.mlItemAliases,
          imageUrl: p.imageUrl,
          category: p.category,
          quantity: card.quantity,
          minStock: p.minStock,
          unitCost: p.unitCost,
          sellingPrice: p.sellingPrice,
          kanbanStatus: card.kanbanStatus,
          kanbanNote: card.note,
          estimatedArrival: card.estimatedArrival,
          kanbanHidden: p.kanbanHidden,
          supplier: p.supplier,
        },
      ]
    })
    return [...baseProducts, ...extraCards]
  }, [products, stockKanbanCards])

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
        createdAt: item.createdAt,
      })),
    [stockData?.movements],
  )

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const productCostLookups = useMemo<ProductCostLookup[]>(
    () =>
      products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unitCost: p.unitCost,
        category: p.category,
        mlItemId: p.mlItemId,
      })),
    [products],
  )
  const productMapByMlItemId = useMemo(() => {
    const map = new Map<string, StockProduct>()
    const pickCostSource = (current: StockProduct | undefined, candidate: StockProduct) => {
      if (!current) return candidate
      if (current.unitCost <= 0 && candidate.unitCost > 0) return candidate
      if (current.kanbanStatus === "fulfillment" && candidate.kanbanStatus !== "fulfillment") {
        return candidate
      }
      return current
    }
    for (const p of products) {
      if (p.mlItemId) map.set(p.mlItemId, pickCostSource(map.get(p.mlItemId), p))
      for (const alias of p.mlItemAliases ?? []) {
        map.set(alias, pickCostSource(map.get(alias), p))
      }
    }
    return map
  }, [products])
  const productMapBySku = useMemo(() => {
    const map = new Map<string, StockProduct>()
    for (const product of products) {
      if (product.sku) map.set(product.sku.toLowerCase(), product)
    }
    return map
  }, [products])

  // Fallback safety net: quando o item do pedido nao tem mlItemId vinculado
  // a nenhum produto, tentamos casar por similaridade de titulo. Tokenizamos
  // uma vez aqui pra evitar recomputar em cada busca.
  const productTokenIndex = useMemo(
    () =>
      products
        .filter((p) => p.unitCost > 0)
        .map((p) => ({
          product: p,
          tokens: tokenizeTitle(p.name),
        }))
        .filter((entry) => entry.tokens.length > 0),
    [products],
  )

  const findProductByOrderItem = useCallback(
    (item: { id?: string; title?: string; sku?: string }) => {
      if (item.id) {
        const direct = productMapByMlItemId.get(item.id)
        if (direct) return direct
      }
      if (item.sku) {
        const bySku = productMapBySku.get(item.sku.toLowerCase())
        if (bySku) return bySku
      }
      if (item.title) {
        const itemTokens = tokenizeTitle(item.title)
        if (itemTokens.length === 0) return undefined
        let bestScore = 0
        let bestProduct: StockProduct | undefined
        for (const entry of productTokenIndex) {
          const denom = Math.min(itemTokens.length, entry.tokens.length)
          if (denom === 0) continue
          const matches = entry.tokens.filter((t) => itemTokens.includes(t)).length
          const score = matches / denom
          if (score > bestScore) {
            bestScore = score
            bestProduct = entry.product
          }
        }
        if (bestScore >= 0.5 && bestProduct) return bestProduct
      }
      return undefined
    },
    [productMapByMlItemId, productMapBySku, productTokenIndex],
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
  const baseHistoryTransactions = useMemo(() => {
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
  const historyTransactions = useMemo(() => {
    if (!historySummaryFilter) return baseHistoryTransactions

    return baseHistoryTransactions.filter((transaction) => {
      if (historySummaryFilter === "entries") return transaction.kind === "income"
      if (historySummaryFilter === "fixed") {
        return transaction.kind === "expense" && transaction.expenseType === "fixed"
      }
      if (historySummaryFilter === "operational") {
        return transaction.kind === "expense" && transaction.expenseType !== "fixed"
      }
      return (transaction.periodicity ?? "one_time") !== "one_time"
    })
  }, [baseHistoryTransactions, historySummaryFilter])
  const historySummary = useMemo(() => {
    const entries = baseHistoryTransactions
      .filter((transaction) => transaction.kind === "income")
      .reduce((total, transaction) => total + transaction.amount, 0)
    const fixedCost = baseHistoryTransactions
      .filter(
        (transaction) => transaction.kind === "expense" && transaction.expenseType === "fixed",
      )
      .reduce((total, transaction) => total + transaction.amount, 0)
    const operationalCost = baseHistoryTransactions
      .filter(
        (transaction) => transaction.kind === "expense" && transaction.expenseType !== "fixed",
      )
      .reduce((total, transaction) => total + transaction.amount, 0)
    const recurring = baseHistoryTransactions.filter(
      (transaction) => (transaction.periodicity ?? "one_time") !== "one_time",
    ).length
    return { entries, fixedCost, operationalCost, recurring }
  }, [baseHistoryTransactions])
  const historySummaryFilterLabel =
    historySummaryFilter === "entries"
      ? "Entradas"
      : historySummaryFilter === "fixed"
        ? "Custo Fixo"
        : historySummaryFilter === "operational"
          ? "Custo Operacional"
          : historySummaryFilter === "recurring"
            ? "Recorrentes"
            : null
  function openHistorySummaryDetails(filter: HistorySummaryFilter) {
    setHistorySummaryFilter((current) => (current === filter ? null : filter))
  }
  function handleHistorySummaryCardKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
    filter: HistorySummaryFilter,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openHistorySummaryDetails(filter)
    }
  }
  const summary = useMemo(() => summarizeTransactions(filteredTransactions), [filteredTransactions])
  const evolutionReport = useMemo(() => monthlyEvolution(transactions), [transactions])
  const evolutionDetailsByLabel = useMemo(() => {
    const labels = new Set(evolutionReport.map((item) => item.monthLabel))
    const map = new Map<string, FinancialTransaction[]>()
    for (const transaction of transactions) {
      const [year, month] = transaction.date.split("-").map(Number)
      const label = new Date(year, (month ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      })
      if (!labels.has(label)) continue
      const current = map.get(label) ?? []
      current.push(transaction)
      map.set(label, current)
    }
    return map
  }, [evolutionReport, transactions])
  const salesInFilter = filteredTransactions
    .filter((item) => item.kind === "income" && item.origin === "Venda online")
    .reduce((total, item) => total + item.amount, 0)
  const expensesInFilter = filteredTransactions
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + item.amount, 0)
  const operatingResult = salesInFilter - expensesInFilter

  const stockSummary = useMemo(() => {
    const extraUnits = stockKanbanCards.reduce((total, card) => total + card.quantity, 0)
    const extraStockValue = stockKanbanCards.reduce((total, card) => {
      const product = productMap.get(card.productId)
      return total + card.quantity * (product?.unitCost ?? 0)
    }, 0)
    const totalProducts = products.length
    const totalUnits = products.reduce((total, item) => total + item.quantity, 0) + extraUnits
    const lowStockCount = products.filter((item) => item.quantity <= item.minStock).length
    const stockValue =
      products.reduce((total, item) => total + item.quantity * item.unitCost, 0) + extraStockValue
    return { totalProducts, totalUnits, lowStockCount, stockValue }
  }, [productMap, products, stockKanbanCards])
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
  const ordersFinancialSummary = useMemo(
    () =>
      buildOrdersFinancialSummary(
        mlOrders,
        productMapByMlItemId,
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        findProductByOrderItem,
      ),
    [filters.endDate, filters.startDate, mlOrders, productMapByMlItemId, findProductByOrderItem],
  )
  const hasOrdersFinancialData = ordersFinancialSummary.ordersCount > 0
  const rangeDays = useMemo(
    () => daysBetweenInclusive(filters.startDate, filters.endDate),
    [filters.endDate, filters.startDate],
  )
  const mpTransactionsInFilter = useMemo(
    () =>
      mpTransactions.filter((transaction) => {
        const date = transaction.date.slice(0, 10)
        if (filters.startDate && date < filters.startDate) return false
        if (filters.endDate && date > filters.endDate) return false
        return true
      }),
    [filters.endDate, filters.startDate, mpTransactions],
  )
  const commerceFlowData = useMemo(() => {
    const buckets = new Map<string, CommerceCashFlowRow>()
    const getBucket = (dateValue: string) => {
      const key = financePeriodKey(dateValue, period)
      const current = buckets.get(key)
      if (current) return current
      const next: CommerceCashFlowRow = {
        label: key,
        salesIncome: 0,
        manualIncome: 0,
        mpReleases: 0,
        mpDebits: 0,
        cogs: 0,
        mlFees: 0,
        shipping: 0,
        fulfillment: 0,
        taxes: 0,
        manualExpenses: 0,
        income: 0,
        expense: 0,
        net: 0,
        details: [],
      }
      buckets.set(key, next)
      return next
    }

    for (const order of mlOrders) {
      if (
        !isValidMarketplaceOrder(order) ||
        !orderInRange(order, { startDate: filters.startDate, endDate: filters.endDate })
      ) {
        continue
      }
      const date = order.dateCreated.slice(0, 10)
      const bucket = getBucket(date)
      const cogs = order.items.reduce((sum, item) => {
        const product = findProductByOrderItem({ id: item.id, title: item.title, sku: item.sku })
        return sum + (product?.unitCost ?? 0) * Math.max(0, item.quantity)
      }, 0)
      const fees = Math.max(0, order.mlFeeAmount)
      const shipping = Math.max(0, order.shippingCostAmount)
      const taxes = Math.max(0, order.taxesAmount)
      const fulfillment = order.items.reduce((sum, item) => {
        const product = findProductByOrderItem({ id: item.id, title: item.title, sku: item.sku })
        return sum + centralizeFulfillmentCostForItem(product, item.quantity, item.title)
      }, 0)
      bucket.salesIncome += Math.max(0, order.totalAmount)
      bucket.cogs += cogs
      bucket.mlFees += fees
      bucket.shipping += shipping
      bucket.fulfillment += fulfillment
      bucket.taxes += taxes
      bucket.details.push(`ML #${order.id}: ${formatCurrency(order.totalAmount)}`)
    }

    for (const transaction of filteredTransactions) {
      if (!transactionIsManualAdjustment(transaction)) continue
      const bucket = getBucket(transaction.date)
      if (transaction.kind === "income") {
        bucket.manualIncome += transaction.amount
      } else if (transaction.payStatus !== "pending") {
        bucket.manualExpenses += transaction.amount
      }
      bucket.details.push(`${transaction.origin || "Manual"}: ${transaction.description}`)
    }

    for (const transaction of mpTransactionsInFilter) {
      const date = transaction.date.slice(0, 10)
      const bucket = getBucket(date)
      if (transaction.type === "credit") {
        bucket.mpReleases += transaction.amount
      } else {
        bucket.mpDebits += transaction.amount
      }
      bucket.details.push(`MP: ${transaction.description}`)
    }

    return Array.from(buckets.values())
      .map((row) => {
        const income = row.mpReleases
        const expense = row.mpDebits
        return {
          ...row,
          income,
          expense,
          net: income - expense,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [
    filteredTransactions,
    filters.endDate,
    filters.startDate,
    findProductByOrderItem,
    mlOrders,
    mpTransactionsInFilter,
    period,
  ])
  const salesEvolution = useMemo(() => {
    const options = {
      period: "day" as FinancialPeriod,
      range: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    }
    if (hasOrdersFinancialData) {
      return buildOrdersSalesEvolutionData(
        mlOrders,
        productMapByMlItemId,
        options,
        findProductByOrderItem,
      )
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
    findProductByOrderItem,
  ])
  const salesInFilterFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.grossRevenue
    : salesInFilter
  const expensesInFilterFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.totalCosts
    : expensesInFilter
  const financeCostsInFilterFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.totalCosts + expensesInFilter
    : expensesInFilter
  const operatingResultFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.netProfit
    : operatingResult
  const financeOperatingResultFinal = salesInFilterFinal - financeCostsInFilterFinal
  const soldItemsFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.soldItems
    : soldUnitsInFilter
  const salesCountFinal = hasOrdersFinancialData
    ? ordersFinancialSummary.ordersCount
    : salesCountInFilter
  const financeOperatingMarginFinal =
    salesInFilterFinal > 0 ? (financeOperatingResultFinal / salesInFilterFinal) * 100 : 0
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
  const homeMarginFinal = salesInFilterFinal > 0 ? (homeNetProfit / salesInFilterFinal) * 100 : 0
  const homePeriodLabel = useMemo(() => {
    if (filters.startDate && filters.endDate) {
      return `${formatDate(filters.startDate)} – ${formatDate(filters.endDate)}`
    }
    return "Periodo atual"
  }, [filters.endDate, filters.startDate])
  const financeCostDetailGroups = useMemo<CostDetailGroup[]>(() => {
    const groups: CostDetailGroup[] = []
    const orderGroups = new Map<string, CostDetailGroup>()
    const ensureOrderGroup = (label: string) => {
      const current = orderGroups.get(label)
      if (current) return current
      const next: CostDetailGroup = { label, total: 0, target: "orders", items: [] }
      orderGroups.set(label, next)
      groups.push(next)
      return next
    }

    if (hasOrdersFinancialData) {
      for (const order of mlOrders) {
        if (
          !isValidMarketplaceOrder(order) ||
          !orderInRange(order, { startDate: filters.startDate, endDate: filters.endDate })
        ) {
          continue
        }
        const orderLabel = `Pedido ML #${order.id}`
        const itemSummary =
          order.items.length === 1
            ? order.items[0]?.title
            : `${order.items.length} item(ns) no pedido`
        const productCost = order.items.reduce((sum, item) => {
          const mappedProduct = findProductByOrderItem({
            id: item.id,
            title: item.title,
            sku: item.sku,
          })
          return sum + (mappedProduct?.unitCost ?? 0) * Math.max(0, item.quantity)
        }, 0)
        const orderDetails = [
          {
            group: "Produtos",
            value: productCost,
            detail: itemSummary,
          },
          {
            group: "Taxas ML",
            value: Math.max(0, order.mlFeeAmount),
            detail: order.paymentMethod || itemSummary,
          },
          {
            group: "Frete ML",
            value: Math.max(0, order.shippingCostAmount),
            detail: `${order.shippingMode || "Envio"} · ${order.shippingLogisticType || "logistica"}`,
          },
          {
            group: "Centralize (envio + embalagem)",
            value: order.items.reduce((sum, item) => {
              const mappedProduct = findProductByOrderItem({
                id: item.id,
                title: item.title,
                sku: item.sku,
              })
              return (
                sum + centralizeFulfillmentCostForItem(mappedProduct, item.quantity, item.title)
              )
            }, 0),
            detail: `Embalagem padrao ${formatCurrency(HUB_CENTRALIZE_PACKAGING_PER_ITEM)}; Multiprocessador ${formatCurrency(HUB_CENTRALIZE_MULTIPROCESSADOR_PACKAGING_PER_ITEM)}`,
          },
          {
            group: "Impostos",
            value: Math.max(0, order.taxesAmount),
            detail: itemSummary,
          },
        ]

        for (const detail of orderDetails) {
          if (detail.value <= 0) continue
          const group = ensureOrderGroup(detail.group)
          group.total += detail.value
          group.items.push({
            label: orderLabel,
            value: detail.value,
            detail: detail.detail,
          })
        }
      }
    }

    const manualExpenses = filteredTransactions.filter(
      (transaction) => transaction.kind === "expense",
    )
    const manualGroups = new Map<string, CostDetailGroup>()
    for (const transaction of manualExpenses) {
      const categoryName = categoryMap.get(transaction.categoryId)?.name ?? "Sem categoria"
      const label =
        transaction.expenseType === "fixed"
          ? `Fixo · ${categoryName}`
          : `Operacional · ${categoryName}`
      const current = manualGroups.get(label) ?? {
        label,
        total: 0,
        target: "history" as const,
        items: [],
      }
      current.total += transaction.amount
      current.items.push({
        label: transaction.description,
        value: transaction.amount,
        detail: `${formatDate(transaction.date)}${transaction.origin ? ` · ${transaction.origin}` : ""}`,
      })
      manualGroups.set(label, current)
    }
    groups.push(...manualGroups.values())

    return groups
      .filter((group) => group.total > 0)
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.total - a.total)
  }, [
    categoryMap,
    filteredTransactions,
    filters.endDate,
    filters.startDate,
    findProductByOrderItem,
    hasOrdersFinancialData,
    mlOrders,
  ])
  const financeInsightDetailGroups = useMemo<
    Record<FinanceInsightKey, FinanceInsightDetailGroup[]>
  >(() => {
    const validOrders = mlOrders.filter(
      (order) =>
        isValidMarketplaceOrder(order) &&
        orderInRange(order, { startDate: filters.startDate, endDate: filters.endDate }),
    )
    const manualIncomeTransactions = filteredTransactions.filter(
      (transaction) => transaction.kind === "income" && transactionIsManualAdjustment(transaction),
    )
    const mlRevenueItems = validOrders.map((order) => ({
      label: `Pedido ML #${order.id}`,
      value: Math.max(0, order.totalAmount),
      detail: order.items.map((item) => item.title).join(", ") || order.paymentMethod,
    }))
    const manualIncomeItems = manualIncomeTransactions.map((transaction) => ({
      label: transaction.description,
      value: transaction.amount,
      detail: transaction.origin || formatDate(transaction.date),
    }))
    const salesItems = validOrders.map((order) => ({
      label: `Pedido ML #${order.id}`,
      value: 1,
      format: "number" as const,
      detail: `${order.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)} item(ns) · ${formatCurrency(order.totalAmount)}`,
    }))
    const itemVolumeRows = validOrders.flatMap((order) =>
      order.items.map((item) => ({
        label: item.title,
        value: Math.max(0, item.quantity),
        format: "number" as const,
        detail: `Pedido ML #${order.id}`,
      })),
    )

    return {
      profit: [
        {
          label: "Faturamento",
          total: salesInFilterFinal,
          target: "orders",
          items: mlRevenueItems,
        },
        {
          label: "Custos",
          total: financeCostsInFilterFinal,
          target: "orders",
          items: financeCostDetailGroups.flatMap((group) =>
            group.items.map((item) => ({
              label: `${group.label} · ${item.label}`,
              value: item.value,
              detail: item.detail,
            })),
          ),
        },
        {
          label: "Lucro",
          total: financeOperatingResultFinal,
          items: [
            {
              label: "Faturamento - custos",
              value: financeOperatingResultFinal,
              detail: `${formatCurrency(salesInFilterFinal)} - ${formatCurrency(financeCostsInFilterFinal)}`,
            },
          ],
        },
      ],
      revenue: [
        {
          label: "Pedidos Mercado Livre",
          total: ordersFinancialSummary.grossRevenue,
          target: "orders",
          items: mlRevenueItems,
        },
        {
          label: "Entradas manuais",
          total: manualIncomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
          target: "history",
          items: manualIncomeItems,
        },
      ],
      costs: financeCostDetailGroups,
      sales: [
        {
          label: "Pedidos",
          total: salesCountFinal,
          format: "number",
          target: "orders",
          items: salesItems,
        },
        {
          label: "Itens vendidos",
          total: soldItemsFinal,
          format: "number",
          target: "orders",
          items: itemVolumeRows,
        },
      ],
      margin: [
        {
          label: "Margem operacional",
          total: financeOperatingMarginFinal,
          format: "percent",
          items: [
            {
              label: "Lucro / faturamento",
              value: financeOperatingMarginFinal,
              format: "percent",
              detail: `${formatCurrency(financeOperatingResultFinal)} / ${formatCurrency(salesInFilterFinal)}`,
            },
          ],
        },
        {
          label: "Lucro",
          total: financeOperatingResultFinal,
          items: [{ label: "Resultado no periodo", value: financeOperatingResultFinal }],
        },
      ],
      ticket: [
        {
          label: "Ticket medio",
          total: ticketMedioFinal,
          items: [
            {
              label: "Faturamento / vendas",
              value: ticketMedioFinal,
              detail: `${formatCurrency(salesInFilterFinal)} / ${salesCountFinal || 0} venda(s)`,
            },
          ],
        },
        {
          label: "Pedidos considerados",
          total: salesCountFinal,
          format: "number",
          target: "orders",
          items: salesItems,
        },
      ],
    }
  }, [
    filteredTransactions,
    filters.endDate,
    filters.startDate,
    financeCostDetailGroups,
    financeCostsInFilterFinal,
    financeOperatingMarginFinal,
    financeOperatingResultFinal,
    mlOrders,
    ordersFinancialSummary.grossRevenue,
    salesCountFinal,
    salesInFilterFinal,
    soldItemsFinal,
    ticketMedioFinal,
  ])
  const productsWithoutCost = useMemo(
    () => products.filter((product) => product.unitCost <= 0),
    [products],
  )
  const ordersWithoutProductLink = useMemo(() => {
    return mlOrders
      .filter(
        (order) =>
          isValidMarketplaceOrder(order) &&
          orderInRange(order, { startDate: filters.startDate, endDate: filters.endDate }) &&
          order.items.some(
            (item) =>
              !findProductByOrderItem({
                id: item.id,
                title: item.title,
                sku: item.sku,
              }),
          ),
      )
      .slice(0, 8)
  }, [filters.endDate, filters.startDate, findProductByOrderItem, mlOrders])
  const upcomingCommitments = useMemo(() => {
    const now = new Date(`${today}T00:00:00`)
    const limit = new Date(now)
    limit.setDate(limit.getDate() + 30)
    const limitIso = limit.toISOString().slice(0, 10)
    const rows: Array<{
      id: string
      title: string
      amount: number
      dueDate: string
      source: string
      overdue: boolean
    }> = []

    for (const bill of bills) {
      if (bill.kind !== "payable" || bill.status === "paid") continue
      if (bill.dueDate > limitIso) continue
      rows.push({
        id: `bill-${bill.id}`,
        title: bill.title,
        amount: bill.amount,
        dueDate: bill.dueDate,
        source: "Conta",
        overdue: bill.dueDate < today || bill.status === "overdue",
      })
    }

    for (const transaction of transactions) {
      const dueDate =
        transaction.paymentMethod === "credit" && transaction.installmentIndex
          ? firstDayOfIsoMonth(transaction.date)
          : transaction.date

      if (
        transaction.kind !== "expense" ||
        transaction.payStatus !== "pending" ||
        dueDate > limitIso
      ) {
        continue
      }
      rows.push({
        id: `tx-${transaction.id}`,
        title: transaction.description,
        amount: transaction.amount,
        dueDate,
        source:
          transaction.paymentMethod === "credit" && transaction.installmentIndex
            ? `Cartao ${transaction.installmentIndex}/${transaction.installmentCount ?? "?"}`
            : transaction.paymentMethod
              ? transaction.paymentMethod.toUpperCase()
              : "Pendente",
        overdue: dueDate < today,
      })
    }

    const items = rows.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return a.dueDate.localeCompare(b.dueDate)
    })

    return {
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      overdueCount: items.filter((item) => item.overdue).length,
    }
  }, [bills, transactions])
  const partnerDistributionPreview = useMemo(() => {
    const distributableBase = Math.max(0, homeNetProfit)
    const reinvestment = distributableBase * 0.7
    const distributable = distributableBase * 0.3
    return {
      base: distributableBase,
      reinvestment,
      distributable,
      partnerShare: distributable / 2,
    }
  }, [homeNetProfit])
  const technologyHealth = useMemo(() => {
    const disconnected = [
      !mlConnectionStatus?.connected ? "Mercado Livre" : null,
      !mpConnectionStatus?.connected ? "Mercado Pago" : null,
    ].filter(Boolean)
    return {
      disconnected,
      connectedCount: 2 - disconnected.length,
      totalCount: 2,
      ok: disconnected.length === 0,
    }
  }, [mlConnectionStatus?.connected, mpConnectionStatus?.connected])
  const homeActionItems = useMemo<HomeActionItem[]>(() => {
    const items: HomeActionItem[] = []
    if (upcomingCommitments.overdueCount > 0 || upcomingCommitments.items.length > 0) {
      items.push({
        title:
          upcomingCommitments.overdueCount > 0
            ? `${upcomingCommitments.overdueCount} vencimento(s) atrasado(s)`
            : `${upcomingCommitments.items.length} compromisso(s) a vencer`,
        description: `${formatCurrency(upcomingCommitments.total)} nos proximos 30 dias`,
        tone: upcomingCommitments.overdueCount > 0 ? "danger" : "warning",
        icon: CalendarDays,
        onClick: () => {
          setActiveModule("finance")
          setActiveFinanceSection("history")
          setHistoryKindFilter("expense")
        },
      })
    }
    if (productsWithoutCost.length > 0) {
      items.push({
        title: `${productsWithoutCost.length} produto(s) sem custo`,
        description: "Cadastre custo para margem, lucro e ABC ficarem confiaveis.",
        tone: "danger",
        icon: Tag,
        onClick: () => {
          setActiveModule("stock")
          setActiveStockSection("overview")
        },
      })
    }
    if (ordersWithoutProductLink.length > 0) {
      items.push({
        title: `${ordersWithoutProductLink.length} pedido(s) ML sem vinculo`,
        description: "Vincule os itens ao estoque para calcular CMV automaticamente.",
        tone: "warning",
        icon: ShoppingBag,
        onClick: () => {
          setActiveModule("mercadolivre")
          setActiveMlSidebarGroup("pedidos")
          setActiveMlSection("orders")
        },
      })
    }
    if (stockSummary.lowStockCount > 0) {
      items.push({
        title: `${stockSummary.lowStockCount} produto(s) abaixo do minimo`,
        description: "Revise reposicao antes de perder venda.",
        tone: "warning",
        icon: AlertCircle,
        onClick: () => {
          setActiveModule("stock")
          setActiveStockSection("overview")
        },
      })
    }
    if (!technologyHealth.ok) {
      items.push({
        title: `${technologyHealth.disconnected.length} integracao(oes) pendente(s)`,
        description: technologyHealth.disconnected.join(", "),
        tone: "info",
        icon: Settings,
        onClick: () => setActiveModule("connections"),
      })
    }
    if (items.length === 0) {
      items.push({
        title: "Operacao sem alertas criticos",
        description: "Estoque, financeiro e integracoes sem pendencias prioritarias.",
        tone: "success",
        icon: CheckCircle2,
        onClick: () => setActiveModule("home"),
      })
    }
    return items.slice(0, 6)
  }, [
    ordersWithoutProductLink.length,
    productsWithoutCost.length,
    stockSummary.lowStockCount,
    technologyHealth,
    upcomingCommitments,
  ])
  const syncStatusByProvider = useMemo(
    () => new Map(externalSyncStatuses.map((status) => [status.provider, status])),
    [externalSyncStatuses],
  )
  const fullStockProducts = useMemo(
    () =>
      products.filter(
        (product) => product.stockSource === "ml_full" || product.kanbanStatus === "fulfillment",
      ),
    [products],
  )
  const stockDivergenceSignals = useMemo(() => {
    const mlFullByItem = new Map(
      mlPlainListings
        .filter((listing) => listing.logisticType === "fulfillment")
        .map((listing) => [normalizeMercadoLibreItemId(listing.id), listing]),
    )

    return fullStockProducts.filter((product) => {
      const mlItemId = product.mlItemId ? normalizeMercadoLibreItemId(product.mlItemId) : ""
      const listing = mlItemId ? mlFullByItem.get(mlItemId) : undefined
      return listing ? listing.available_quantity !== product.quantity : false
    })
  }, [fullStockProducts, mlPlainListings])
  const listingsWithoutSku = useMemo(
    () => mlPlainListings.filter((listing) => !listing.sku?.trim()),
    [mlPlainListings],
  )
  const dataQualityIssues = useMemo(
    () => [
      {
        title: "Produtos sem custo",
        count: productsWithoutCost.length,
        description: "Margem, DRE e ABC dependem deste custo.",
        tone: productsWithoutCost.length > 0 ? "danger" : "success",
        action: () => {
          setActiveModule("stock")
          setActiveStockSection("overview")
        },
      },
      {
        title: "Pedidos ML sem vinculo",
        count: ordersWithoutProductLink.length,
        description: "Itens vendidos sem produto encontrado no estoque.",
        tone: ordersWithoutProductLink.length > 0 ? "warning" : "success",
        action: () => {
          setActiveModule("mercadolivre")
          setActiveMlSidebarGroup("pedidos")
          setActiveMlSection("orders")
        },
      },
      {
        title: "Anuncios sem SKU",
        count: listingsWithoutSku.length,
        description:
          mlPlainListings.length > 0
            ? "Amostra carregada dos anuncios ML."
            : "Carregue anuncios para validar.",
        tone: listingsWithoutSku.length > 0 ? "warning" : "success",
        action: () => {
          setActiveModule("mercadolivre")
          setActiveMlSidebarGroup("anuncios")
          setActiveMlSection("anuncios")
        },
      },
      {
        title: "Full divergente",
        count: stockDivergenceSignals.length,
        description: "Comparacao entre estoque Convex e quantidade ML carregada.",
        tone: stockDivergenceSignals.length > 0 ? "danger" : "success",
        action: () => {
          setActiveModule("stock")
          setActiveStockSection("overview")
        },
      },
    ],
    [
      listingsWithoutSku.length,
      mlPlainListings.length,
      ordersWithoutProductLink.length,
      productsWithoutCost.length,
      stockDivergenceSignals.length,
    ],
  )
  const technologyAlertCount = dataQualityIssues.reduce(
    (total, issue) => total + (issue.tone === "success" ? 0 : issue.count || 1),
    technologyHealth.ok ? 0 : technologyHealth.disconnected.length,
  )
  const lastWebhookStatus = "Sem historico persistido"
  const stockSyncStatus = syncStatusByProvider.get("stock")
  const mpSyncProviderStatus = syncStatusByProvider.get("mercado_pago")
  const allSyncStatus = syncStatusByProvider.get("all")
  const financeInsightRows = useMemo(() => {
    const rowsByInsight: Record<
      FinanceInsightKey,
      {
        title: string
        description: string
        rows: { label: string; value: number; tone?: "income" | "expense" | "neutral" }[]
      }
    > = {
      profit: {
        title: "Formacao do lucro",
        description: `Resultado no periodo ${homePeriodLabel}`,
        rows: [
          { label: "Faturamento", value: salesInFilterFinal, tone: "income" },
          { label: "Custos", value: financeCostsInFilterFinal, tone: "expense" },
          { label: "Lucro", value: financeOperatingResultFinal, tone: "neutral" },
        ],
      },
      revenue: {
        title: "Origem do faturamento",
        description: `${salesCountFinal} venda(s) confirmada(s) no filtro`,
        rows: hasOrdersFinancialData
          ? [
              {
                label: "Pedidos Mercado Livre",
                value: ordersFinancialSummary.grossRevenue,
                tone: "income",
              },
              { label: "Entradas manuais", value: summary.income, tone: "income" },
            ]
          : [
              { label: "Vendas online", value: salesInFilter, tone: "income" },
              {
                label: "Outras entradas",
                value: Math.max(0, summary.income - salesInFilter),
                tone: "income",
              },
            ],
      },
      costs: {
        title: "Composicao dos custos",
        description: `Pedidos ML + despesas manuais no periodo: ${formatCurrency(financeCostsInFilterFinal)}`,
        rows: financeCostDetailGroups.map((row) => ({
          label: row.label,
          value: row.total,
          tone: "expense" as const,
        })),
      },
      sales: {
        title: "Volume de vendas",
        description: `${soldItemsFinal} item(ns) vendido(s)`,
        rows: [
          { label: "Vendas", value: salesCountFinal, tone: "neutral" },
          { label: "Itens vendidos", value: soldItemsFinal, tone: "neutral" },
        ],
      },
      margin: {
        title: "Margem do periodo",
        description: `${financeOperatingMarginFinal.toFixed(1)}% de lucro sobre faturamento`,
        rows: [
          { label: "Lucro", value: financeOperatingResultFinal, tone: "income" },
          { label: "Custos", value: financeCostsInFilterFinal, tone: "expense" },
          { label: "Faturamento", value: salesInFilterFinal, tone: "neutral" },
        ],
      },
      ticket: {
        title: "Ticket medio",
        description: `${salesCountFinal} venda(s) consideradas no calculo`,
        rows: [
          { label: "Faturamento", value: salesInFilterFinal, tone: "income" },
          { label: "Vendas", value: salesCountFinal, tone: "neutral" },
          { label: "Ticket medio", value: ticketMedioFinal, tone: "neutral" },
        ],
      },
    }

    return rowsByInsight[activeFinanceInsight]
  }, [
    activeFinanceInsight,
    financeCostDetailGroups,
    financeCostsInFilterFinal,
    financeOperatingMarginFinal,
    financeOperatingResultFinal,
    hasOrdersFinancialData,
    homePeriodLabel,
    ordersFinancialSummary.grossRevenue,
    salesCountFinal,
    salesInFilter,
    salesInFilterFinal,
    soldItemsFinal,
    summary.income,
    ticketMedioFinal,
  ])
  const openFinanceInsight = useCallback((insight: FinanceInsightKey) => {
    setActiveFinanceInsight(insight)
    setFinanceInsightModalOpen(true)
  }, [])

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
          imageUrl: r.imageUrl,
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
      const s = buildOrdersFinancialSummary(
        mlOrders,
        productMapByMlItemId,
        {
          startDate: start,
          endDate: end,
        },
        findProductByOrderItem,
      )
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
    findProductByOrderItem,
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

  /** Anuncios tradicionais ML (`catalog_listing` false), par do anuncio de vitrine de catalogo. */
  const mlNormalListingsFiltered = useMemo(
    () => mlPlainListings.filter(isMlClassicListingRow),
    [mlPlainListings],
  )

  const exportCatalogCompetitionCsv = () => {
    const header = [
      "item_id",
      "titulo",
      "status_competicao",
      "preco_atual",
      "preco_vencedor",
      "diferenca",
      "custo_unitario_estoque",
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
        centralizePackagingPerItem(product, row.title)
      return [
        row.itemId,
        row.title.replace(/"/g, '""'),
        row.competitionStatus,
        row.price.toFixed(2),
        row.winnerPrice?.toFixed(2) ?? "",
        diff.toFixed(2),
        unitCost.toFixed(2),
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
    return buildAbcRowsFromOrders(
      mlOrders,
      productMapByMlItemId,
      productMapBySku,
      financeAbcMetric,
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    )
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
  const topProductRows = useMemo(
    () =>
      dedupeTopProductRows(
        buildTopProductRows({
          abcRows: abcRowsFiltered,
          products,
          rangeDays,
        }),
      ),
    [abcRowsFiltered, products, rangeDays],
  )
  const highVelocityThreshold = useMemo(() => {
    if (topProductRows.length === 0) return 0
    return Math.max(
      1,
      topProductRows.reduce((sum, row) => sum + row.velocity, 0) / topProductRows.length,
    )
  }, [topProductRows])
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
      { label: "(-) Custo dos Produtos", value: -dreSnapshot.productCosts },
      {
        label: "(-) Custos Centralize (envio R$ 5/item + embalagem por produto)",
        value: -dreSnapshot.fulfillmentCost,
      },
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
      !productForm.mlItemId.trim() ||
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
        mlItemId: productForm.mlItemId,
        category: productForm.category,
        quantity,
        minStock,
        unitCost,
        sellingPrice,
        ...(productFormImageUrl?.trim() ? { imageUrl: productFormImageUrl.trim() } : {}),
      })

      setProductForm({
        name: "",
        mlItemId: "",
        category: "",
        quantity: "",
        minStock: "",
        unitCost: "",
        sellingPrice: "",
      })
      setProductFormImageUrl(undefined)
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
      mlItemId: product.mlItemId ?? product.sku,
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
      !productEditForm.mlItemId.trim() ||
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
      let resolvedKanban = current?.kanbanStatus ?? (quantity > 0 ? "in_stock" : "purchased")
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
        mlItemId: productEditForm.mlItemId,
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

  const openMlCatalogStockEdit = useCallback(
    (row: MlListingStockEditSource) => {
      setMlCatalogStockEditRow(row)
      setMlCatalogStockEditError(null)
      const linked = productMapByMlItemId.get(normalizeMercadoLibreItemId(row.itemId))
      if (linked) {
        setMlCatalogStockEditProductId(linked.id as Id<"stockProducts">)
        setMlCatalogStockEditSuggestion(null)
        setMlCatalogStockForm({
          name: linked.name,
          mlItemId: linked.mlItemId ?? linked.sku,
          category: linked.category,
          quantity: String(linked.quantity),
          minStock: String(linked.minStock),
          unitCost: String(linked.unitCost),
          sellingPrice: linked.sellingPrice ? String(linked.sellingPrice) : "",
        })
        setMlCatalogStockDialogOpen(true)
        return
      }

      const sug = suggestUnitCostFromInventory({
        sellerSku: row.sellerSku,
        listingTitle: row.title,
        products: productCostLookups,
      })
      setMlCatalogStockEditSuggestion(sug)

      if (sug.matchedProductId) {
        const matched = products.find((p) => p.id === sug.matchedProductId)
        if (matched) {
          setMlCatalogStockEditProductId(matched.id as Id<"stockProducts">)
          const costHint =
            sug.suggestedCost !== null && sug.suggestedCost > 0
              ? sug.suggestedCost
              : matched.unitCost
          setMlCatalogStockForm({
            name: matched.name,
            mlItemId: matched.mlItemId ?? matched.sku,
            category: matched.category,
            quantity: String(matched.quantity),
            minStock: String(matched.minStock),
            unitCost: String(costHint),
            sellingPrice: matched.sellingPrice ? String(matched.sellingPrice) : String(row.price),
          })
          setMlCatalogStockDialogOpen(true)
          return
        }
      }

      const defaultMlId = row.itemId.replace(/^MLB-?/i, "MLB")

      setMlCatalogStockEditProductId(null)
      setMlCatalogStockForm({
        name: row.title,
        mlItemId: defaultMlId,
        category: "Mercado Livre",
        quantity: String(Math.max(0, row.availableQuantity)),
        minStock: "0",
        unitCost:
          sug.suggestedCost !== null && sug.suggestedCost !== undefined
            ? String(sug.suggestedCost)
            : "",
        sellingPrice: String(row.price),
      })
      setMlCatalogStockDialogOpen(true)
    },
    [productCostLookups, productMapByMlItemId, products],
  )

  const saveMlCatalogStockEdit = async () => {
    if (!userId || !mlCatalogStockEditRow) return
    const row = mlCatalogStockEditRow
    if (
      !mlCatalogStockForm.name.trim() ||
      !mlCatalogStockForm.mlItemId.trim() ||
      !mlCatalogStockForm.category.trim() ||
      mlCatalogStockForm.quantity === "" ||
      mlCatalogStockForm.minStock === "" ||
      mlCatalogStockForm.unitCost === ""
    ) {
      setMlCatalogStockEditError("Preencha nome, MLB ID, categoria e custo.")
      return
    }

    const quantity = Number(mlCatalogStockForm.quantity)
    const minStock = Number(mlCatalogStockForm.minStock)
    const unitCost = Number(mlCatalogStockForm.unitCost)
    const sellingPrice = mlCatalogStockForm.sellingPrice
      ? Number(mlCatalogStockForm.sellingPrice)
      : undefined

    if (
      Number.isNaN(quantity) ||
      Number.isNaN(minStock) ||
      Number.isNaN(unitCost) ||
      (mlCatalogStockForm.sellingPrice && Number.isNaN(sellingPrice))
    ) {
      setMlCatalogStockEditError("Use apenas numeros validos nos campos numericos.")
      return
    }

    setMlCatalogStockEditSaving(true)
    setMlCatalogStockEditError(null)

    try {
      if (mlCatalogStockEditProductId) {
        const current = products.find((pr) => pr.id === mlCatalogStockEditProductId)
        let resolvedKanban = current?.kanbanStatus ?? (quantity > 0 ? "in_stock" : "purchased")
        if (current && current.quantity > 0 && quantity === 0) {
          resolvedKanban = "in_stock"
        }
        if (current && current.quantity > 0 && quantity === 0) {
          await applyKanbanMoveMutation({
            userId,
            productId: mlCatalogStockEditProductId,
            target: "em_falta",
          })
        }
        await updateProduct({
          userId,
          productId: mlCatalogStockEditProductId,
          name: mlCatalogStockForm.name,
          category: mlCatalogStockForm.category,
          quantity,
          minStock,
          unitCost,
          sellingPrice,
          kanbanStatus: resolvedKanban,
          kanbanNote: current?.kanbanNote,
          estimatedArrival: current?.estimatedArrival,
          mlItemId: normalizeMercadoLibreItemId(row.itemId),
        })
      } else {
        await addProduct({
          userId,
          name: mlCatalogStockForm.name,
          category: mlCatalogStockForm.category,
          quantity,
          minStock,
          unitCost,
          sellingPrice,
          mlItemId: normalizeMercadoLibreItemId(row.itemId),
          ...(row.thumbnail?.startsWith("http") ? { imageUrl: row.thumbnail } : {}),
        })
      }

      setMlCatalogStockDialogOpen(false)
      setMlCatalogStockEditRow(null)
      setMlCatalogStockEditProductId(null)
      setMlCatalogStockEditSuggestion(null)
      setProductFeedback({
        type: "success",
        message:
          "Estoque atualizado com vinculo ao anuncio ML; custos passam a valer em DRE e pedidos.",
      })
    } catch (error) {
      setMlCatalogStockEditError(
        error instanceof Error ? error.message : "Nao foi possivel salvar o produto.",
      )
    } finally {
      setMlCatalogStockEditSaving(false)
    }
  }

  const handleKanbanUpdateStatus = async (
    productId: string,
    target: KanbanColumnId,
    note?: string,
    estimatedArrival?: string,
    kanbanCardId?: string,
  ) => {
    if (!userId) return
    try {
      await applyKanbanMoveMutation({
        userId,
        productId: productId as Id<"stockProducts">,
        ...(kanbanCardId !== undefined && {
          kanbanCardId: kanbanCardId as Id<"stockKanbanCards">,
        }),
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

  const handleKanbanColumnOrderChange = async (columnOrder: string[]) => {
    if (!userId) return
    try {
      await saveKanbanColumnOrder({ userId, columnOrder })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Nao foi possivel salvar a ordem das colunas.",
      })
    }
  }

  const handleKanbanSaveEdits = async (
    productId: string,
    updates: Partial<KanbanProduct>,
    kanbanCardId?: string,
  ) => {
    if (!userId) return
    const p = products.find((x) => x.id === productId)
    if (!p) return
    const nextQty = updates.quantity ?? p.quantity
    const nextUnitCost = updates.unitCost ?? p.unitCost
    let resolvedKanban =
      updates.kanbanStatus ?? p.kanbanStatus ?? (nextQty > 0 ? "in_stock" : "purchased")
    if (p.quantity > 0 && nextQty === 0) {
      resolvedKanban = "in_stock"
    }
    try {
      if (kanbanCardId !== undefined) {
        await updateKanbanCard({
          userId,
          kanbanCardId: kanbanCardId as Id<"stockKanbanCards">,
          ...(updates.quantity !== undefined && { quantity: updates.quantity }),
          ...(updates.kanbanStatus !== undefined && { kanbanStatus: updates.kanbanStatus }),
          ...(updates.kanbanNote !== undefined && { note: updates.kanbanNote }),
          ...(updates.estimatedArrival !== undefined && {
            estimatedArrival: updates.estimatedArrival,
          }),
        })
      } else if (p.quantity > 0 && nextQty === 0) {
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
        category: p.category,
        quantity: kanbanCardId !== undefined ? p.quantity : nextQty,
        minStock: updates.minStock ?? p.minStock,
        unitCost: nextUnitCost,
        sellingPrice: p.sellingPrice,
        kanbanStatus: kanbanCardId !== undefined ? p.kanbanStatus : resolvedKanban,
        kanbanNote:
          kanbanCardId !== undefined
            ? p.kanbanNote
            : updates.kanbanNote !== undefined
              ? updates.kanbanNote
              : p.kanbanNote,
        estimatedArrival:
          kanbanCardId !== undefined
            ? p.estimatedArrival
            : updates.estimatedArrival !== undefined
              ? updates.estimatedArrival
              : p.estimatedArrival,
        ...(updates.mlItemId !== undefined && { mlItemId: updates.mlItemId }),
        ...(updates.mlItemAliases !== undefined && { mlItemAliases: updates.mlItemAliases }),
      })
      setProductFeedback({ type: "success", message: "Produto atualizado com sucesso." })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar o produto.",
      })
    }
  }

  const handleKanbanDelete = async (productId: string, kanbanCardId?: string) => {
    if (kanbanCardId && userId) {
      try {
        await deleteKanbanCard({
          userId,
          kanbanCardId: kanbanCardId as Id<"stockKanbanCards">,
        })
        setProductFeedback({ type: "success", message: "Card removido do Kanban." })
      } catch (error) {
        setProductFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Nao foi possivel remover o card.",
        })
      }
      return
    }
    const p = products.find((x) => x.id === productId)
    if (p) await removeProduct(p)
  }

  const handleAddKanbanCard = async (
    productId: string,
    target: KanbanColumnId,
    quantity: number,
    note?: string,
    estimatedArrival?: string,
  ) => {
    if (!userId || target === "em_falta") return
    try {
      await addKanbanCard({
        userId,
        productId: productId as Id<"stockProducts">,
        kanbanStatus: target,
        quantity,
        ...(note !== undefined && { note }),
        ...(estimatedArrival !== undefined && { estimatedArrival }),
      })
      setProductFeedback({ type: "success", message: "Card extra criado no Kanban." })
    } catch (error) {
      setProductFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel criar o card.",
      })
    }
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
        mlItemId: manualStockForm.mlItemId.trim(),
        quantity: qty,
        unitCost: cost,
        supplier: manualStockForm.supplier.trim(),
        manualEntryDate: manualStockForm.manualEntryDate,
        location: manualStockForm.location,
        estimatedArrival: manualStockForm.estimatedArrival || undefined,
        observations: manualStockForm.observations || undefined,
        ...(manualStockImageUrl?.trim() ? { imageUrl: manualStockImageUrl.trim() } : {}),
      })
      setManualStockForm({
        name: "",
        mlItemId: "",
        quantity: "",
        unitCost: "",
        supplier: "",
        manualEntryDate: today,
        location: "in_stock_physical",
        estimatedArrival: "",
        observations: "",
      })
      setManualStockImageUrl(undefined)
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

  const exportStockHistory = useCallback(() => {
    exportStockMovementHistoryToCsv(movements, productMap)
  }, [movements, productMap])

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
      setMlPlainListings([])
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

  /** `withRows`: preenche a lista para a aba Anuncios; senao so atualiza o total do hub. */
  const loadMlListings = async (withRows: boolean) => {
    setMlError(null)
    setMlListingsLoading(true)
    try {
      const response = await fetch("/api/ml/listings?limit=50&offset=0", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar anuncios.")
      }
      const listings = (payload.data.listings ?? []) as MlListing[]
      setMlListingsCount(payload.data.total ?? 0)
      if (withRows) setMlPlainListings(listings)
    } catch (error) {
      setMlError(error instanceof Error ? error.message : "Erro ao buscar anuncios.")
    } finally {
      setMlListingsLoading(false)
    }
  }

  const normalizeMlOrders = (rawOrders: MlOrder[]) =>
    rawOrders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        id: item.id ? normalizeMercadoLibreItemId(item.id) : "",
      })),
    }))

  const loadMlOrders = async (range?: { startDate?: string; endDate?: string }) => {
    setMlError(null)
    setMlOrdersLoading(true)
    try {
      const params = new URLSearchParams({ all: "1" })
      if (range?.startDate) params.set("startDate", range.startDate)
      if (range?.endDate) params.set("endDate", range.endDate)
      const response = await fetch(`/api/ml/orders?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao buscar pedidos.")
      }
      setMlOrdersCount(payload.data.total ?? 0)
      const rawOrders = (payload.data.orders ?? []) as MlOrder[]
      setMlOrders(normalizeMlOrders(rawOrders))
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

  const openOrderCostAnalysis = (
    order: MlOrder,
    product: Pick<StockProduct, "name" | "unitCost"> | undefined,
    quantity: number,
    title = "",
  ) => {
    const revenueTotal = order.totalAmount
    const receivedAmount = order.totalPaidAmount
    const unitCost = product?.unitCost ?? 0
    const packagingPerItem = centralizePackagingPerItem(product, title || order.items[0]?.title)
    const productCost = Math.max(0, unitCost * quantity)
    const shippingCost = Math.max(0, order.shippingCostAmount)
    const centralizeShipping = Math.max(0, quantity * HUB_CENTRALIZE_SHIPPING_PER_ITEM)
    const centralizePackaging = Math.max(0, quantity * packagingPerItem)
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
      source: "ml_api",
    })
  }

  useEffect(() => {
    if (!isLoaded) return
    if (!userId) {
      mlAppBootstrapUserRef.current = null
      setMlConnectionStatus(null)
      return
    }
    if (mlAppBootstrapUserRef.current === userId) return

    mlAppBootstrapUserRef.current = userId
    let cancelled = false

    const bootstrapConnectedMlData = async () => {
      try {
        const connectionData = await loadMlConnectionStatus()
        if (cancelled) return
        if (!connectionData?.connected) return

        await Promise.allSettled([
          syncAllExternalData(false),
          loadMlOverviewCards(),
          loadMlOrders(),
          fetchMpData(),
          fetchFutureReleases(),
        ])
      } catch (error) {
        if (!cancelled) {
          setMlError(
            error instanceof Error ? error.message : "Erro ao atualizar dados do Mercado Livre.",
          )
        }
      }
    }

    void bootstrapConnectedMlData()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstraps once per authenticated user; loaders are invoked as a single startup refresh batch.
  }, [
    fetchFutureReleases,
    fetchMpData,
    isLoaded,
    loadMlConnectionStatus,
    syncAllExternalData,
    userId,
  ])

  useEffect(() => {
    if (!mlConnectionStatus?.connected) {
      mlCatalogTabBootstrapped.current = false
      mlAnunciosTabBootstrapped.current = false
      mlOrdersSectionBootstrapped.current = false
    }
    if (activeModule !== "mercadolivre" || !mlConnectionStatus?.connected) {
      return
    }

    if (activeMlSection !== "catalogo") {
      mlCatalogTabBootstrapped.current = false
    }
    if (activeMlSection !== "anuncios") {
      mlAnunciosTabBootstrapped.current = false
    }
    if (activeMlSection !== "orders") {
      mlOrdersSectionBootstrapped.current = false
    }

    if (activeMlSection === "catalogo") {
      if (!mlCatalogTabBootstrapped.current && !mlListingsLoading) {
        mlCatalogTabBootstrapped.current = true
        void loadMlListings(false)
        void loadMlCatalogCompetition()
      }
      return
    }
    if (activeMlSection === "anuncios") {
      if (!mlAnunciosTabBootstrapped.current && !mlListingsLoading) {
        mlAnunciosTabBootstrapped.current = true
        void loadMlListings(true)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrapping is controlled by section flags, not helper identity.
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
    if (activeMlSidebarGroup === "anuncios") setActiveMlSection("catalogo")
    if (activeMlSidebarGroup === "pedidos") setActiveMlSection("orders")
    if (activeMlSidebarGroup === "metricas") setActiveMlSection("metrics")
  }, [activeMlSidebarGroup])

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
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 p-2 sm:p-4 md:p-6">
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
          <Button
            size="sm"
            variant={activeModule === "connections" ? "default" : "outline"}
            onClick={() => setActiveModule("connections")}
          >
            <Settings className="size-4" />
            TI
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
              label="Ajustes"
              isActive={
                activeFinanceSection === "expenses" || activeFinanceSection === "categories"
              }
              onClick={() => setActiveFinanceSection("expenses")}
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
              <>
                <Button
                  variant={activeMlSection === "catalogo" ? "secondary" : "ghost"}
                  className="ml-7 justify-start"
                  onClick={() => setActiveMlSection("catalogo")}
                >
                  Catalogo
                </Button>
                <Button
                  variant={activeMlSection === "anuncios" ? "secondary" : "ghost"}
                  className="ml-7 justify-start"
                  onClick={() => setActiveMlSection("anuncios")}
                >
                  Anuncios
                </Button>
              </>
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

      <section className="min-w-0 flex-1 space-y-4">
        <div className="sticky top-0 z-30 -mx-2 space-y-3 border-b bg-background/95 px-2 py-3 backdrop-blur sm:-mx-4 sm:px-4 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Image
                src="/branch_logo.jpeg"
                alt="BranchHub logo"
                width={28}
                height={28}
                className="rounded-none object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">BranchHub</p>
                <p className="truncate text-xs text-muted-foreground">
                  {activeModule === "finance"
                    ? "Financeiro"
                    : activeModule === "stock"
                      ? "Estoque"
                      : activeModule === "mercadolivre"
                        ? "Mercado Livre"
                        : activeModule === "branchhunter"
                          ? "Branch Hunter"
                          : activeModule === "connections"
                            ? "TI & Integrações"
                            : "Home"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <UserButton />
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: "home" as const, label: "Home", icon: Home },
              { key: "finance" as const, label: "Financeiro", icon: Wallet },
              { key: "stock" as const, label: "Estoque", icon: Boxes },
              { key: "mercadolivre" as const, label: "ML", icon: Store },
              { key: "branchhunter" as const, label: "Hunter", icon: Search },
              { key: "connections" as const, label: "TI", icon: Settings },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={activeModule === item.key ? "default" : "outline"}
                  className="h-9 shrink-0 px-3"
                  onClick={() => setActiveModule(item.key)}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              )
            })}
          </nav>

          {activeModule === "finance" && (
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: "overview" as const, label: "Visão" },
                { key: "cashflow" as const, label: "Caixa" },
                { key: "abc" as const, label: "ABC" },
                { key: "dre" as const, label: "DRE" },
                { key: "expenses" as const, label: "Ajustes" },
                { key: "reports" as const, label: "Relatórios" },
                { key: "history" as const, label: "Histórico" },
              ].map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={activeFinanceSection === item.key ? "secondary" : "ghost"}
                  className="h-8 shrink-0 px-3 text-xs"
                  onClick={() => setActiveFinanceSection(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          )}

          {activeModule === "stock" && (
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: "overview" as const, label: "Visão" },
                { key: "history" as const, label: "Histórico" },
              ].map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={activeStockSection === item.key ? "secondary" : "ghost"}
                  className="h-8 shrink-0 px-3 text-xs"
                  onClick={() => setActiveStockSection(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          )}

          {activeModule === "mercadolivre" && (
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: "anuncios" as const, label: "Anúncios" },
                { key: "pedidos" as const, label: "Pedidos" },
                { key: "metricas" as const, label: "Métricas" },
              ].map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={activeMlSidebarGroup === item.key ? "secondary" : "ghost"}
                  className="h-8 shrink-0 px-3 text-xs"
                  onClick={() => setActiveMlSidebarGroup(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          )}
        </div>
        {activeModule === "home" && (
          <div className="mx-auto max-w-6xl space-y-6 pb-8">
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-sky-500/10 via-card to-violet-500/5 px-5 py-6 shadow-sm sm:px-8 sm:py-8 dark:from-sky-950/40 dark:via-card dark:to-violet-950/20">
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Central da empresa
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Ola, {financeAccountLabel}
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Visao global do periodo{" "}
                    <span className="font-medium text-foreground">{homePeriodLabel}</span>:
                    financeiro, operacao, comercial, estoque e tecnologia em uma tela de decisao.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        technologyHealth.ok
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                      )}
                    >
                      <Settings className="size-3.5 shrink-0" />
                      {technologyHealth.connectedCount}/{technologyHealth.totalCount} integracoes
                      ativas
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
                    Financeiro <ArrowRight className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full"
                    onClick={() => {
                      setActiveModule("mercadolivre")
                      setActiveMlSidebarGroup("pedidos")
                    }}
                  >
                    Comercial
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full"
                    onClick={() => setActiveModule("connections")}
                  >
                    TI & Integracoes
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HomeExecutiveCard
                icon={CircleDollarSign}
                label="Faturamento"
                value={formatCurrency(salesInFilterFinal)}
                detail={`${salesCountFinal} pedido(s) · ticket ${formatCurrency(ticketMedioFinal)}`}
                tone="income"
                onClick={() => {
                  setActiveModule("finance")
                  setActiveFinanceSection("overview")
                }}
              />
              <HomeExecutiveCard
                icon={TrendingUp}
                label="Lucro estimado"
                value={formatCurrency(homeNetProfit)}
                detail={`Margem ${homeMarginFinal.toFixed(1)}% · visual DRE`}
                tone={homeNetProfit >= 0 ? "income" : "danger"}
                onClick={() => {
                  setActiveModule("finance")
                  setActiveFinanceSection("dre")
                }}
              />
              <HomeExecutiveCard
                icon={CalendarDays}
                label="Proximos vencimentos"
                value={formatCurrency(upcomingCommitments.total)}
                detail={`${upcomingCommitments.items.length} em 30 dias${
                  upcomingCommitments.overdueCount
                    ? ` · ${upcomingCommitments.overdueCount} atrasado(s)`
                    : ""
                }`}
                tone={upcomingCommitments.overdueCount > 0 ? "danger" : "warning"}
                onClick={() => {
                  setActiveModule("finance")
                  setActiveFinanceSection("history")
                  setHistoryKindFilter("expense")
                }}
              />
              <HomeExecutiveCard
                icon={AlertCircle}
                label="Alertas criticos"
                value={String(homeActionItems.filter((item) => item.tone !== "success").length)}
                detail="Pendencias que pedem acao"
                tone={homeActionItems.some((item) => item.tone === "danger") ? "danger" : "neutral"}
                onClick={homeActionItems[0]?.onClick ?? (() => setActiveModule("home"))}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">O que precisa ser feito agora</CardTitle>
                  <CardDescription>
                    Prioridades operacionais, financeiras e tecnicas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {homeActionItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={item.onClick}
                        className={cn(
                          "rounded-none border p-3 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          item.tone === "danger" && "border-red-500/30 bg-red-500/5",
                          item.tone === "warning" && "border-amber-500/30 bg-amber-500/5",
                          item.tone === "info" && "border-sky-500/30 bg-sky-500/5",
                          item.tone === "success" && "border-emerald-500/30 bg-emerald-500/5",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 size-4 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 text-xs/relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div>
                    <CardTitle className="text-base">Compromissos</CardTitle>
                    <CardDescription>Boletos, cartao, contas e parcelas.</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sky-600 dark:text-sky-400"
                    onClick={() => {
                      setActiveModule("finance")
                      setActiveFinanceSection("history")
                      setHistoryKindFilter("expense")
                    }}
                  >
                    Ver tudo <ArrowRight className="size-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingCommitments.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum compromisso pendente nos proximos 30 dias.
                    </p>
                  ) : (
                    upcomingCommitments.items.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(item.dueDate)} · {item.source}
                            {item.overdue ? " · atrasado" : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-medium tabular-nums",
                            item.overdue && "text-red-700 dark:text-red-300",
                          )}
                        >
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HomeAreaCard
                icon={Wallet}
                title="Financeiro"
                metric={formatCurrency(financeOperatingResultFinal)}
                detail={`${financeOperatingMarginFinal.toFixed(1)}% margem · ${formatCurrency(
                  financeCostsInFilterFinal,
                )} custos`}
                onClick={() => {
                  setActiveModule("finance")
                  setActiveFinanceSection("overview")
                }}
              />
              <HomeAreaCard
                icon={Store}
                title="Comercial"
                metric={`${salesCountFinal} pedido(s)`}
                detail={`${mlListingsCount ?? 0} anuncios · ticket ${formatCurrency(ticketMedioFinal)}`}
                onClick={() => {
                  setActiveModule("mercadolivre")
                  setActiveMlSidebarGroup("pedidos")
                }}
              />
              <HomeAreaCard
                icon={Boxes}
                title="Operacao e estoque"
                metric={formatCurrency(stockSummary.stockValue)}
                detail={`${stockSummary.lowStockCount} abaixo minimo · ${productsWithoutCost.length} sem custo`}
                onClick={() => {
                  setActiveModule("stock")
                  setActiveStockSection("overview")
                }}
              />
              <HomeAreaCard
                icon={Settings}
                title="TI & Integracoes"
                metric={`${technologyHealth.connectedCount}/${technologyHealth.totalCount} online`}
                detail={
                  technologyHealth.ok
                    ? "ML e MP conectados"
                    : technologyHealth.disconnected.join(", ")
                }
                onClick={() => setActiveModule("connections")}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-border/70 shadow-sm lg:col-span-2">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="inline-flex items-center gap-2 text-base">
                      <Trophy className="size-4 text-amber-500" /> Radar comercial
                    </CardTitle>
                    <CardDescription>
                      Vendas, anuncios e produtos campeoes do periodo.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveModule("finance")
                      setActiveFinanceSection("abc")
                    }}
                  >
                    ABC completo
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <LineItem label="Receita" value={salesInFilterFinal} />
                    <LineItem label="Pedidos" value={salesCountFinal} format="number" />
                    <LineItem label="Itens vendidos" value={soldItemsFinal} format="number" />
                  </div>
                  {homeProductChampions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sem campeoes no periodo ou produtos sem custo cadastrado.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {homeProductChampions.slice(0, 4).map((item, index) => {
                        const itemImageUrl = "imageUrl" in item ? item.imageUrl : undefined

                        return (
                          <li
                            key={item.productId}
                            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-800 dark:text-amber-200">
                                {index + 1}
                              </span>
                              <div className="size-9 shrink-0 overflow-hidden rounded-full border bg-muted">
                                {itemImageUrl ? (
                                  <img
                                    src={itemImageUrl}
                                    alt={item.productName}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                    --
                                  </div>
                                )}
                              </div>
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
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Socios e reinvestimento</CardTitle>
                  <CardDescription>Visual, sem lancar custo automaticamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <LineItem label="Lucro base" value={partnerDistributionPreview.base} strong />
                  <LineItem
                    label="Reinvestir 70%"
                    value={partnerDistributionPreview.reinvestment}
                  />
                  <LineItem
                    label="Distribuir 30%"
                    value={partnerDistributionPreview.distributable}
                  />
                  <div className="rounded-none border border-border/70 bg-muted/20 p-3">
                    <LineItem label="Socio A 50%" value={partnerDistributionPreview.partnerShare} />
                    <LineItem label="Socio B 50%" value={partnerDistributionPreview.partnerShare} />
                  </div>
                  <p className="text-xs/relaxed text-muted-foreground">
                    Sem retirada registrada, o lucro e tratado como reinvestido na leitura
                    gerencial.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <HomeAreaCard
                icon={Search}
                title="Branch Hunter"
                metric="Analises e oportunidades"
                detail="Abrir radar de produtos, concorrencia e anuncios."
                onClick={() => {
                  setActiveModule("branchhunter")
                  setActiveHunterSection("analise-anuncio")
                }}
              />
              <HomeAreaCard
                icon={RefreshCw}
                title="Sincronizacao"
                metric={globalSyncLoading ? "Sincronizando" : "Atualizar dados"}
                detail={globalSyncStatus || "Rodar sync de ML, MP e dados externos."}
                onClick={() => setActiveModule("connections")}
              />
            </div>
          </div>
        )}

        {activeModule === "connections" && (
          <section className="mx-auto max-w-6xl space-y-5 pb-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">TI & Integrações</h1>
                <p className="text-sm text-muted-foreground">
                  Saúde das APIs, sincronizações, dados críticos e manutenção da operação digital.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={mlListingsLoading}
                  onClick={() => void loadMlListings(true)}
                >
                  <Database className={cn("mr-2 size-4", mlListingsLoading && "animate-pulse")} />
                  Validar anúncios
                </Button>
                <Button disabled={globalSyncLoading} onClick={() => void syncAllExternalData(true)}>
                  <RefreshCw className={cn("mr-2 size-4", globalSyncLoading && "animate-spin")} />
                  {globalSyncLoading ? "Sincronizando..." : "Sincronizar tudo"}
                </Button>
              </div>
            </div>

            {globalSyncStatus && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {globalSyncStatus}
              </div>
            )}

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="inline-flex items-center gap-2 text-base">
                  <Store className="size-4 text-warning" />
                  Mercado Livre
                </CardTitle>
                <CardDescription>
                  Conexão da conta, validade do token e sincronização centralizada pelo TI.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm">
                  {mlLoading ? (
                    <p className="text-muted-foreground">Carregando status da conexão...</p>
                  ) : mlConnectionStatus?.connected ? (
                    <>
                      <p className="font-medium">
                        {mlConnectionStatus.mlNickname ?? mlConnectionStatus.mlUserId}
                      </p>
                      <p className="text-muted-foreground">
                        Token expira em{" "}
                        {new Date(mlConnectionStatus.expiresAt).toLocaleString("pt-BR")}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Nenhuma conta conectada ao Mercado Livre.
                    </p>
                  )}
                  {mlError && <p className="text-destructive">{mlError}</p>}
                  {mlInfo && <p className="text-emerald-700 dark:text-emerald-400">{mlInfo}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {mlConnectionStatus?.connected ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void disconnectMlAccount()}
                      disabled={mlDisconnecting}
                    >
                      {mlDisconnecting ? "Desconectando..." : "Desconectar Mercado Livre"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-warning text-warning-foreground hover:bg-warning/90"
                      onClick={() => {
                        window.location.href = "/api/ml/connect"
                      }}
                    >
                      <Store className="mr-2 size-4" />
                      Conectar Mercado Livre
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HomeExecutiveCard
                icon={ShieldCheck}
                label="Saúde geral"
                value={technologyAlertCount > 0 ? `${technologyAlertCount} alerta(s)` : "OK"}
                detail={`${technologyHealth.connectedCount}/${technologyHealth.totalCount} integrações conectadas`}
                tone={technologyAlertCount > 0 ? "warning" : "income"}
                onClick={() => void syncAllExternalData(true)}
              />
              <HomeExecutiveCard
                icon={Database}
                label="Convex"
                value={financeData && stockData ? "Online" : "Carregando"}
                detail="Financeiro, estoque, contas e histórico salvos no banco"
                tone={financeData && stockData ? "income" : "neutral"}
                onClick={() => setActiveModule("home")}
              />
              <HomeExecutiveCard
                icon={Store}
                label="Mercado Livre"
                value={mlConnectionStatus?.connected ? "Conectado" : "Pendente"}
                detail={`${mlListingsCount ?? 0} anúncios · ${mlOrdersCount ?? 0} pedidos`}
                tone={mlConnectionStatus?.connected ? "income" : "danger"}
                onClick={() => setActiveModule("mercadolivre")}
              />
              <HomeExecutiveCard
                icon={Wallet}
                label="Mercado Pago"
                value={mpConnectionStatus?.connected ? "Conectado" : "Pendente"}
                detail={`Último report: ${formatSyncTimestamp(mpSyncProviderStatus?.lastSuccessAt)}`}
                tone={mpConnectionStatus?.connected ? "income" : "danger"}
                onClick={() => {
                  setActiveModule("finance")
                  setActiveFinanceSection("cashflow")
                }}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <Activity className="size-4 text-sky-600" />
                    Sincronizações
                  </CardTitle>
                  <CardDescription>
                    Execução, resultado e atualização das fontes externas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SyncStatusRow
                    label="Sync geral"
                    status={allSyncStatus?.status ?? "idle"}
                    lastSuccessAt={allSyncStatus?.lastSuccessAt}
                    message={allSyncStatus?.message}
                  />
                  <SyncStatusRow
                    label="Estoque Mercado Livre"
                    status={stockSyncStatus?.status ?? "idle"}
                    lastSuccessAt={stockSyncStatus?.lastSuccessAt}
                    message={stockSyncStatus?.message ?? undefined}
                  />
                  <SyncStatusRow
                    label="Mercado Pago reports"
                    status={mpSyncProviderStatus?.status ?? mpSyncState}
                    lastSuccessAt={mpSyncProviderStatus?.lastSuccessAt}
                    message={mpSyncProviderStatus?.message ?? mpSyncStatus ?? undefined}
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mlOrdersLoading}
                      onClick={() =>
                        void loadMlOrders({
                          startDate: filters.startDate,
                          endDate: filters.endDate,
                        })
                      }
                    >
                      <ShoppingBag className="mr-2 size-3.5" />
                      Atualizar pedidos
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <AlertCircle className="size-4 text-amber-600" />
                    Qualidade dos dados
                  </CardTitle>
                  <CardDescription>
                    Pontos que afetam margem, estoque e leitura gerencial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dataQualityIssues.map((issue) => (
                    <button
                      key={issue.title}
                      type="button"
                      onClick={issue.action}
                      className="flex w-full items-start justify-between gap-3 rounded-none border border-border/70 px-3 py-2 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{issue.title}</p>
                        <p className="text-xs text-muted-foreground">{issue.description}</p>
                      </div>
                      <Badge
                        variant={issue.tone === "success" ? "default" : "secondary"}
                        className={cn(
                          "shrink-0",
                          issue.tone === "danger" && "bg-red-500/15 text-red-700 dark:text-red-300",
                          issue.tone === "warning" &&
                            "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                        )}
                      >
                        {issue.count}
                      </Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <Boxes className="size-4 text-emerald-600" />
                    Automação de estoque
                  </CardTitle>
                  <CardDescription>Controle de baixa, Full e reconciliação.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <LineItem
                    label="Produtos Full"
                    value={fullStockProducts.length}
                    format="number"
                  />
                  <LineItem
                    label="Abaixo do mínimo"
                    value={stockSummary.lowStockCount}
                    format="number"
                  />
                  <LineItem label="Sem custo" value={productsWithoutCost.length} format="number" />
                  <LineItem
                    label="Sinais de divergência"
                    value={stockDivergenceSignals.length}
                    format="number"
                  />
                  <p className="text-xs/relaxed text-muted-foreground">
                    A baixa persistida hoje vem da reconciliação com o Mercado Livre e das
                    movimentações salvas no Convex. Vendas novas devem aparecer aqui como pendência
                    se o sync não refletir a quantidade.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <WifiIcon className="size-4 text-violet-600" />
                    Webhooks e APIs
                  </CardTitle>
                  <CardDescription>
                    Recebimento de eventos e disponibilidade externa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <TechStatusLine label="Webhook ML" value={lastWebhookStatus} tone="warning" />
                  <TechStatusLine
                    label="Pedidos ML API"
                    value={mlOrdersLoading ? "Carregando" : `${mlOrders.length} no período`}
                    tone={mlConnectionStatus?.connected ? "success" : "danger"}
                  />
                  <TechStatusLine
                    label="Anúncios ML API"
                    value={
                      mlListingsLoading
                        ? "Carregando"
                        : `${mlPlainListings.length || mlListingsCount || 0} carregado(s)`
                    }
                    tone={mlConnectionStatus?.connected ? "success" : "danger"}
                  />
                  <TechStatusLine
                    label="Mercado Pago API"
                    value={mpConnectionStatus?.connected ? "Disponível" : "Não conectado"}
                    tone={mpConnectionStatus?.connected ? "success" : "danger"}
                  />
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <Wrench className="size-4 text-slate-600" />
                    Manutenção
                  </CardTitle>
                  <CardDescription>Ações rápidas para corrigir a base.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setActiveModule("mercadolivre")
                      setActiveMlSidebarGroup("pedidos")
                      setActiveMlSection("orders")
                      setMlOrdersOnlyNoSku(true)
                    }}
                  >
                    <ShoppingBag className="mr-2 size-4" />
                    Resolver pedidos sem vínculo
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setActiveModule("stock")
                      setActiveStockSection("overview")
                    }}
                  >
                    <Tag className="mr-2 size-4" />
                    Cadastrar custos
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setActiveModule("finance")
                      setActiveFinanceSection("history")
                    }}
                  >
                    <ReceiptText className="mr-2 size-4" />
                    Revisar lançamentos
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    disabled={globalSyncLoading}
                    onClick={() => void syncAllExternalData(true)}
                  >
                    <RefreshCw className="mr-2 size-4" />
                    Reprocessar sincronizações
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
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
                      Financeiro
                    </CardTitle>
                    <CardDescription>
                      Visão real de caixa, vendas, custos e lucro da operação.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 shadow-sm">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[215px] space-y-1 rounded-md border border-border/60 bg-background px-2 py-1.5">
                          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <CalendarDays className="size-3" />
                            Periodo
                          </p>
                          <div className="flex items-center gap-1.5">
                            <BrDateInput
                              value={filters.startDate ?? ""}
                              onValueChange={(value) =>
                                setFilters((prev) => ({
                                  ...prev,
                                  startDate: value || undefined,
                                }))
                              }
                            />
                            <span className="text-xs text-muted-foreground">-</span>
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

                        <div className="flex min-w-[290px] flex-wrap items-end gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1.5">
                          <p className="basis-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Origem / tipo
                          </p>
                          <Select
                            value={financeSourceFilter}
                            onValueChange={(value) =>
                              setFinanceSourceFilter(value as FinanceSourceFilter)
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue placeholder="Origem" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas origens</SelectItem>
                              <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                              <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                              <SelectItem value="manual">Manual</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={financeTypeFilter}
                            onValueChange={(value) =>
                              setFinanceTypeFilter(value as FinanceTypeFilter)
                            }
                          >
                            <SelectTrigger className="h-8 w-[135px]">
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Entradas e saidas</SelectItem>
                              <SelectItem value="income">Entradas</SelectItem>
                              <SelectItem value="expense">Saidas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex min-w-[390px] flex-wrap items-end gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1.5">
                          <p className="basis-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Pedidos ML
                          </p>
                          <Input
                            className="h-8 w-[150px]"
                            placeholder="Titulo"
                            value={financeOrdersTitleFilter}
                            onChange={(event) => setFinanceOrdersTitleFilter(event.target.value)}
                          />
                          <Input
                            className="h-8 w-[105px]"
                            placeholder="MLB ID"
                            value={financeOrdersSkuFilter}
                            onChange={(event) => setFinanceOrdersSkuFilter(event.target.value)}
                          />
                          <Select
                            value={financeOrdersStatusFilter}
                            onValueChange={setFinanceOrdersStatusFilter}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="ready_to_ship">Pronto envio</SelectItem>
                              <SelectItem value="shipped">Enviado</SelectItem>
                              <SelectItem value="delivered">Entregue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex min-w-[190px] flex-wrap items-end gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1.5">
                          <p className="basis-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Analise
                          </p>
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

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => openFinanceInsight("profit")}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            openFinanceInsight("profit")
                        }}
                        className={cn(
                          "cursor-pointer border-violet-200/70 bg-violet-50/40 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-violet-800/50 dark:bg-violet-950/30",
                          activeFinanceInsight === "profit" && "ring-2 ring-violet-500/30",
                        )}
                      >
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300">
                            <CircleDollarSign className="size-3.5" />
                            Lucro
                          </CardDescription>
                          <CardTitle className={valueToneClass(financeOperatingResultFinal)}>
                            {formatCurrency(financeOperatingResultFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Receita menos custos do período
                        </CardContent>
                      </Card>
                      <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => openFinanceInsight("revenue")}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            openFinanceInsight("revenue")
                        }}
                        className={cn(
                          "cursor-pointer border-blue-200/70 bg-blue-50/40 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-800/50 dark:bg-blue-950/30",
                          activeFinanceInsight === "revenue" && "ring-2 ring-blue-500/30",
                        )}
                      >
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                            <ShoppingBag className="size-3.5" />
                            Faturamento
                          </CardDescription>
                          <CardTitle className="text-blue-700 dark:text-blue-300">
                            {formatCurrency(salesInFilterFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Vendas confirmadas
                        </CardContent>
                      </Card>
                      <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => openFinanceInsight("costs")}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            openFinanceInsight("costs")
                        }}
                        className={cn(
                          "cursor-pointer border-orange-200/70 bg-orange-50/40 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-orange-800/50 dark:bg-orange-950/30",
                          activeFinanceInsight === "costs" && "ring-2 ring-orange-500/30",
                        )}
                      >
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400">
                            <ReceiptText className="size-3.5" />
                            Custos
                          </CardDescription>
                          <CardTitle className="text-orange-700 dark:text-orange-400">
                            {formatCurrency(financeCostsInFilterFinal)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          CMV, taxas, frete e operação
                        </CardContent>
                      </Card>
                      <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => openFinanceInsight("sales")}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            openFinanceInsight("sales")
                        }}
                        className={cn(
                          "cursor-pointer border-slate-200/70 bg-slate-50/60 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-800/50 dark:bg-slate-950/30",
                          activeFinanceInsight === "sales" && "ring-2 ring-slate-500/30",
                        )}
                      >
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <ReceiptText className="size-3.5" />
                            Vendas
                          </CardDescription>
                          <CardTitle className="text-slate-800 dark:text-slate-200">
                            {salesCountFinal}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          {soldItemsFinal} itens vendidos
                        </CardContent>
                      </Card>
                      <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => openFinanceInsight("margin")}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            openFinanceInsight("margin")
                        }}
                        className={cn(
                          "cursor-pointer border-emerald-200/70 bg-emerald-50/40 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-emerald-800/50 dark:bg-emerald-950/30",
                          activeFinanceInsight === "margin" && "ring-2 ring-emerald-500/30",
                        )}
                      >
                        <CardHeader className="pb-2">
                          <CardDescription className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Percent className="size-3.5" />
                            Margem
                          </CardDescription>
                          <CardTitle className={valueToneClass(financeOperatingMarginFinal)}>
                            {financeOperatingMarginFinal.toFixed(1)}%
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Lucro sobre faturamento
                        </CardContent>
                      </Card>
                      <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => openFinanceInsight("ticket")}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            openFinanceInsight("ticket")
                        }}
                        className={cn(
                          "cursor-pointer border-violet-200/70 bg-violet-50/40 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-violet-800/50 dark:bg-violet-950/30",
                          activeFinanceInsight === "ticket" && "ring-2 ring-violet-500/30",
                        )}
                      >
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

                    <Dialog.Root
                      open={financeInsightModalOpen}
                      onOpenChange={setFinanceInsightModalOpen}
                    >
                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[min(90vh,34rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <Dialog.Title className="text-base font-semibold">
                                {financeInsightRows.title}
                              </Dialog.Title>
                              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                                {financeInsightRows.description}
                              </Dialog.Description>
                            </div>
                            <Dialog.Close asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Fechar detalhes">
                                <X className="size-4" />
                              </Button>
                            </Dialog.Close>
                          </div>
                          <MetricInsightPanel
                            className="mt-5 border-0 p-0 shadow-none ring-0"
                            title={financeInsightRows.title}
                            description={financeInsightRows.description}
                            rows={financeInsightRows.rows}
                            numberLabels={["Vendas", "Itens vendidos"]}
                            showHeader={false}
                          />
                          <CostDetailList
                            groups={financeInsightDetailGroups[activeFinanceInsight]}
                            onOpenTarget={(target) => {
                              setFinanceInsightModalOpen(false)
                              if (target === "orders") {
                                setActiveModule("mercadolivre")
                                setActiveMlSidebarGroup("pedidos")
                                setActiveMlSection("orders")
                                return
                              }
                              setActiveModule("finance")
                              setActiveFinanceSection("history")
                              setHistoryKindFilter(target === "history" ? "all" : "expense")
                              setHistoryStartDate(filters.startDate ?? "")
                              setHistoryEndDate(filters.endDate ?? "")
                            }}
                          />
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>

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

                    <div className="grid gap-4">
                      <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                          <div>
                            <CardDescription className="uppercase tracking-wide">
                              Gráfico principal
                            </CardDescription>
                            <CardTitle>Receita, lucro, pedidos e custos por dia</CardTitle>
                            <CardDescription>
                              Uma única leitura para entender entrada, resultado e volume.
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
                    </div>

                    <Card>
                      <CardHeader>
                        <CardDescription>Top produtos</CardDescription>
                        <CardTitle>Produtos que mais sustentam o lucro</CardTitle>
                        <CardDescription>
                          Ordenado por lucro líquido, com CMV, taxas/frete, giro e alertas de
                          margem/estoque.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {topProductRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sem vendas suficientes no período filtrado.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead>SKU / MLB</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Receita</TableHead>
                                <TableHead className="text-right">CMV</TableHead>
                                <TableHead className="text-right">Taxas/Frete</TableHead>
                                <TableHead className="text-right">Lucro líquido</TableHead>
                                <TableHead className="text-right">Margem</TableHead>
                                <TableHead className="text-right">Giro</TableHead>
                                <TableHead>ABC</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {topProductRows.slice(0, 8).map((row) => {
                                const badges: string[] = [
                                  row.profit < 0 ? "Prejuízo" : null,
                                  row.marginPercent >= 30 ? "Alta margem" : null,
                                  row.marginPercent > 0 && row.marginPercent < 12
                                    ? "Baixa margem"
                                    : null,
                                  row.velocity >= highVelocityThreshold ? "Alto giro" : null,
                                  row.stockCritical ? "Estoque crítico" : null,
                                ].filter((badge): badge is string => Boolean(badge))

                                return (
                                  <TableRow key={row.productId}>
                                    <TableCell className="max-w-[280px]">
                                      <div className="truncate font-medium">{row.productName}</div>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {badges.map((badge) => (
                                          <Badge
                                            key={badge}
                                            variant={
                                              badge === "Prejuízo" ? "destructive" : "secondary"
                                            }
                                            className="rounded-full text-[10px]"
                                          >
                                            {badge}
                                          </Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                                      {row.sku || "sem SKU"} · {row.mlbId}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {row.quantitySold}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-blue-700 dark:text-blue-300">
                                      {formatCurrency(row.revenue)}
                                    </TableCell>
                                    <TableCell className="text-right text-rose-700 dark:text-rose-400">
                                      {formatCurrency(row.cogs)}
                                    </TableCell>
                                    <TableCell className="text-right text-orange-700 dark:text-orange-400">
                                      {formatCurrency(row.feesAndShipping)}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-semibold",
                                        valueToneClass(row.profit),
                                      )}
                                    >
                                      {formatCurrency(row.profit)}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-semibold",
                                        valueToneClass(row.marginPercent),
                                      )}
                                    >
                                      {row.marginPercent.toFixed(1)}%
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {row.velocity.toFixed(1)}/dia
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="rounded-full">
                                        Classe {row.abcClass}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

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
                              financeDetailedOrders.slice(0, 10).map((order) => {
                                const handleRowClick = () => {
                                  const fullOrder = mlOrders.find((o) => o.id === order.id)
                                  if (!fullOrder) return
                                  const firstItem = fullOrder.items[0]
                                  const stockProduct = firstItem
                                    ? findProductByOrderItem({
                                        id: firstItem.id,
                                        title: firstItem.title,
                                        sku: firstItem.sku,
                                      })
                                    : undefined
                                  openOrderCostAnalysis(
                                    fullOrder,
                                    stockProduct,
                                    firstItem?.quantity ?? 0,
                                    firstItem?.title ?? "",
                                  )
                                }
                                return (
                                  <TableRow
                                    key={order.id}
                                    className="cursor-pointer transition-colors hover:bg-muted/50"
                                    onClick={handleRowClick}
                                  >
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
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground">
                          Mostrando 1 a {Math.min(financeDetailedOrders.length, 10)} de{" "}
                          {financeDetailedOrders.length}
                        </p>
                      </CardContent>
                    </Card>
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
                        className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                      >
                        Fonte: pedidos Mercado Livre
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
                                    <div className="flex items-center gap-2">
                                      <div className="size-9 shrink-0 overflow-hidden rounded-full border bg-muted">
                                        {row.imageUrl ? (
                                          <img
                                            src={row.imageUrl}
                                            alt={row.productName}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                            —
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex min-w-0 flex-col">
                                        <span className="truncate font-medium">
                                          {row.productName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {row.sku || "-"}
                                        </span>
                                      </div>
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
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setActiveFinanceSection("expenses")}
                  >
                    Novo ajuste manual
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveFinanceSection("categories")}
                  >
                    Categorias
                  </Button>
                </div>
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                      <ReceiptText className="size-5 text-primary" />
                      Registrar ajuste manual
                    </CardTitle>
                    <CardDescription>
                      Use para aportes, custos fixos, impostos manuais, devoluções e correções. As
                      vendas ML entram automaticamente no financeiro e não precisam ser duplicadas
                      aqui. Use a area de comprovantes abaixo ao registrar o custo; em{" "}
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
                        onValueChange={(value) =>
                          setLaunchForm((prev) => ({ ...prev, date: value }))
                        }
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
                          {(launchForm.kind === "income"
                            ? incomeCategories
                            : expenseCategories
                          ).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
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
                        <Select
                          value={launchForm.expenseType}
                          onValueChange={(value) =>
                            setLaunchForm((prev) => ({
                              ...prev,
                              expenseType: value as ExpenseType,
                            }))
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
                              <SelectItem value="boleto">Boleto</SelectItem>
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
              </>
            )}

            {activeFinanceSection === "categories" && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Categorias de lancamentos</CardTitle>
                      <CardDescription>
                        Subaba de lancamentos para organizar receitas e despesas.
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveFinanceSection("expenses")}
                      >
                        Novo lancamento
                      </Button>
                      <Button size="sm" variant="default">
                        Categorias
                      </Button>
                    </div>
                  </div>
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
                      <CardDescription>
                        Saldo usa apenas caixa movimentado. Vendas, CMV e taxas aparecem como
                        resultado operacional para não duplicar releases do Mercado Pago.
                      </CardDescription>
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
                            <TableHead className="text-right">Vendas</TableHead>
                            <TableHead className="text-right">Ajustes manuais</TableHead>
                            <TableHead className="text-right">MP liberado</TableHead>
                            <TableHead className="text-right">Débitos MP</TableHead>
                            <TableHead className="text-right">CMV</TableHead>
                            <TableHead className="text-right">Taxas/Frete</TableHead>
                            <TableHead className="text-right">Centralize</TableHead>
                            <TableHead className="text-right">Impostos</TableHead>
                            <TableHead className="text-right">Saldo de caixa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commerceFlowData.map((item) => (
                            <TableRow key={item.label}>
                              <TableCell>
                                <div className="font-medium">{item.label}</div>
                                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {item.details.slice(0, 3).map((detail, index) => (
                                    <p key={`${item.label}-${index}`} className="truncate">
                                      {detail}
                                    </p>
                                  ))}
                                  {item.details.length > 3 && (
                                    <p>+ {item.details.length - 3} itens</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.salesIncome)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.manualIncome - item.manualExpenses)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.mpReleases)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.mpDebits)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.cogs)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.mlFees + item.shipping)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.fulfillment)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.taxes)}
                              </TableCell>
                              <TableCell
                                className={cn("text-right font-semibold", valueToneClass(item.net))}
                              >
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
                      {evolutionReport.map((item) => {
                        const details = evolutionDetailsByLabel.get(item.monthLabel) ?? []
                        const expanded = expandedReportMonth === item.monthLabel
                        return (
                          <button
                            type="button"
                            key={item.monthLabel}
                            className="rounded-none border border-border p-3 text-left text-sm transition-colors hover:bg-muted/40"
                            onClick={() =>
                              setExpandedReportMonth((prev) =>
                                prev === item.monthLabel ? null : item.monthLabel,
                              )
                            }
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{item.monthLabel}</span>
                              <span className={valueToneClass(item.result)}>
                                {formatCurrency(item.result)}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <span>Entradas: {formatCurrency(item.income)}</span>
                              <span>Saidas: {formatCurrency(item.expense)}</span>
                              <span>{details.length} lanc.</span>
                            </div>
                            {expanded && (
                              <div className="mt-3 space-y-1 border-t border-border/60 pt-2">
                                {details.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Sem lancamentos.</p>
                                ) : (
                                  details.slice(0, 8).map((transaction) => (
                                    <div
                                      key={transaction.id}
                                      className="flex items-center justify-between gap-2 text-xs"
                                    >
                                      <span className="truncate">
                                        {transaction.description}{" "}
                                        <span className="text-muted-foreground">
                                          (
                                          {categoryMap.get(transaction.categoryId)?.name ??
                                            "Sem categoria"}
                                          )
                                        </span>
                                      </span>
                                      <span
                                        className={cn(
                                          "shrink-0 tabular-nums",
                                          transaction.kind === "income"
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-rose-600 dark:text-rose-400",
                                        )}
                                      >
                                        {transaction.kind === "income" ? "+" : "-"}{" "}
                                        {formatCurrency(transaction.amount)}
                                      </span>
                                    </div>
                                  ))
                                )}
                                {details.length > 8 && (
                                  <p className="text-xs text-muted-foreground">
                                    + {details.length - 8} lancamentos neste mes.
                                  </p>
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </CardContent>
                  </Card>
                </div>
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
                      <Card
                        role="button"
                        tabIndex={0}
                        aria-pressed={historySummaryFilter === "entries"}
                        className={cn(
                          "cursor-pointer border-emerald-200/70 bg-emerald-50/40 transition hover:border-emerald-500/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-emerald-800/50 dark:bg-emerald-950/30",
                          historySummaryFilter === "entries" &&
                            "border-emerald-500 shadow-sm ring-1 ring-emerald-500/40",
                        )}
                        onClick={() => openHistorySummaryDetails("entries")}
                        onKeyDown={(event) => handleHistorySummaryCardKeyDown(event, "entries")}
                      >
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
                      <Card
                        role="button"
                        tabIndex={0}
                        aria-pressed={historySummaryFilter === "fixed"}
                        className={cn(
                          "cursor-pointer border-amber-200/70 bg-amber-50/40 transition hover:border-amber-500/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-800/50 dark:bg-amber-950/30",
                          historySummaryFilter === "fixed" &&
                            "border-amber-500 shadow-sm ring-1 ring-amber-500/40",
                        )}
                        onClick={() => openHistorySummaryDetails("fixed")}
                        onKeyDown={(event) => handleHistorySummaryCardKeyDown(event, "fixed")}
                      >
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
                      <Card
                        role="button"
                        tabIndex={0}
                        aria-pressed={historySummaryFilter === "operational"}
                        className={cn(
                          "cursor-pointer border-orange-200/70 bg-orange-50/40 transition hover:border-orange-500/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-orange-800/50 dark:bg-orange-950/30",
                          historySummaryFilter === "operational" &&
                            "border-orange-500 shadow-sm ring-1 ring-orange-500/40",
                        )}
                        onClick={() => openHistorySummaryDetails("operational")}
                        onKeyDown={(event) => handleHistorySummaryCardKeyDown(event, "operational")}
                      >
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
                      <Card
                        role="button"
                        tabIndex={0}
                        aria-pressed={historySummaryFilter === "recurring"}
                        className={cn(
                          "cursor-pointer border-blue-200/70 bg-blue-50/40 transition hover:border-blue-500/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-800/50 dark:bg-blue-950/30",
                          historySummaryFilter === "recurring" &&
                            "border-blue-500 shadow-sm ring-1 ring-blue-500/40",
                        )}
                        onClick={() => openHistorySummaryDetails("recurring")}
                        onKeyDown={(event) => handleHistorySummaryCardKeyDown(event, "recurring")}
                      >
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

                    {historySummaryFilterLabel ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-none border border-border bg-muted/20 px-3 py-2 text-sm">
                        <span>
                          Exibindo detalhes de{" "}
                          <span className="font-medium">{historySummaryFilterLabel}</span>:{" "}
                          {historyTransactions.length} lancamento(s)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistorySummaryFilter(null)}
                        >
                          Limpar detalhe
                        </Button>
                      </div>
                    ) : null}

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
                                  {p.name} ({p.mlItemId ?? p.sku})
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
              <section className="mx-auto w-full max-w-md space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Mercado Pago</h2>
                    <p className="text-xs text-muted-foreground">
                      Saldo e extrato oficiais da conta conectada.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={mpLoading}
                      onClick={fetchMpData}
                      className="h-auto justify-start px-2 py-2 text-sky-600 dark:text-sky-400 hover:text-sky-700 sm:justify-center"
                    >
                      <RefreshCw className={cn("mr-1 size-4", mpLoading && "animate-spin")} />
                      <span className="flex flex-col items-start leading-none sm:items-center">
                        <span>{mpLoading ? "Atualizando..." : "Atualizar extrato"}</span>
                        <span className="mt-1 text-[10px] font-normal text-muted-foreground">
                          API rápida
                        </span>
                      </span>
                    </Button>
                  </div>
                </div>

                {mpError && <p className="text-sm text-destructive">{mpError}</p>}
                {mpSyncStatus && mpSyncState !== "success" && (
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      mpSyncState === "failed"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100",
                    )}
                  >
                    <p className="font-medium">{mpSyncStatus}</p>
                    {mpSyncState === "pending" && (
                      <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-200/80">
                        Voce nao precisa baixar o e-mail do Mercado Pago. O saldo oficial e
                        atualizado automaticamente algumas vezes ao dia.
                      </p>
                    )}
                  </div>
                )}

                <Card className="overflow-hidden border-border/80 shadow-sm">
                  <CardContent className="space-y-5 pt-6 pb-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {mpBalanceUnavailable ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                Saldo disponivel
                              </p>
                              <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
                                —
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Informe uma vez o saldo disponível visto no Mercado Pago. Depois
                                disso, o saldo será calculado pela âncora + movimentos do extrato
                                oficial.
                              </p>
                              <div className="mt-3 flex max-w-xs items-center gap-2">
                                <Input
                                  inputMode="decimal"
                                  placeholder="Ex: 668,32"
                                  value={mpAnchorBalance}
                                  onChange={(event) => setMpAnchorBalance(event.target.value)}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={mpLoading}
                                  onClick={() => void saveMpAnchor()}
                                >
                                  Salvar
                                </Button>
                              </div>
                            </div>
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

                  <div className="mb-4 grid grid-cols-3 gap-4 border-b border-border/60 pb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Bruto</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatCurrency(mpFutureGross)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Custos/taxas</p>
                      <p className="text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        - {formatCurrency(mpFutureFees)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Liquido</p>
                      <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(mpFutureNet)}
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
                                  const fees = Math.max(0, r.grossAmount - r.amount)
                                  return (
                                    <div
                                      key={r.sourceId}
                                      className="flex items-center justify-between border-b border-border/40 py-2.5 last:border-0"
                                    >
                                      <div>
                                        <p className="text-sm">Pagamento #{r.sourceId}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {time} · bruto {formatCurrency(r.grossAmount)}
                                          {fees > 0 ? ` · taxas ${formatCurrency(fees)}` : ""}
                                        </p>
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
                    <Badge variant="secondary">
                      {mpExtractSource === "ledger" ? "Oficial" : "Recente"}
                    </Badge>
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
                      Nenhuma movimentacao. Use Atualizar extrato acima.
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
                    type={productFeedback!.type}
                    message={productFeedback!.message}
                  />
                )}
                {showManualStockForm ? (
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                      <div>
                        <CardTitle className="text-base">Entrada manual (fornecedor)</CardTitle>
                        <CardDescription>
                          O MLB ID e opcional. Quando o anuncio for criado no site oficial do ML, a
                          sincronizacao vincula foto, MLB, preco e tipo de envio ao produto manual.
                          Dedup: mesmo nome + fornecedor + data.
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
                        <ProductNameInputWithSuggestions
                          value={manualStockForm.name}
                          onChange={(name) => {
                            setManualStockForm((p) => ({ ...p, name }))
                            if (!name.trim()) setManualStockImageUrl(undefined)
                          }}
                          suggestionCandidates={productNameSuggestionCandidates}
                          onPickSuggestion={(picked: ProductSuggestionCandidate) => {
                            setManualStockForm((p) => ({
                              ...p,
                              name: picked.name,
                              ...(picked.mlItemId ? { mlItemId: picked.mlItemId } : {}),
                            }))
                            setManualStockImageUrl(picked.imageUrl)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">MLB ID opcional</label>
                        <Input
                          placeholder="Preenchido pelo sync do ML"
                          value={manualStockForm.mlItemId}
                          onChange={(e) =>
                            setManualStockForm((p) => ({
                              ...p,
                              mlItemId: e.target.value,
                            }))
                          }
                          autoComplete="off"
                          className="font-mono"
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
                  onAddKanbanCard={handleAddKanbanCard}
                  onToggleProductHidden={handleToggleProductHidden}
                  initialColumnOrder={stockData?.preferences?.kanbanColumnOrder}
                  onColumnOrderChange={handleKanbanColumnOrderChange}
                  kanbanTimelineEvents={kanbanTimelineEvents}
                  onAddProduct={() => setShowManualStockForm((v) => !v)}
                  showAddForm={showManualStockForm}
                />
                {stockSalesReconcileReport ? (
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Relatorio de integracao</CardTitle>
                      <CardDescription>
                        Resultado da reconciliacao entre vendas Mercado Livre, estoque e financeiro.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <IntegrationMetric
                          label="Pedidos lidos"
                          value={stockSalesReconcileReport.totalMlOrdersFetched ?? 0}
                        />
                        <IntegrationMetric
                          label="Baixas criadas"
                          value={stockSalesReconcileReport.movementsCreated ?? 0}
                        />
                        <IntegrationMetric
                          label="Lancamentos"
                          value={stockSalesReconcileReport.transactionsCreated ?? 0}
                        />
                        <IntegrationMetric
                          label="Ja processados"
                          value={stockSalesReconcileReport.skippedAlreadyProcessed ?? 0}
                        />
                        <IntegrationMetric
                          label="Sem vinculo"
                          value={stockSalesReconcileReport.unmatchedItems ?? 0}
                          tone={
                            (stockSalesReconcileReport.unmatchedItems ?? 0) > 0
                              ? "warning"
                              : "neutral"
                          }
                        />
                      </div>
                      {(stockSalesReconcileReport.adjusted?.length ?? 0) > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Ultimas baixas aplicadas
                          </p>
                          <div className="grid gap-1">
                            {stockSalesReconcileReport.adjusted!.slice(0, 6).map((item) => (
                              <div
                                key={`${item.orderId}-${item.productName}-${item.soldQuantity}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-none border px-2 py-1.5 text-xs"
                              >
                                <span className="min-w-0 truncate">
                                  #{item.orderId} · {item.productName}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {item.previousQuantity} → {item.nextQuantity} ({item.soldQuantity}{" "}
                                  vend.)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {(stockSalesReconcileReport.unmatched?.length ?? 0) > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Vendas sem produto vinculado
                          </p>
                          <div className="grid gap-1">
                            {stockSalesReconcileReport.unmatched!.slice(0, 6).map((item) => (
                              <div
                                key={`${item.orderId}-${item.mlItemId}-${item.title}`}
                                className="rounded-none border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs"
                              >
                                #{item.orderId} · {item.mlItemId || "sem MLB"} · {item.title} ·{" "}
                                {item.quantity} un.
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}
              </section>
            )}

            {false && (
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
                    type={productFeedback?.type ?? "success"}
                    message={productFeedback?.message ?? ""}
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
                      <ProductNameInputWithSuggestions
                        placeholder="Ex.: multicook — aparecem sugestoes do catalogo (ML)"
                        value={productForm.name}
                        onChange={(name) => {
                          setProductForm((prev) => ({ ...prev, name }))
                          if (!name.trim()) setProductFormImageUrl(undefined)
                        }}
                        suggestionCandidates={productNameSuggestionCandidates}
                        onPickSuggestion={(picked: ProductSuggestionCandidate) => {
                          setProductForm((prev) => ({
                            ...prev,
                            name: picked.name,
                            ...(picked.sellingPrice !== undefined && picked.sellingPrice > 0
                              ? { sellingPrice: String(picked.sellingPrice) }
                              : {}),
                          }))
                          setProductFormImageUrl(picked.imageUrl)
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">MLB ID</p>
                      <Input
                        placeholder="Ex.: MLB1234567890"
                        value={productForm.mlItemId}
                        onChange={(event) =>
                          setProductForm((prev) => ({ ...prev, mlItemId: event.target.value }))
                        }
                        className="font-mono"
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
                        <p className="text-xs font-medium text-muted-foreground">MLB ID</p>
                        <Input
                          value={productEditForm.mlItemId}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({
                              ...prev,
                              mlItemId: event.target.value,
                            }))
                          }
                          className="font-mono"
                          readOnly
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
                            <TableCell className="font-mono text-xs">
                              {product.mlItemId ?? product.sku}
                            </TableCell>
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

            {activeStockSection === "history" && (
              <section className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Nova movimentacao</CardTitle>
                    <CardDescription>
                      Use “Venda” para registrar a saida e refletir automaticamente no financeiro.
                      Todas as entradas ficam no historico abaixo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <Select
                      value={movementForm.productId || undefined}
                      onValueChange={(value) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          productId: value as Id<"stockProducts">,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full sm:col-span-2">
                        <SelectValue placeholder="Produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.mlItemId ?? product.sku})
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
                      className="sm:col-span-2"
                      placeholder="Observacao"
                      value={movementForm.note}
                      onChange={(event) =>
                        setMovementForm((prev) => ({ ...prev, note: event.target.value }))
                      }
                    />
                    <Button
                      className="sm:col-span-2"
                      onClick={saveMovement}
                      disabled={products.length === 0}
                    >
                      Salvar movimentacao
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Historico de estoque</CardTitle>
                      <CardDescription>
                        Lista completa de movimentacoes; exporte o CSV para analise externa.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={exportStockHistory}
                      disabled={movements.length === 0}
                    >
                      Exportar CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table className="table-fixed min-w-[960px] [&_tbody_td]:align-top [&_thead_th]:align-middle">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[6.5rem]">Data</TableHead>
                          <TableHead className="min-w-[11rem] max-w-[22rem] whitespace-normal">
                            Produto
                          </TableHead>
                          <TableHead className="hidden w-[10rem] min-w-[9rem] max-w-[12rem] sm:table-cell whitespace-normal">
                            SKU
                          </TableHead>
                          <TableHead className="hidden min-w-[8rem] max-w-[12rem] md:table-cell whitespace-normal">
                            Categoria
                          </TableHead>
                          <TableHead className="w-[6rem]">Tipo</TableHead>
                          <TableHead className="w-[4rem] text-right">Qtd</TableHead>
                          <TableHead className="hidden w-[7rem] lg:table-cell text-right whitespace-normal">
                            P. unit. mov.
                          </TableHead>
                          <TableHead className="min-w-[8rem] max-w-[14rem] whitespace-normal">
                            Observacao
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements
                          .slice()
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((movement) => {
                            const prod = productMap.get(movement.productId)
                            return (
                              <TableRow key={movement.id}>
                                <TableCell className="whitespace-nowrap tabular-nums">
                                  {formatDate(movement.date)}
                                </TableCell>
                                <TableCell className="max-w-[22rem] whitespace-normal break-words">
                                  {prod?.name ?? "Produto removido"}
                                </TableCell>
                                <TableCell className="hidden max-w-[12rem] break-all font-mono text-xs whitespace-normal sm:table-cell">
                                  {prod?.mlItemId ?? prod?.sku ?? "—"}
                                </TableCell>
                                <TableCell className="hidden max-w-[12rem] break-words text-muted-foreground whitespace-normal md:table-cell">
                                  {prod?.category ?? "—"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {movementLabel(movement.type)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums whitespace-nowrap">
                                  {movement.quantity}
                                </TableCell>
                                <TableCell className="hidden text-right tabular-nums whitespace-nowrap lg:table-cell">
                                  {movement.type === "sale" && movement.unitPrice != null
                                    ? formatCurrency(movement.unitPrice)
                                    : "—"}
                                </TableCell>
                                <TableCell className="max-w-[14rem] whitespace-normal break-words">
                                  <span className="line-clamp-3" title={movement.note ?? undefined}>
                                    {movement.note ?? "—"}
                                  </span>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}

        {activeModule === "mercadolivre" && (
          <section className="space-y-4">
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

                {activeMlSection === "catalogo" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Catalogo ML</CardTitle>
                      <CardDescription>
                        Somente publicacoes na vitrine de catalogo ML (
                        <span className="font-mono">catalog_listing</span> diferente de false):
                        competicao de buy box. O anuncio classico sincronizado aparece na sub-aba
                        Anuncios. Custo unitario e lucro usam o produto no Estoque com o mesmo ID do
                        anuncio ML.
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

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,11rem)_minmax(0,11rem)_auto_auto] xl:items-end">
                        <Input
                          placeholder="Buscar por titulo, item ou catalogo..."
                          value={mlCatalogSearchTerm}
                          onChange={(event) => setMlCatalogSearchTerm(event.target.value)}
                          className="min-w-0 sm:col-span-2 xl:col-span-1"
                        />
                        <Select
                          value={mlCatalogStatusFilter}
                          onValueChange={setMlCatalogStatusFilter}
                        >
                          <SelectTrigger className="h-9 w-full min-w-0 [&_span]:truncate">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-[min(24rem,70vh)]">
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
                          <SelectTrigger
                            className="h-9 w-full min-w-0 [&_span]:truncate"
                            title={
                              mlCatalogSortBy === "priority_desc"
                                ? "Ativos e ganhando primeiro, pausados por ultimo"
                                : undefined
                            }
                          >
                            <SelectValue placeholder="Ordenar" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-[min(24rem,70vh)]">
                            <SelectItem value="priority_desc">Prioridade</SelectItem>
                            <SelectItem value="difference_desc">Diferenca (maior)</SelectItem>
                            <SelectItem value="difference_asc">Diferenca (menor)</SelectItem>
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
                      <p className="text-xs text-muted-foreground">
                        Ordem &quot;Prioridade&quot;: ativos/ganhando primeiro; anuncios pausados
                        por ultimo.
                      </p>

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
                            const product = productMapByMlItemId.get(
                              normalizeMercadoLibreItemId(row.itemId),
                            )
                            const unitCost = product?.unitCost ?? 0
                            const costMissingOrZero = !product || unitCost <= 0
                            const difference = row.price - (row.winnerPrice ?? row.price)
                            const estimatedFees = row.price * HUB_ML_AVG_FEE_RATE
                            const estimatedProfitPerSale =
                              row.price -
                              unitCost -
                              estimatedFees -
                              HUB_CENTRALIZE_SHIPPING_PER_ITEM -
                              centralizePackagingPerItem(product, row.title)
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

                                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-5">
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
                                      <p className="text-muted-foreground">Custo unit. (estoque)</p>
                                      <p
                                        className={cn(
                                          "font-semibold tabular-nums",
                                          product
                                            ? "text-foreground"
                                            : "text-muted-foreground font-normal",
                                        )}
                                      >
                                        {product ? formatCurrency(unitCost) : "—"}
                                      </p>
                                      {costMissingOrZero ? (
                                        <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                                          {!product
                                            ? "Sem produto no estoque com este mlItemId."
                                            : "Custo zero ou ausente — confira ou informe manualmente."}
                                        </p>
                                      ) : null}
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

                                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => openMlCatalogStockEdit(row)}
                                    >
                                      Editar custo / estoque
                                    </Button>
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

                {activeMlSection === "anuncios" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Anuncios</CardTitle>
                      <CardDescription>
                        Publicacoes em modo classico no ML (
                        <span className="font-mono">catalog_listing: false</span>
                        ), incluindo o par sincronizado com a vitrine de catalogo. A competicao de
                        buy box fica na sub-aba Catalogo. Custo e lucro estimado usam o produto no
                        Estoque vinculado ao ID do anuncio.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void loadMlListings(true)}>
                          Recarregar lista
                        </Button>
                        <span className="text-sm text-muted-foreground self-center">
                          {mlPlainListings.length > 0
                            ? `${mlNormalListingsFiltered.length} classicos (de ${mlPlainListings.length} nesta pagina)`
                            : null}
                        </span>
                      </div>

                      {mlListingsLoading ? (
                        <p className="text-sm text-muted-foreground">Carregando anuncios...</p>
                      ) : mlNormalListingsFiltered.length === 0 ? (
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>
                            Nenhum anuncio classico nesta pagina (todos com vitrine de catalogo).
                          </p>
                          <p className="text-xs leading-relaxed">
                            No Mercado Livre o mesmo produto pode ter dois anuncios: vitrine de
                            catalogo (concorrencia) e classico sincronizado. So o classico aparece
                            aqui; o de buy box esta em Catalogo.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {mlNormalListingsFiltered.map((listing) => {
                            const stockProduct = productMapByMlItemId.get(
                              normalizeMercadoLibreItemId(listing.id),
                            )
                            const unitCostAnuncio = stockProduct?.unitCost ?? 0
                            const estimatedFeesAnuncio = listing.price * HUB_ML_AVG_FEE_RATE
                            const lucroEstimadoAnuncio =
                              listing.price -
                              unitCostAnuncio -
                              estimatedFeesAnuncio -
                              HUB_CENTRALIZE_SHIPPING_PER_ITEM -
                              centralizePackagingPerItem(stockProduct, listing.title)
                            return (
                              <Card key={listing.id} className="rounded-none border">
                                <CardContent className="pt-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded border bg-muted">
                                        {listing.thumbnail ? (
                                          <img
                                            src={listing.thumbnail}
                                            alt={listing.title}
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
                                        <p className="font-medium line-clamp-2">{listing.title}</p>
                                        <p className="text-xs font-mono text-muted-foreground">
                                          {listing.id}
                                        </p>
                                        <p className="font-mono text-xs text-muted-foreground">
                                          {listing.id}
                                        </p>
                                        {listing.catalogProductId ? (
                                          <p className="text-xs text-muted-foreground">
                                            Par de catalogo ML:{" "}
                                            <span className="font-mono">
                                              {listing.catalogProductId}
                                            </span>
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] font-normal"
                                      >
                                        Classico
                                      </Badge>
                                      <Badge variant="outline">{listing.status}</Badge>
                                    </div>
                                  </div>
                                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
                                    <div>
                                      <p className="text-muted-foreground">Preco</p>
                                      <p className="font-semibold">
                                        {formatCurrency(listing.price)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Custo unit. (estoque)</p>
                                      <p
                                        className={cn(
                                          "font-semibold tabular-nums",
                                          stockProduct
                                            ? "text-foreground"
                                            : "text-muted-foreground font-normal",
                                        )}
                                      >
                                        {stockProduct ? formatCurrency(unitCostAnuncio) : "—"}
                                      </p>
                                      {!stockProduct ? (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          Sem produto com este mlItemId
                                        </p>
                                      ) : null}
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Estoque ML</p>
                                      <p className="font-semibold">{listing.available_quantity}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Vendidos</p>
                                      <p className="font-semibold">{listing.sold_quantity}</p>
                                    </div>
                                    <div className="sm:col-span-2 lg:col-span-2">
                                      <p className="text-muted-foreground">Lucro/Venda (~)</p>
                                      <p
                                        className={cn(
                                          "font-semibold",
                                          stockProduct
                                            ? lucroEstimadoAnuncio >= 0
                                              ? "text-emerald-700 dark:text-emerald-400"
                                              : "text-red-700 dark:text-red-300"
                                            : "text-muted-foreground",
                                        )}
                                      >
                                        {stockProduct ? formatCurrency(lucroEstimadoAnuncio) : "—"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                    {listing.permalink ? (
                                      <a
                                        href={listing.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        Ver no ML
                                      </a>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        openMlCatalogStockEdit(mlListingToStockEditSource(listing))
                                      }
                                    >
                                      Editar custo / estoque
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openAnalysis(listing.id)}
                                    >
                                      Abrir analise
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
                            Sem MLB ID
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
                        const productCost = (stockProduct?.unitCost ?? 0) * quantity
                        const orderFees = Math.max(0, order.mlFeeAmount)
                        const orderShipping = Math.max(0, order.shippingCostAmount)
                        const orderTaxes = Math.max(0, order.taxesAmount)
                        const orderCentralize = centralizeFulfillmentCostForItem(
                          stockProduct,
                          quantity,
                          firstItem?.title ?? "",
                        )
                        const orderTotalCost =
                          productCost + orderFees + orderShipping + orderTaxes + orderCentralize
                        const payout = order.totalPaidAmount
                        const profit = payout - orderTotalCost
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
                                        stockProduct,
                                        firstItem?.quantity ?? 0,
                                        firstItem?.title ?? "",
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
              </>
            )}
            {!mlConnectionStatus?.connected && (
              <Card>
                <CardHeader>
                  <CardTitle>Mercado Livre</CardTitle>
                  <CardDescription>
                    A conexão e a sincronização desta integração ficam centralizadas em TI &
                    Integrações.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveModule("connections")
                    }}
                  >
                    <Settings className="mr-2 size-4" />
                    Abrir TI & Integrações
                  </Button>
                </CardContent>
              </Card>
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

        <Dialog.Root
          open={mlCatalogStockDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setMlCatalogStockDialogOpen(false)
              setMlCatalogStockEditRow(null)
              setMlCatalogStockEditProductId(null)
              setMlCatalogStockEditSuggestion(null)
              setMlCatalogStockEditError(null)
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[min(90vh,42rem)] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
              <Dialog.Title className="text-base font-semibold">
                Editar custo e estoque (Mercado Livre)
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Vincula o anuncio <span className="font-mono">{mlCatalogStockEditRow?.itemId}</span>{" "}
                ao produto no estoque. O custo e refletido em pedidos, DRE e lucro estimado.
              </Dialog.Description>

              {mlCatalogStockEditSuggestion ? (
                <div className="mt-3 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <p className="font-medium text-foreground">Sugestao de custo</p>
                  <p>{mlCatalogStockEditSuggestion.detail}</p>
                  {mlCatalogStockEditSuggestion.matchedProductId ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      Ao salvar, este anuncio ML sera vinculado a esse produto (mesmo SKU ou nome
                      parecido).
                    </p>
                  ) : null}
                  {mlCatalogStockEditSuggestion.suggestedCost !== null &&
                  mlCatalogStockEditSuggestion.suggestedCost > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        setMlCatalogStockForm((f) => ({
                          ...f,
                          unitCost: String(mlCatalogStockEditSuggestion!.suggestedCost),
                        }))
                      }
                    >
                      Usar valor sugerido (
                      {formatCurrency(mlCatalogStockEditSuggestion.suggestedCost)})
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {mlCatalogStockEditError ? (
                <p className="mt-3 text-sm text-destructive">{mlCatalogStockEditError}</p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <Input
                    value={mlCatalogStockForm.name}
                    onChange={(e) => setMlCatalogStockForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">MLB ID</label>
                  <Input
                    value={mlCatalogStockForm.mlItemId}
                    onChange={(e) =>
                      setMlCatalogStockForm((f) => ({
                        ...f,
                        mlItemId: e.target.value,
                      }))
                    }
                    className="font-mono"
                    readOnly
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Categoria</label>
                  <Input
                    value={mlCatalogStockForm.category}
                    onChange={(e) =>
                      setMlCatalogStockForm((f) => ({
                        ...f,
                        category: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Quantidade</label>
                  <Input
                    type="number"
                    value={mlCatalogStockForm.quantity}
                    onChange={(e) =>
                      setMlCatalogStockForm((f) => ({
                        ...f,
                        quantity: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Estoque minimo</label>
                  <Input
                    type="number"
                    value={mlCatalogStockForm.minStock}
                    onChange={(e) =>
                      setMlCatalogStockForm((f) => ({
                        ...f,
                        minStock: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Custo unitario (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mlCatalogStockForm.unitCost}
                    onChange={(e) =>
                      setMlCatalogStockForm((f) => ({
                        ...f,
                        unitCost: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Preco venda (opcional)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mlCatalogStockForm.sellingPrice}
                    onChange={(e) =>
                      setMlCatalogStockForm((f) => ({
                        ...f,
                        sellingPrice: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={mlCatalogStockEditSaving}
                  onClick={() => setMlCatalogStockDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={mlCatalogStockEditSaving}
                  onClick={() => void saveMlCatalogStockEdit()}
                >
                  {mlCatalogStockEditSaving ? "Salvando..." : "Salvar no estoque"}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>

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
              <Button size="sm" variant="outline" onClick={() => setMlOrderCostAnalysis(null)}>
                <X className="size-4" />
                Fechar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-none border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Fonte dos custos:{" "}
                {mlOrderCostAnalysis.source === "ml_api"
                  ? "API Mercado Livre"
                  : "API Mercado Livre + custos cadastrados no estoque"}
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
                      label: "Frete ML",
                      value: mlOrderCostAnalysis.shippingCost,
                      color: "bg-violet-500",
                    },
                    {
                      label: "Centralize — envio (R$ 5/item)",
                      value: mlOrderCostAnalysis.centralizeShipping,
                      color: "bg-cyan-500",
                    },
                    {
                      label: "Centralize — embalagem",
                      value: mlOrderCostAnalysis.centralizePackaging,
                      color: "bg-sky-500",
                    },
                    { label: "Taxa ML", value: mlOrderCostAnalysis.mlFee, color: "bg-amber-500" },
                    { label: "Impostos", value: mlOrderCostAnalysis.taxes, color: "bg-red-500" },
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
    </main>
  )
}

function FinancialEvolutionChart({ data }: { data: SalesEvolutionPoint[] }) {
  const [showRevenue, setShowRevenue] = useState(true)
  const [showProfit, setShowProfit] = useState(true)
  const [showOrders, setShowOrders] = useState(true)
  const [showCosts, setShowCosts] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

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

  const selectedPoint = data.find((item) => item.key === selectedKey) ?? data[data.length - 1]
  const revenueMax = showRevenue ? Math.max(...data.map((item) => item.revenue), 1) : 1
  const costsMax = showCosts ? Math.max(...data.map((item) => item.costs), 1) : 1
  const profitMax = showProfit ? Math.max(...data.map((item) => Math.max(0, item.profit)), 1) : 1
  const moneyMax = Math.max(
    showRevenue ? revenueMax : 0,
    showCosts ? costsMax : 0,
    showProfit ? profitMax : 0,
    1,
  )
  const ordersMax = showOrders ? Math.max(...data.map((item) => item.orders), 1) : 1

  const xForIndex = (index: number) =>
    paddingLeft + (index / Math.max(1, data.length - 1)) * chartWidth
  const yForMoney = (value: number) =>
    paddingTop + (1 - Math.max(0, value) / moneyMax) * chartHeight
  const yForOrders = (value: number) =>
    paddingTop + (1 - Math.max(0, value) / Math.max(1, ordersMax)) * chartHeight

  const toPolyline = (values: number[], yFn: (v: number) => number) =>
    values.map((value, index) => `${xForIndex(index)},${yFn(value)}`).join(" ")

  const revenueValues = data.map((item) => item.revenue)
  const costsValues = data.map((item) => item.costs)
  const profitValues = data.map((item) => item.profit)
  const ordersValues = data.map((item) => item.orders)

  const revenuePoints = toPolyline(revenueValues, yForMoney)
  const costsPoints = toPolyline(costsValues, yForMoney)
  const profitPoints = toPolyline(profitValues, yForMoney)
  const revenueArea = `${paddingLeft},${paddingTop + chartHeight} ${revenuePoints} ${paddingLeft + chartWidth},${paddingTop + chartHeight}`
  const yTicks = [0, 0.25, 0.5, 0.75, 1]
  const barStep = chartWidth / Math.max(1, data.length)
  const barWidth = Math.max(8, Math.min(20, barStep * 0.45))

  const maxXTicks = data.length > 90 ? 7 : data.length > 45 ? 8 : data.length > 24 ? 10 : 14
  const xTickStep = Math.max(1, Math.ceil(data.length / maxXTicks))
  const xTickIndexes = data
    .map((_, index) => index)
    .filter((index) => index === 0 || index === data.length - 1 || index % xTickStep === 0)

  const formatXAxisLabel = (item: SalesEvolutionPoint) => {
    const keyParts = item.key.split("-")
    if (keyParts.length >= 2 && data.length > 90) {
      return `${keyParts[1]}/${keyParts[0].slice(2)}`
    }
    if (data.length > 24) {
      return item.label
    }
    const parts = item.label.split("/")
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : item.label
  }

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
                {(showRevenue || showCosts || showProfit) && (
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    className="fill-muted-foreground"
                  >
                    {formatCurrency(moneyValue)}
                  </text>
                )}
                {showOrders && (
                  <text
                    x={paddingLeft + chartWidth + 8}
                    y={y + 4}
                    textAnchor="start"
                    fontSize="10"
                    className="fill-muted-foreground"
                  >
                    {ordersValue}
                  </text>
                )}
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

          {showOrders &&
            ordersValues.map((value, index) => {
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

          {showRevenue && (
            <>
              <polygon points={revenueArea} fill="rgba(59, 130, 246, 0.12)" />
              <polyline points={revenuePoints} fill="none" stroke="#2563eb" strokeWidth="3" />
              {revenueValues.map((value, index) => (
                <circle
                  key={`rev-dot-${data[index]?.key ?? index}`}
                  cx={xForIndex(index)}
                  cy={yForMoney(value)}
                  r="3.2"
                  fill="#2563eb"
                />
              ))}
            </>
          )}

          {showProfit && (
            <>
              <polyline points={profitPoints} fill="none" stroke="#16a34a" strokeWidth="2.5" />
              {profitValues.map((value, index) => (
                <circle
                  key={`profit-dot-${data[index]?.key ?? index}`}
                  cx={xForIndex(index)}
                  cy={yForMoney(value)}
                  r="2.8"
                  fill="#16a34a"
                />
              ))}
            </>
          )}

          {showCosts && (
            <>
              <polyline
                points={costsPoints}
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.5"
                strokeDasharray="5 4"
              />
              {costsValues.map((value, index) => (
                <circle
                  key={`cost-dot-${data[index]?.key ?? index}`}
                  cx={xForIndex(index)}
                  cy={yForMoney(value)}
                  r="2.8"
                  fill="#ea580c"
                />
              ))}
            </>
          )}

          {xTickIndexes.map((index) => {
            const item = data[index]
            return (
              <text
                key={`xlabel-${item.key}`}
                x={xForIndex(index)}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                className="fill-muted-foreground"
              >
                {formatXAxisLabel(item)}
              </text>
            )
          })}

          {data.map((item, index) => (
            <rect
              key={`hit-${item.key}`}
              x={xForIndex(index) - Math.max(10, barStep / 2)}
              y={paddingTop}
              width={Math.max(20, barStep)}
              height={chartHeight}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setSelectedKey(item.key)}
            />
          ))}
        </svg>
      </div>
      {selectedPoint && (
        <div className="grid gap-2 rounded-none border bg-background p-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Período</p>
            <p className="font-medium">{selectedPoint.label}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Receita</p>
            <p className="font-medium text-blue-700 dark:text-blue-300">
              {formatCurrency(selectedPoint.revenue)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Custos</p>
            <p className="font-medium text-orange-700 dark:text-orange-300">
              {formatCurrency(selectedPoint.costs)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pedidos / lucro</p>
            <p className={cn("font-medium", valueToneClass(selectedPoint.profit))}>
              {selectedPoint.orders} · {formatCurrency(selectedPoint.profit)}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setShowRevenue((v) => !v)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 transition-opacity",
            !showRevenue && "opacity-40",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          Receita
        </button>
        <button
          type="button"
          onClick={() => setShowCosts((v) => !v)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 transition-opacity",
            !showCosts && "opacity-40",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-orange-600" />
          Custos
        </button>
        <button
          type="button"
          onClick={() => setShowProfit((v) => !v)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 transition-opacity",
            !showProfit && "opacity-40",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Lucro
        </button>
        <button
          type="button"
          onClick={() => setShowOrders((v) => !v)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 transition-opacity",
            !showOrders && "opacity-40",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Pedidos
        </button>
        <span className="text-muted-foreground">Dia</span>
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
      <div className="relative h-[260px] rounded-none border border-border bg-muted/10 p-2">
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
        {rows.map((row, index) => {
          if (!row.imageUrl) return null
          const x = paddingX + index * (barWidth + barGap) + barWidth / 2
          const barHeight = (row.metricValue / maxValue) * chartHeight
          const y = paddingY + chartHeight - barHeight
          return (
            <div
              key={`${row.productId}-image`}
              className="absolute size-7 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm"
              style={{
                left: `${(x / width) * 100}%`,
                top: `${(Math.max(20, y - 10) / height) * 100}%`,
              }}
              title={row.productName}
            >
              <img
                src={row.imageUrl}
                alt={row.productName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          )
        })}
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
  const nativeDateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayValue(formatIsoToBrDate(value))
  }, [value])

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        className="pr-8"
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
      <input
        ref={nativeDateInputRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={ariaLabel ? `${ariaLabel} no calendario` : "Escolher data no calendario"}
        onClick={() => {
          const input = nativeDateInputRef.current
          if (!input) return
          if (typeof input.showPicker === "function") {
            input.showPicker()
            return
          }
          input.click()
        }}
      >
        <CalendarDays className="size-3.5" />
      </button>
    </div>
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

function IntegrationMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: number
  tone?: "neutral" | "warning"
}) {
  return (
    <div
      className={cn(
        "rounded-none border border-border/70 bg-muted/20 px-3 py-2",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function HomeExecutiveCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  detail: string
  tone: "income" | "warning" | "danger" | "neutral"
  onClick: () => void
}) {
  const accentClass =
    tone === "income"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "bg-red-500/10 text-red-700 dark:text-red-300"
          : "bg-primary/10 text-primary"

  return (
    <Card
      role="button"
      tabIndex={0}
      className="cursor-pointer border-border/70 shadow-sm transition hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("rounded-lg p-2", accentClass)}>
            <Icon className="size-5" />
          </div>
          <span className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        <p
          className={cn(
            "mt-4 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
            tone === "income" && "text-emerald-700 dark:text-emerald-300",
            tone === "danger" && "text-red-700 dark:text-red-300",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function HomeAreaCard({
  icon: Icon,
  title,
  metric,
  detail,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  metric: string
  detail: string
  onClick: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="cursor-pointer border-border/70 shadow-sm transition hover:border-primary/35 hover:bg-muted/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <CardContent className="flex items-start gap-3 pt-5">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums">{metric}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function formatSyncTimestamp(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString("pt-BR") : "Nunca"
}

function SyncStatusRow({
  label,
  status,
  lastSuccessAt,
  message,
}: {
  label: string
  status: "idle" | "running" | "success" | "failed" | "pending"
  lastSuccessAt?: number
  message?: string
}) {
  const tone =
    status === "success"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "failed"
        ? "bg-red-500/15 text-red-700 dark:text-red-300"
        : status === "running" || status === "pending"
          ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
          : "bg-muted text-muted-foreground"

  return (
    <div className="rounded-none border border-border/70 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            Último sucesso: {formatSyncTimestamp(lastSuccessAt)}
          </p>
          {message && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{message}</p>}
        </div>
        <Badge className={cn("shrink-0", tone)} variant="secondary">
          {status === "running"
            ? "rodando"
            : status === "pending"
              ? "pendente"
              : status === "success"
                ? "sucesso"
                : status === "failed"
                  ? "falha"
                  : "idle"}
        </Badge>
      </div>
    </div>
  )
}

function TechStatusLine({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "success" | "warning" | "danger" | "neutral"
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-medium",
          tone === "success" && "text-emerald-700 dark:text-emerald-300",
          tone === "warning" && "text-amber-700 dark:text-amber-300",
          tone === "danger" && "text-red-700 dark:text-red-300",
        )}
      >
        {value}
      </span>
    </div>
  )
}

function MetricInsightPanel({
  title,
  description,
  rows,
  numberLabels = [],
  className,
  showHeader = true,
}: {
  title: string
  description: string
  rows: { label: string; value: number; tone?: "income" | "expense" | "neutral" }[]
  numberLabels?: string[]
  className?: string
  showHeader?: boolean
}) {
  const maxValue = Math.max(...rows.map((item) => Math.abs(item.value)), 1)

  return (
    <Card className={cn("border-border/70 shadow-sm", className)}>
      {showHeader && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const width = Math.min(100, (Math.abs(row.value) / maxValue) * 100)
          const shouldFormatAsNumber = numberLabels.some((label) => row.label.includes(label))
          return (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">{row.label}</span>
                <span
                  className={cn(
                    "shrink-0 font-medium tabular-nums",
                    row.tone === "income" && "text-emerald-700 dark:text-emerald-400",
                    row.tone === "expense" && "text-orange-700 dark:text-orange-400",
                  )}
                >
                  {shouldFormatAsNumber ? Math.trunc(row.value) : formatCurrency(row.value)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    row.tone === "income"
                      ? "bg-emerald-500"
                      : row.tone === "expense"
                        ? "bg-orange-500"
                        : "bg-sky-500",
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function CostDetailList({
  groups,
  onOpenTarget,
}: {
  groups: FinanceInsightDetailGroup[]
  onOpenTarget: (target: CostDetailTarget) => void
}) {
  if (groups.length === 0) return null
  const formatInsightValue = (value: number, format?: InsightValueFormat) => {
    if (format === "number") return Math.round(value).toLocaleString("pt-BR")
    if (format === "percent") return `${value.toFixed(1)}%`
    return formatCurrency(value)
  }

  return (
    <div className="mt-5 space-y-3 border-t border-border/70 pt-4">
      {groups.map((group) => {
        const visibleItems = group.items.slice(0, 4)
        const hiddenCount = Math.max(0, group.items.length - visibleItems.length)
        const target = group.target
        return (
          <div key={group.label} className="rounded-none border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{group.label}</p>
                <p className="text-xs text-muted-foreground">{group.items.length} registro(s)</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {formatInsightValue(group.total, group.format)}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {visibleItems.map((item, index) => (
                <div
                  key={`${group.label}-${item.label}-${index}`}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{item.label}</p>
                    {item.detail && <p className="truncate text-muted-foreground">{item.detail}</p>}
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {formatInsightValue(item.value, item.format ?? group.format)}
                  </span>
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  + {hiddenCount} registro(s) resumido(s)
                </p>
              )}
            </div>

            {target && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 px-0 text-xs text-sky-700 hover:text-sky-800 dark:text-sky-300"
                onClick={() => onOpenTarget(target)}
              >
                Ver mais
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
