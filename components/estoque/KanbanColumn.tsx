"use client"

import { useDroppable } from "@dnd-kit/core"
import { ChevronDown, ChevronRight, Package, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { KanbanStageIcon, kanbanStageStyle } from "./column-icons"
import type { KanbanColumnId, KanbanProduct } from "./types"
import { ProductCard } from "./ProductCard"

interface KanbanColumnProps {
  id: string
  label: string
  products: KanbanProduct[]
  droppable?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onHideColumn?: () => void
  onCardDetails: (product: KanbanProduct) => void
  onCardMoveTo: (product: KanbanProduct, target: KanbanColumnId) => void
  onCardDelete: (product: KanbanProduct) => void
  onToggleCardHidden?: (product: KanbanProduct) => void
}

export function KanbanColumn({
  id,
  label,
  products,
  droppable = true,
  collapsed = false,
  onToggleCollapsed,
  onHideColumn,
  onCardDetails,
  onCardMoveTo,
  onCardDelete,
  onToggleCardHidden,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable })
  const stage = kanbanStageStyle(id)
  const CollapseIcon = collapsed ? ChevronRight : ChevronDown

  return (
    <div className="flex w-[272px] shrink-0 flex-col">
      {/* Column header */}
      <div
        className={cn(
          "mb-3 flex items-center justify-between gap-1 rounded-lg border border-border bg-card/70 px-2 py-2.5 shadow-sm border-l-4",
          stage.border,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <KanbanStageIcon stageId={id} className={stage.icon} aria-hidden />
          <span className="truncate text-sm font-semibold leading-tight text-foreground">
            {label}
          </span>
        </div>
        <div className="flex shrink-0 items-center">
          {onToggleCollapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expandir coluna" : "Recolher coluna"}
            >
              <CollapseIcon className="h-4 w-4" />
            </Button>
          ) : null}
          {onHideColumn ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onHideColumn}
              aria-label="Esconder coluna"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            stage.badge,
          )}
        >
          {products.length}
        </span>
      </div>

      {/* Drop zone — quando colapsada mantém zona mínima para o drag-and-drop */}
      <div
        ref={setNodeRef}
        className={cn(
          !collapsed && "flex min-h-[200px] flex-1 flex-col gap-2 rounded-xl p-2 transition-colors",
          collapsed && "min-h-[8px] rounded-xl",
          !collapsed && (isOver ? "bg-muted/50 ring-2 ring-inset ring-border" : "bg-muted/20"),
        )}
      >
        {collapsed ? null : products.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Nenhum produto nesta etapa</p>
          </div>
        ) : (
          products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onDetails={() => onCardDetails(product)}
              onMoveTo={(status) => onCardMoveTo(product, status)}
              onDelete={() => onCardDelete(product)}
              onToggleHidden={onToggleCardHidden ? () => onToggleCardHidden(product) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}
