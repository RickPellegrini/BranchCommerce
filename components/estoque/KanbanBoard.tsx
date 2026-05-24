"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import {
  Package,
  BarChart2,
  AlertCircle,
  TrendingDown,
  Truck,
  ClipboardList,
  Warehouse,
  RefreshCw,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { KanbanStageIcon } from "./column-icons"
import { KanbanColumn } from "./KanbanColumn"
import { SortableColumn } from "./SortableColumn"
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
const LS_HIDDEN_COLS = "branchcommerce.kanban.hiddenCols"
const LS_COL_ORDER = "branchcommerce.kanban.colOrder"

const DEFAULT_COL_IDS: KanbanColumnId[] = [EM_FALTA_COLUMN.id, ...KANBAN_COLUMNS.map((c) => c.id)]
const ALL_COLUMNS_MAP = Object.fromEntries(
  [EM_FALTA_COLUMN, ...KANBAN_COLUMNS].map((c) => [c.id, c]),
)
const MLB_CODE_REGEX = /^MLB\d+$/i

function isDefaultColumnId(id: string): id is KanbanColumnId {
  return DEFAULT_COL_IDS.some((defaultId) => defaultId === id)
}

function extractMlCodes(product: Pick<KanbanProduct, "mlItemId" | "mlItemAliases">): string[] {
  const candidates = [product.mlItemId, ...(product.mlItemAliases ?? [])]
  return [
    ...new Set(
      candidates
        .map((candidate) => normalizeMercadoLibreItemId(candidate?.trim() ?? ""))
        .filter((candidate) => MLB_CODE_REGEX.test(candidate)),
    ),
  ]
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
    kanbanCardId?: string,
  ) => Promise<void>
  onSaveProductEdits: (
    productId: string,
    updates: Partial<KanbanProduct>,
    kanbanCardId?: string,
  ) => Promise<void>
  onDeleteProduct: (productId: string, kanbanCardId?: string) => Promise<void>
  onToggleProductHidden?: (productId: string, hidden: boolean) => Promise<void>
  onAddKanbanCard?: (
    productId: string,
    target: KanbanColumnId,
    quantity: number,
    note?: string,
    estimatedArrival?: string,
  ) => Promise<void>
  onSyncWithMl?: () => Promise<void>
  onReconcileSales?: () => Promise<void>
  mlSyncing?: boolean
  mlSyncDisabled?: boolean
  kanbanTimelineEvents?: ProductKanbanEventRow[]
  onAddProduct?: () => void
  showAddForm?: boolean
}

