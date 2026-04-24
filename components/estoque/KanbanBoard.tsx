"use client"

import { useState, useMemo, useEffect } from "react"
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { Package, BarChart2, AlertCircle, TrendingDown, Truck, ClipboardList } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { normalizeMercadoLibreItemId } from "@/lib/mercadolivre/item-id"
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
  isCompradoKanbanStatus,
} from "./types"
import { KanbanColumn } from "./KanbanColumn"
import { KanbanFilters } from "./KanbanFilters"
import { ProductCard } from "./ProductCard"
import { ProductDetailModal, type ProductKanbanEventRow } from "./ProductDetailModal"

interface StockSummary {
  totalProducts: number
  totalUnits: number
  lowStockCount: number
  stockValue: number
}

const LS_COLLAPSED = "branchcommerce.kanban.collapsed"
const LS_SHOW_HIDDEN = "branchcommerce.kanban.showHidden"
const MLB_CODE_REGEX = /^MLB\d+$/i

function extractMlCode(product: Pick<KanbanProduct, "mlItemId" | "sku">): string | null {
  const candidate = product.mlItemId?.trim() || product.sku?.trim()
  if (!candidate) return null
  const normalized = normalizeMercadoLibreItemId(candidate)
  return MLB_CODE_REGEX.test(normalized) ? normalized : null
}

function pickImageFromMlProductDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null
  const rec = detail as {
    pictures?: Array<{ secure_url?: string; url?: string }>
    secure_thumbnail?: string
    thumbnail?: string
  }
  return (
    rec.pictures?.[0]?.secure_url ??
    rec.pictures?.[0]?.url ??
    rec.secure_thumbnail ??
    rec.thumbnail ??
    null
  )
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
  onSaveProductEdits: (productId: string, updates: Partial<KanbanProduct>) => Promise<void>
  onDeleteProduct: (productId: string) => Promise<void>
  onToggleProductHidden?: (productId: string, hidden: boolean) => Promise<void>
  kanbanTimelineEvents?: ProductKanbanEventRow[]
}

