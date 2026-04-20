export type KanbanStatus = "planned" | "buying" | "in_transit" | "in_stock"

export type UrgencyLevel = "critical" | "low" | "ok"

export interface KanbanProduct {
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
  kanbanStatus: KanbanStatus
  estimatedArrival?: string
  kanbanNote?: string
}

export interface KanbanMovement {
  id: string
  productId: string
  type: "in" | "out" | "adjustment" | "sale"
  quantity: number
  date: string
  note?: string
}

export const KANBAN_COLUMNS: Array<{
  id: KanbanStatus
  label: string
  emoji: string
  color: string
  droppable?: boolean
}> = [
  { id: "planned", label: "Planejado", emoji: "📋", color: "#60a5fa" },
  { id: "buying", label: "Comprando", emoji: "🛒", color: "#fbbf24" },
  { id: "in_transit", label: "Em Trânsito", emoji: "🚚", color: "#fb923c" },
  { id: "in_stock", label: "No Estoque", emoji: "✅", color: "#4ade80" },
]

export const EM_FALTA_COLUMN = {
  id: "em_falta" as const,
  label: "Em Falta",
  emoji: "🔴",
  color: "#f87171",
  droppable: false,
}

export function getUrgency(product: KanbanProduct): UrgencyLevel {
  if (product.quantity === 0) return "critical"
  if (product.minStock > 0 && product.quantity < product.minStock) return "low"
  return "ok"
}

export function urgencyColor(urgency: UrgencyLevel): string {
  if (urgency === "critical") return "#f87171"
  if (urgency === "low") return "#fbbf24"
  return "#4ade80"
}

export function urgencyBorderClass(urgency: UrgencyLevel): string {
  if (urgency === "critical") return "border-l-red-400"
  if (urgency === "low") return "border-l-yellow-400"
  return "border-l-green-400"
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export const MOVEMENT_LABELS: Record<string, string> = {
  in: "Entrada",
  out: "Saída",
  adjustment: "Ajuste",
  sale: "Venda",
}
