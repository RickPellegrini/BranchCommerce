"use client"

import { useDroppable } from "@dnd-kit/core"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KanbanProduct, KanbanStatus } from "./types"
import { ProductCard } from "./ProductCard"

interface KanbanColumnProps {
  id: string
  label: string
  emoji: string
  color: string
  products: KanbanProduct[]
  droppable?: boolean
  onCardDetails: (product: KanbanProduct) => void
  onCardMoveTo: (product: KanbanProduct, status: KanbanStatus) => void
  onCardDelete: (product: KanbanProduct) => void
}

export function KanbanColumn({
  id,
  label,
  emoji,
  color,
  products,
  droppable = true,
  onCardDetails,
  onCardMoveTo,
  onCardDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable })

  return (
    <div className="flex w-[272px] flex-shrink-0 flex-col">
      {/* Column header */}
      <div
        className="mb-3 flex items-center justify-between rounded-xl px-3 py-2"
        style={{
          backgroundColor: `${color}20`,
          borderLeft: `3px solid ${color}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span>{emoji}</span>
          <span className="text-sm font-semibold" style={{ color }}>
            {label}
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${color}30`, color }}
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
