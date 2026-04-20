"use client"

import { useState, useMemo } from "react"
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  Package,
  BarChart2,
  AlertCircle,
  TrendingDown,
  Truck,
  ClipboardList,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  type KanbanColumnId,
  type KanbanProduct,
  type KanbanMovement,
  type UrgencyLevel,
  KANBAN_COLUMNS,
  EM_FALTA_COLUMN,
  getKanbanColumnId,
  getUrgency,
  formatCurrencyBRL,
} from "./types"
import { KanbanColumn } from "./KanbanColumn"
import { KanbanFilters } from "./KanbanFilters"
import { ProductCard } from "./ProductCard"
import { ProductDetailModal } from "./ProductDetailModal"

interface StockSummary {
  totalProducts: number
  totalUnits: number
  lowStockCount: number
  stockValue: number
}

interface KanbanBoardProps {
  products: KanbanProduct[]
  movements: KanbanMovement[]
  stockSummary: StockSummary
  onUpdateKanbanStatus: (
    productId: string,
    target: KanbanColumnId,
    note?: string,
    estimatedArrival?: string,
  ) => Promise<void>
  onSaveProductEdits: (
    productId: string,
    updates: Partial<KanbanProduct>,
  ) => Promise<void>
  onDeleteProduct: (productId: string) => Promise<void>
}

export function KanbanBoard({
  products,
  movements,
  stockSummary,
  onUpdateKanbanStatus,
  onSaveProductEdits,
  onDeleteProduct,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<KanbanProduct | null>(null)
  const [search, setSearch] = useState("")
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | UrgencyLevel>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].filter(Boolean),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q))
        return false
      if (urgencyFilter !== "all" && getUrgency(p) !== urgencyFilter) return false
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false
      return true
    })
  }, [products, search, urgencyFilter, categoryFilter])

  const activeProduct = activeId ? products.find((p) => p.id === activeId) : null
  const inTransitCount = products.filter((p) => p.kanbanStatus === "in_transit").length
  const plannedCount = products.filter((p) => p.kanbanStatus === "planned").length

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const target = over.id as KanbanColumnId
    const product = products.find((p) => p.id === active.id)
    if (!product) return
    if (getKanbanColumnId(product) === target) return
    void onUpdateKanbanStatus(product.id, target)
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-1">
      {/* KPI summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryKpi icon={Package} label="Produtos" value={stockSummary.totalProducts} />
        <SummaryKpi icon={BarChart2} label="Unidades" value={stockSummary.totalUnits} />
        <SummaryKpi
          icon={AlertCircle}
          label="Abaixo do mínimo"
          value={stockSummary.lowStockCount}
          accent="warning"
        />
        <SummaryKpi
          icon={TrendingDown}
          label="Valor em estoque"
          value={stockSummary.stockValue}
          currency
        />
        <SummaryKpi icon={Truck} label="Em trânsito" value={inTransitCount} />
        <SummaryKpi icon={ClipboardList} label="Aguardando compra" value={plannedCount} />
      </div>

      {/* Filters */}
      <KanbanFilters
        search={search}
        onSearch={setSearch}
        urgency={urgencyFilter}
        onUrgency={setUrgencyFilter}
        category={categoryFilter}
        onCategory={setCategoryFilter}
        categories={categories}
      />

      {/* Boards */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="-mx-1 overflow-x-auto rounded-xl">
        <div className="flex min-w-max gap-4 px-1 pb-4 pt-1">
          {/* Em falta: quantidade 0 + status físico "no estoque" (sem pipeline) */}
          <KanbanColumn
            id={EM_FALTA_COLUMN.id}
            label={EM_FALTA_COLUMN.label}
            droppable={EM_FALTA_COLUMN.droppable}
            products={filteredProducts.filter(
              (p) => p.quantity === 0 && p.kanbanStatus === "in_stock",
            )}
            onCardDetails={setSelectedProduct}
            onCardMoveTo={(product, columnTarget) =>
              void onUpdateKanbanStatus(product.id, columnTarget)
            }
            onCardDelete={(product) => void onDeleteProduct(product.id)}
          />
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              products={filteredProducts.filter((p) => {
                if (col.id === "in_stock") {
                  return p.kanbanStatus === "in_stock" && p.quantity > 0
                }
                return p.kanbanStatus === col.id
              })}
              onCardDetails={setSelectedProduct}
              onCardMoveTo={(product, columnTarget) =>
                void onUpdateKanbanStatus(product.id, columnTarget)
              }
              onCardDelete={(product) => void onDeleteProduct(product.id)}
            />
          ))}
        </div>
        </div>

        <DragOverlay>
          {activeProduct ? (
            <ProductCard
              product={activeProduct}
              isDragging
              onDetails={() => {}}
              onMoveTo={() => {}}
              onDelete={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          movements={movements}
          onClose={() => setSelectedProduct(null)}
          onMoveTo={async (target, note, arrival) => {
            await onUpdateKanbanStatus(selectedProduct.id, target, note, arrival)
            setSelectedProduct(null)
          }}
          onSaveEdits={async (updates) => {
            await onSaveProductEdits(selectedProduct.id, updates)
            setSelectedProduct(null)
          }}
        />
      )}
    </div>
  )
}

function SummaryKpi({
  icon: Icon,
  label,
  value,
  currency,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: number
  currency?: boolean
  accent?: "warning"
}) {
  const formatted = currency ? formatCurrencyBRL(value) : String(value)

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Icon
          className={cn(
            "h-5 w-5 flex-shrink-0",
            accent === "warning" ? "text-yellow-400" : "text-primary",
          )}
        />
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{formatted}</p>
        </div>
      </CardContent>
    </Card>
  )
}
