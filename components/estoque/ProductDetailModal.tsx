"use client"

import { useState } from "react"
import { Dialog } from "radix-ui"
import { X, ChevronRight, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { KanbanStageIcon } from "./column-icons"
import {
  type KanbanColumnId,
  type KanbanProduct,
  type KanbanMovement,
  KANBAN_COLUMNS,
  getUrgency,
  urgencyColor,
  formatCurrencyBRL,
  MOVEMENT_LABELS,
} from "./types"

interface ProductDetailModalProps {
  product: KanbanProduct
  movements: KanbanMovement[]
  onClose: () => void
  onMoveTo: (target: KanbanColumnId, note?: string, estimatedArrival?: string) => Promise<void>
  onSaveEdits: (updates: Partial<KanbanProduct>) => Promise<void>
}

export function ProductDetailModal({
  product,
  movements,
  onClose,
  onMoveTo,
  onSaveEdits,
}: ProductDetailModalProps) {
  const [note, setNote] = useState(product.kanbanNote ?? "")
  const [estimatedArrival, setEstimatedArrival] = useState(product.estimatedArrival ?? "")
  const [editQuantity, setEditQuantity] = useState(String(product.quantity))
  const [editMinStock, setEditMinStock] = useState(String(product.minStock))
  const [saving, setSaving] = useState(false)

  const urgency = getUrgency(product)
  const dotColor = urgencyColor(urgency)

  const productMovements = movements
    .filter((m) => m.productId === product.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)

  const currentColIdx = KANBAN_COLUMNS.findIndex((c) => c.id === product.kanbanStatus)
  const nextCol = KANBAN_COLUMNS[currentColIdx + 1]

  async function handleSave() {
    setSaving(true)
    try {
      await onSaveEdits({
        quantity: Number(editQuantity),
        minStock: Number(editMinStock),
        kanbanNote: note || undefined,
        estimatedArrival: estimatedArrival || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveNext() {
    if (!nextCol) return
    setSaving(true)
    try {
      await onMoveTo(nextCol.id, note || undefined, estimatedArrival || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
          {/* Header */}
          <div className="mb-4 flex items-start gap-3">
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border bg-muted">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold">
                {product.name}
              </Dialog.Title>
              <p className="text-xs text-muted-foreground">{product.sku}</p>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid gap-5">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Categoria: </span>
                {product.category}
              </div>
              <div>
                <span className="text-muted-foreground">Estoque: </span>
                <span style={{ color: dotColor }}>{product.quantity}</span>
                {" / "}{product.minStock} min
              </div>
              {product.sellingPrice !== undefined && (
                <div>
                  <span className="text-muted-foreground">Preço: </span>
                  {formatCurrencyBRL(product.sellingPrice)}
                </div>
              )}
              {product.unitCost > 0 && (
                <div>
                  <span className="text-muted-foreground">Custo: </span>
                  {formatCurrencyBRL(product.unitCost)}
                </div>
              )}
              {product.mlItemId && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">ML ID: </span>
                  {product.mlItemId}
                </div>
              )}
            </div>

            {/* Edit fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Quantidade</label>
                <Input
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Estoque mínimo</label>
                <Input
                  type="number"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                />
              </div>
              {(product.kanbanStatus === "buying" || product.kanbanStatus === "in_transit") && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Chegada estimada</label>
                  <Input
                    type="date"
                    value={estimatedArrival}
                    onChange={(e) => setEstimatedArrival(e.target.value)}
                  />
                </div>
              )}
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">Observações</label>
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Adicione notas sobre este produto..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                Salvar alterações
              </Button>
              {nextCol && (
                <Button
                  onClick={handleMoveNext}
                  disabled={saving}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <KanbanStageIcon stageId={nextCol.id} className="h-3.5 w-3.5" />
                  Mover para {nextCol.label}
                  <ChevronRight className="ml-0.5 h-4 w-4 opacity-70" />
                </Button>
              )}
            </div>

            {/* Movement timeline */}
            {productMovements.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium">Histórico de movimentações</h4>
                <div className="space-y-2.5">
                  {productMovements.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground/40" />
                      <div>
                        <span className="font-medium">
                          {MOVEMENT_LABELS[m.type] ?? m.type}
                        </span>
                        {" · "}{m.quantity} un.{" · "}
                        {new Date(m.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {m.note && (
                          <p className="text-xs text-muted-foreground">{m.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