export function KanbanBoard({
  products,
  movements,
  stockSummary,
  onUpdateKanbanStatus,
  onSaveProductEdits,
  onDeleteProduct,
  onToggleProductHidden,
  kanbanTimelineEvents = [],
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<KanbanProduct | null>(null)
  const [fallbackImageByMlCode, setFallbackImageByMlCode] = useState<Record<string, string>>({})
  const [imageLookupFailures, setImageLookupFailures] = useState<Record<string, true>>({})
  const [search, setSearch] = useState("")
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | UrgencyLevel>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showHidden, setShowHidden] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return localStorage.getItem(LS_SHOW_HIDDEN) === "1"
    } catch {
      return false
    }
  })
  const [collapsedByColumn, setCollapsedByColumn] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const c = localStorage.getItem(LS_COLLAPSED)
      if (!c) return {}
      return JSON.parse(c) as Record<string, boolean>
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LS_SHOW_HIDDEN, showHidden ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [showHidden])

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsedByColumn))
    } catch {
      /* ignore */
    }
  }, [collapsedByColumn])

  const missingImageCodes = useMemo(() => {
    const nextCodes = new Set<string>()
    for (const product of products) {
      if (product.imageUrl) continue
      const mlCode = extractMlCode(product)
      if (!mlCode) continue
      if (fallbackImageByMlCode[mlCode]) continue
      if (imageLookupFailures[mlCode]) continue
      nextCodes.add(mlCode)
    }
    return [...nextCodes]
  }, [products, fallbackImageByMlCode, imageLookupFailures])

  useEffect(() => {
    if (missingImageCodes.length === 0) return
    let cancelled = false

    const hydrateMissingImages = async () => {
      const resolved: Record<string, string> = {}
      const failures: string[] = []

      await Promise.all(
        missingImageCodes.map(async (mlCode) => {
          try {
            const response = await fetch(
              `/api/ml/catalog/hub?action=product_detail&productId=${encodeURIComponent(mlCode)}`,
              { cache: "no-store" },
            )
            if (!response.ok) {
              failures.push(mlCode)
              return
            }
            const payload = (await response.json()) as { ok?: boolean; data?: unknown }
            const imageUrl = pickImageFromMlProductDetail(payload.data)
            if (!payload.ok || !imageUrl) {
              failures.push(mlCode)
              return
            }
            resolved[mlCode] = imageUrl
          } catch {
            failures.push(mlCode)
          }
        }),
      )

      if (cancelled) return
      if (Object.keys(resolved).length > 0) {
        setFallbackImageByMlCode((prev) => ({ ...prev, ...resolved }))
      }
      if (failures.length > 0) {
        setImageLookupFailures((prev) => {
          const next = { ...prev }
          for (const code of failures) next[code] = true
          return next
        })
      }
    }

    void hydrateMissingImages()
    return () => {
      cancelled = true
    }
  }, [missingImageCodes])

  const displayProducts = useMemo(
    () =>
      products.map((product) => {
        if (product.imageUrl) return product
        const mlCode = extractMlCode(product)
        if (!mlCode) return product
        const fallbackImage = fallbackImageByMlCode[mlCode]
        if (!fallbackImage) return product
        return { ...product, imageUrl: fallbackImage }
      }),
    [products, fallbackImageByMlCode],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const categories = useMemo(
    () => [...new Set(displayProducts.map((p) => p.category))].filter(Boolean),
    [displayProducts],
  )

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase()
    return displayProducts.filter((p) => {
      if (!showHidden && p.kanbanHidden) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
      if (urgencyFilter !== "all" && getUrgency(p) !== urgencyFilter) return false
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false
      return true
    })
  }, [displayProducts, search, urgencyFilter, categoryFilter, showHidden])

  const activeProduct = activeId ? displayProducts.find((p) => p.id === activeId) : null
  const inTransitCount = displayProducts.filter((p) => p.kanbanStatus === "in_transit").length
  const compradoCount = displayProducts.filter((p) => isCompradoKanbanStatus(p.kanbanStatus)).length

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const target = over.id as KanbanColumnId
    const product = displayProducts.find((p) => p.id === active.id)
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
        <SummaryKpi icon={ClipboardList} label="Comprado" value={compradoCount} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <KanbanFilters
          search={search}
          onSearch={setSearch}
          urgency={urgencyFilter}
          onUrgency={setUrgencyFilter}
          category={categoryFilter}
          onCategory={setCategoryFilter}
          categories={categories}
        />
        <Button
          type="button"
          variant={showHidden ? "secondary" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setShowHidden((v) => !v)}
        >
          {showHidden ? "Ocultar itens escondidos" : "Mostrar ocultos"}
        </Button>
      </div>

      {/* Boards */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="-mx-1 overflow-x-auto rounded-xl">
          <div className="flex min-w-max gap-4 px-1 pb-4 pt-1">
            {/* Em falta: quantidade 0 + status físico "no estoque" (sem pipeline) */}
            <KanbanColumn
              id={EM_FALTA_COLUMN.id}
              label={EM_FALTA_COLUMN.label}
              droppable={EM_FALTA_COLUMN.droppable}
              collapsed={!!collapsedByColumn[EM_FALTA_COLUMN.id]}
              onToggleCollapsed={() =>
                setCollapsedByColumn((prev) => ({
                  ...prev,
                  [EM_FALTA_COLUMN.id]: !prev[EM_FALTA_COLUMN.id],
                }))
              }
              products={filteredProducts.filter(
                (p) => p.quantity === 0 && p.kanbanStatus === "in_stock",
              )}
              onCardDetails={setSelectedProduct}
              onCardMoveTo={(product, columnTarget) =>
                void onUpdateKanbanStatus(product.id, columnTarget)
              }
              onCardDelete={(product) => void onDeleteProduct(product.id)}
              onToggleCardHidden={
                onToggleProductHidden
                  ? (product) => void onToggleProductHidden(product.id, !product.kanbanHidden)
                  : undefined
              }
            />
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                collapsed={!!collapsedByColumn[col.id]}
                onToggleCollapsed={() =>
                  setCollapsedByColumn((prev) => ({
                    ...prev,
                    [col.id]: !prev[col.id],
                  }))
                }
                products={filteredProducts.filter((p) => {
                  if (col.id === "in_stock") {
                    return p.kanbanStatus === "in_stock" && p.quantity > 0
                  }
                  if (col.id === "purchased") {
                    return isCompradoKanbanStatus(p.kanbanStatus)
                  }
                  return p.kanbanStatus === col.id
                })}
                onCardDetails={setSelectedProduct}
                onCardMoveTo={(product, columnTarget) =>
                  void onUpdateKanbanStatus(product.id, columnTarget)
                }
                onCardDelete={(product) => void onDeleteProduct(product.id)}
                onToggleCardHidden={
                  onToggleProductHidden
                    ? (product) => void onToggleProductHidden(product.id, !product.kanbanHidden)
                    : undefined
                }
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
          kanbanEvents={kanbanTimelineEvents.filter((e) => e.productId === selectedProduct.id)}
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
