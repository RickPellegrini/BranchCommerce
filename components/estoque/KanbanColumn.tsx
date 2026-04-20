"use client"

import { useDroppable } from "@dnd-kit/core"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { KanbanStageIcon, kanbanStageStyle } from "./column-icons"
import type { KanbanColumnId, KanbanProduct } from "./types"
import { ProductCard } from "./ProductCard"

interface KanbanColumnProps {
  id: string
  label: string
  products: KanbanProduct[]
  droppable?: boolean
  onCardDetails: (product: KanbanProduct) => void
  onCardMoveTo: (product: KanbanProduct, target: KanbanColumnId) => void
  onCardDelete: (product: KanbanProduct) => void
}

export function KanbanColumn({
  id,
  label,
  products,
  droppable = true,
  onCardDetails,
  onCardMoveTo,
  onCardDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable })
  const stage = kanbanStageStyle(id)

  return (
    <div className="flex w-[272px] shrink-0 flex-col">
      {/* Column header */}
      <div
        className={cn(
          "mb-3 flex items-center justify-between rounded-lg border border-border bg-card/70 px-3 py-2.5 shadow-sm border-l-4",
          stage.border,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <KanbanStageIcon stageId={id} className={stage.icon} aria-hidden />
          <span className="truncate text-sm font-semibold leading-tight text-foreground">
            {label}
          </span>
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

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-2 rounded-xl p-2 transition-colors",
          isOver ? "bg-muted/50 ring-2 ring-inset ring-border" : "bg-muted/20",
        )}
      >
        {products.length === 0 ? (
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
            />
          ))
        )}
      </div>
    </div>
  )
}
