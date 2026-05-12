export type KanbanStatus =
  | "purchased"
  /** @deprecated usar purchased — mantido para dados antigos */
  | "planned"
  /** @deprecated usar purchased — mantido para dados antigos */
  | "buying"
  | "in_transit"
  | "awaiting_inspection"
  | "returned"
  | "completed"
  | "in_stock"
  | "fulfillment"

export type UrgencyLevel = "critical" | "low" | "ok"

export interface KanbanProduct {
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
  kanbanStatus: KanbanStatus
  estimatedArrival?: string
  kanbanNote?: string
  kanbanHidden?: boolean
  supplier?: string
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
  droppable?: boolean
}> = [
  { id: "in_stock", label: "Estoque" },
  { id: "fulfillment", label: "Full (ML)" },
  { id: "purchased", label: "Comprado" },
  { id: "in_transit", label: "Em trânsito" },
  { id: "awaiting_inspection", label: "Aguardando conferência" },
  { id: "returned", label: "Devolvido" },
  { id: "completed", label: "Concluído" },
]

export const EM_FALTA_COLUMN = {
  id: "em_falta" as const,
  label: "Em falta",
  droppable: true as const,
}

/** Coluna visual do card no quadro (inclui Em falta, que depende de quantidade + status). */
export type KanbanColumnId = KanbanStatus | "em_falta"

/** Planejado / Comprando / Comprado unificados na UI como "Comprado". */
export function isCompradoKanbanStatus(status: KanbanStatus | undefined): boolean {
  return status === "purchased" || status === "planned" || status === "buying"
}

/** Para navegação entre colunas e labels, trata planned/buying como purchased. */
export function getEffectiveKanbanStatusForUi(product: KanbanProduct): KanbanStatus {
  if (isCompradoKanbanStatus(product.kanbanStatus)) return "purchased"
  return product.kanbanStatus
}

export function getKanbanColumnId(product: KanbanProduct): KanbanColumnId {
  if (product.quantity === 0 && product.kanbanStatus === "in_stock") {
    return "em_falta"
  }
  if (product.kanbanStatus === "fulfillment") {
    return "fulfillment"
  }
  if (product.kanbanStatus === "in_stock" && product.quantity > 0) {
    return "in_stock"
  }
  if (isCompradoKanbanStatus(product.kanbanStatus)) {
    return "purchased"
  }
  return product.kanbanStatus
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