export function KanbanBoard({
  products,
  movements,
  stockSummary,
  onUpdateKanbanStatus,
  onSaveProductEdits,
  onDeleteProduct,
  onToggleProductHidden,
  onAddKanbanCard,
  onSyncWithMl,
  onReconcileSales,
  mlSyncing = false,
  mlSyncDisabled = false,
  kanbanTimelineEvents = [],
  onAddProduct,
  showAddForm,
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
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = localStorage.getItem(LS_HIDDEN_COLS)
      if (!raw) return {}
      return JSON.parse(raw) as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_COL_IDS
    try {
      const raw = localStorage.getItem(LS_COL_ORDER)
      if (!raw) return DEFAULT_COL_IDS
      const saved = JSON.parse(raw) as string[]
      const missing = DEFAULT_COL_IDS.filter((id) => !saved.includes(id))
      return [...saved.filter(isDefaultColumnId), ...missing]
    } catch {
      return DEFAULT_COL_IDS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LS_HIDDEN_COLS, JSON.stringify(hiddenColumns))
    } catch {
      /* ignore */
    }
  }, [hiddenColumns])

  useEffect(() => {
    try {
      localStorage.setItem(LS_COL_ORDER, JSON.stringify(columnOrder))
    } catch {
      /* ignore */
    }
  }, [columnOrder])

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
      for (const mlCode of extractMlCodes(product)) {
        if (fallbackImageByMlCode[mlCode]) continue
        if (imageLookupFailures[mlCode]) continue
        nextCodes.add(mlCode)
      }
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
            const itemResponse = await fetch(
              `/api/ml/catalog/hub?action=item_detail&itemId=${encodeURIComponent(mlCode)}`,
              { cache: "no-store" },
            )
            const response = itemResponse.ok
              ? itemResponse
              : await fetch(
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
        const fallbackImage = extractMlCodes(product)
          .map((mlCode) => fallbackImageByMlCode[mlCode])
          .find(Boolean)
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
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.mlItemId ?? p.sku).toLowerCase().includes(q)
      )
        return false
      if (urgencyFilter !== "all" && getUrgency(p) !== urgencyFilter) return false
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false
      return true
    })
  }, [displayProducts, search, urgencyFilter, categoryFilter, showHidden])

  const activeProduct = activeId ? displayProducts.find((p) => p.id === activeId) : null
  const inTransitCount = displayProducts.filter((p) => p.kanbanStatus === "in_transit").length
  const compradoCount = displayProducts.filter((p) => isCompradoKanbanStatus(p.kanbanStatus)).length
  const fulfillmentCount = displayProducts.filter((p) => p.kanbanStatus === "fulfillment").length

  const visibleColumnIds = useMemo(
    () => columnOrder.filter((id) => !hiddenColumns[id]),
    [columnOrder, hiddenColumns],
  )

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
    void onUpdateKanbanStatus(
      product.stockProductId,
      target,
      undefined,
      undefined,
      product.kanbanCardId,
    )
  }

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setColumnOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string)
      const newIdx = prev.indexOf(over.id as string)
      if (oldIdx === -1 || newIdx === -1) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }, [])

  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
  )

  const getColumnProducts = useCallback(
    (colId: string) => {
      if (colId === EM_FALTA_COLUMN.id) {
        return filteredProducts.filter((p) => p.quantity === 0 && p.kanbanStatus === "in_stock")
      }
      if (colId === "in_stock") {
        return filteredProducts.filter((p) => p.kanbanStatus === "in_stock" && p.quantity > 0)
      }
      if (colId === "purchased") {
        return filteredProducts.filter((p) => isCompradoKanbanStatus(p.kanbanStatus))
      }
      if (colId === "fulfillment") {
        return filteredProducts.filter((p) => p.kanbanStatus === "fulfillment")
      }
      return filteredProducts.filter((p) => p.kanbanStatus === colId)
    },
    [filteredProducts],
  )

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-1">
      {/* KPI summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
        <SummaryKpi icon={Warehouse} label="Full (ML)" value={fulfillmentCount} />
        <SummaryKpi icon={ClipboardList} label="Comprado" value={compradoCount} />
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <KanbanFilters
          search={search}
          onSearch={setSearch}
          urgency={urgencyFilter}
          onUrgency={setUrgencyFilter}
          category={categoryFilter}
          onCategory={setCategoryFilter}
          categories={categories}
        />
        {onAddProduct && (
          <Button
            type="button"
            variant={showAddForm ? "secondary" : "default"}
            size="sm"
            className="shrink-0"
            onClick={onAddProduct}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar
          </Button>
        )}
        {onSyncWithMl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={mlSyncing || mlSyncDisabled}
            onClick={() => void onSyncWithMl()}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", mlSyncing && "animate-spin")} />
            {mlSyncing ? "Sincronizando…" : "Sync ML"}
          </Button>
        )}
        {onReconcileSales && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={mlSyncing || mlSyncDisabled}
            onClick={() => void onReconcileSales()}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", mlSyncing && "animate-spin")} />
            Reconciliar vendas
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0">
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                Colunas
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                Mostrar / esconder colunas
              </p>
              {columnOrder
                .map((colId) => {
                  const col = ALL_COLUMNS_MAP[colId]
                  if (!col) return null
                  return col
                })
                .filter((col): col is NonNullable<typeof col> => col !== null)
                .map((col) => {
                  const isHidden = !!hiddenColumns[col.id]
                  return (
                    <button
                      key={col.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      onClick={() =>
                        setHiddenColumns((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                      }
                    >
                      {isHidden ? (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-foreground" />
                      )}
                      <KanbanStageIcon
                        stageId={col.id}
                        className={cn("h-3.5 w-3.5", isHidden && "opacity-40")}
                      />
                      <span className={cn(isHidden && "text-muted-foreground line-through")}>
                        {col.label}
                      </span>
                    </button>
                  )
                })}
            </PopoverContent>
          </Popover>
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
      </div>

      {/* Column reorder layer */}
      <DndContext
        sensors={columnSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
        <SortableContext items={visibleColumnIds} strategy={horizontalListSortingStrategy}>
          {/* Card drag layer (nested inside column layout) */}
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="-mx-1 overflow-x-auto rounded-xl">
              <div className="flex min-w-max gap-4 px-1 pb-4 pt-1">
                {visibleColumnIds.map((colId) => {
                  const col = ALL_COLUMNS_MAP[colId]
                  if (!col) return null
                  return (
                    <SortableColumn key={colId} id={colId}>
                      <KanbanColumn
                        id={colId}
                        label={col.label}
                        droppable={col.droppable}
                        collapsed={!!collapsedByColumn[colId]}
                        onToggleCollapsed={() =>
                          setCollapsedByColumn((prev) => ({
                            ...prev,
                            [colId]: !prev[colId],
                          }))
                        }
                        onHideColumn={() =>
                          setHiddenColumns((prev) => ({ ...prev, [colId]: true }))
                        }
                        products={getColumnProducts(colId)}
                        onCardDetails={setSelectedProduct}
                        onCardMoveTo={(product, columnTarget) =>
                          void onUpdateKanbanStatus(
                            product.stockProductId,
                            columnTarget,
                            undefined,
                            undefined,
                            product.kanbanCardId,
                          )
                        }
                        onCardDelete={(product) =>
                          void onDeleteProduct(product.stockProductId, product.kanbanCardId)
                        }
                        onToggleCardHidden={
                          onToggleProductHidden
                            ? (product) =>
                                void onToggleProductHidden(
                                  product.stockProductId,
                                  !product.kanbanHidden,
                                )
                            : undefined
                        }
                      />
                    </SortableColumn>
                  )
                })}
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
        </SortableContext>
      </DndContext>

      {/* Detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          movements={movements}
          kanbanEvents={kanbanTimelineEvents.filter(
            (e) => e.productId === selectedProduct.stockProductId,
          )}
          onClose={() => setSelectedProduct(null)}
          onMoveTo={async (target, note, arrival) => {
            await onUpdateKanbanStatus(
              selectedProduct.stockProductId,
              target,
              note,
              arrival,
              selectedProduct.kanbanCardId,
            )
            setSelectedProduct(null)
          }}
          onSaveEdits={async (updates) => {
            await onSaveProductEdits(
              selectedProduct.stockProductId,
              updates,
              selectedProduct.kanbanCardId,
            )
            setSelectedProduct(null)
          }}
          onAddKanbanCard={
            onAddKanbanCard
              ? async (target, quantity, note, arrival) => {
                  await onAddKanbanCard(
                    selectedProduct.stockProductId,
                    target,
                    quantity,
                    note,
                    arrival,
                  )
                  setSelectedProduct(null)
                }
              : undefined
          }
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
