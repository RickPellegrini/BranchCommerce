"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Eye, EyeOff, GripVertical, MoreVertical, Package } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import { cn } from "@/lib/utils"
import { KanbanStageIcon } from "./column-icons"
import {
  type KanbanColumnId,
  type KanbanProduct,
  EM_FALTA_COLUMN,
  KANBAN_COLUMNS,
  getKanbanColumnId,
  getUrgency,
  urgencyColor,
  urgencyBorderClass,
} from "./types"

interface ProductCardProps {
  product: KanbanProduct
  isDragging?: boolean
  onDetails: () => void
  onMoveTo: (target: KanbanColumnId) => void
  onDelete: () => void
  onToggleHidden?: () => void
}

export function ProductCard({
  product,
  isDragging,
  onDetails,
  onMoveTo,
  onDelete,
  onToggleHidden,
}: ProductCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: product.id,
  })

  const urgency = getUrgency(product)
  const borderClass = urgencyBorderClass(urgency)
  const dotColor = urgencyColor(urgency)

  const style = { transform: CSS.Translate.toString(transform) }

  return (
    <div
      style={style}
      className={cn(
        "group relative flex gap-1.5 rounded-xl border border-border border-l-4 bg-card p-2 pr-3 shadow-sm",
        "transition-all duration-200",
        borderClass,
        isDragging
          ? "scale-105 cursor-grabbing opacity-50 shadow-xl"
          : "hover:scale-[1.02] hover:shadow-md",
      )}
    >
      <button
        type="button"
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          "mt-0.5 flex h-9 w-6 shrink-0 cursor-grab touch-none items-start justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
          isDragging && "cursor-grabbing",
        )}
        aria-label="Arrastar card"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onDetails}
          >
            {/* Thumbnail */}
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border bg-muted">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p title={product.name} className="truncate text-sm font-medium leading-tight">
                  {product.name}
                </p>
                {product.quantity === 0 && product.kanbanStatus === "in_stock" && (
                  <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                    Em falta
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.sku}</p>
            </div>
          </button>

          {onToggleHidden ? (
            <button
              type="button"
              className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title={product.kanbanHidden ? "Mostrar no quadro" : "Ocultar do quadro"}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleHidden()
              }}
            >
              {product.kanbanHidden ? (
                <Eye className="h-4 w-4" aria-hidden />
              ) : (
                <EyeOff className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}

          {/* 3-dot menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu.Item
                  className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none hover:bg-muted"
                  onClick={onDetails}
                >
                  Ver detalhes / atualizar status
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                {product.quantity > 0 && getKanbanColumnId(product) !== EM_FALTA_COLUMN.id && (
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none hover:bg-muted"
                    onClick={() => onMoveTo(EM_FALTA_COLUMN.id)}
                  >
                    <span className="flex items-center gap-2">
                      <KanbanStageIcon
                        stageId={EM_FALTA_COLUMN.id}
                        className="h-3.5 w-3.5 opacity-80"
                      />
                      <span>
                        Mover para <span className="font-medium">{EM_FALTA_COLUMN.label}</span>
                      </span>
                    </span>
                  </DropdownMenu.Item>
                )}
                {KANBAN_COLUMNS.filter((col) => {
                  if (col.id === getKanbanColumnId(product)) return false
                  if (col.id === "in_stock" && product.quantity <= 0) return false
                  return true
                }).map((col) => (
                  <DropdownMenu.Item
                    key={col.id}
                    className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none hover:bg-muted"
                    onClick={() => onMoveTo(col.id)}
                  >
                    <span className="flex items-center gap-2">
                      <KanbanStageIcon stageId={col.id} className="h-3.5 w-3.5 opacity-80" />
                      <span>
                        Mover para <span className="font-medium">{col.label}</span>
                      </span>
                    </span>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  className="cursor-pointer rounded px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10"
                  onClick={onDelete}
                >
                  Excluir
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <button
          type="button"
          className="mt-2 w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onDetails}
        >
          {/* Stock info */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
              <span className="text-muted-foreground">
                {product.quantity} / {product.minStock} min
              </span>
            </div>
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {product.category}
            </span>
          </div>

          {/* Estimated arrival */}
          {product.estimatedArrival &&
            (product.kanbanStatus === "buying" ||
              product.kanbanStatus === "in_transit" ||
              product.kanbanStatus === "awaiting_inspection") && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                🗓 {new Date(product.estimatedArrival + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
        </button>
      </div>
    </div>
  )
}
