"use client"

import { useState } from "react"
import { Dialog } from "radix-ui"
import { X, ChevronRight, Package, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  getEffectiveKanbanStatusForUi,
  isCompradoKanbanStatus,
} from "./types"

export type ProductKanbanEventRow = {
  id: string
  productId: string
  fromStatus: string
  toStatus: string
  note?: string
  createdAt: number
}

interface ProductDetailModalProps {
  product: KanbanProduct
  movements: KanbanMovement[]
  kanbanEvents?: ProductKanbanEventRow[]
  onClose: () => void
  onMoveTo: (target: KanbanColumnId, note?: string, estimatedArrival?: string) => Promise<void>
  onSaveEdits: (updates: Partial<KanbanProduct>) => Promise<void>
  onAddKanbanCard?: (
    target: KanbanColumnId,
    quantity: number,
    note?: string,
    estimatedArrival?: string,
  ) => Promise<void>
}

export function ProductDetailModal({
  product,
  movements,
  kanbanEvents = [],
  onClose,
  onMoveTo,
  onSaveEdits,
  onAddKanbanCard,
}: ProductDetailModalProps) {
  const [note, setNote] = useState(product.kanbanNote ?? "")
  const [estimatedArrival, setEstimatedArrival] = useState(product.estimatedArrival ?? "")
  const [editQuantity, setEditQuantity] = useState(String(product.quantity))
  const [editMinStock, setEditMinStock] = useState(String(product.minStock))
  const [editUnitCost, setEditUnitCost] = useState(String(product.unitCost ?? 0))
  const [editMlItemId, setEditMlItemId] = useState(product.mlItemId ?? "")
  const [mlIdError, setMlIdError] = useState<string | null>(null)
  const [aliases, setAliases] = useState<string[]>(product.mlItemAliases ?? [])
  const [newAlias, setNewAlias] = useState("")
  const [aliasError, setAliasError] = useState<string | null>(null)
  const [newCardStatus, setNewCardStatus] = useState<KanbanColumnId>("fulfillment")
  const [newCardQuantity, setNewCardQuantity] = useState("")
  const [newCardError, setNewCardError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const urgency = getUrgency(product)
  const dotColor = urgencyColor(urgency)

  const productMovements = movements
    .filter((m) => m.productId === product.stockProductId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)

  const effectiveStatus = getEffectiveKanbanStatusForUi(product)
  const currentColIdx = KANBAN_COLUMNS.findIndex((c) => c.id === effectiveStatus)
  const nextCol = KANBAN_COLUMNS[currentColIdx + 1]

  const MLB_RE = /^MLB-?\d+$/i

  function addAlias() {
    setAliasError(null)
    const val = newAlias.trim().toUpperCase()
    if (!val) return
    if (!MLB_RE.test(val)) {
      setAliasError("Formato inválido. Use MLB1234567890.")
      return
    }
    const primary = editMlItemId.trim().toUpperCase()
    if (val === primary) {
      setAliasError("Este já é o ID principal.")
      return
    }
    if (aliases.some((a) => a.toUpperCase() === val)) {
      setAliasError("Alias já adicionado.")
      return
    }
    setAliases((prev) => [...prev, val])
    setNewAlias("")
  }

  function removeAlias(idx: number) {
    setAliases((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setMlIdError(null)
    setAliasError(null)
    const trimmedMlId = editMlItemId.trim()
    if (trimmedMlId && !MLB_RE.test(trimmedMlId)) {
      setMlIdError("Formato inválido. Use algo como MLB1234567890.")
      return
    }
    setSaving(true)
    try {
      await onSaveEdits({
        quantity: Number(editQuantity),
        minStock: Number(editMinStock),
        unitCost: Number(editUnitCost),
        kanbanNote: note || undefined,
        estimatedArrival: estimatedArrival || undefined,
        mlItemId: trimmedMlId || undefined,
        mlItemAliases: aliases,
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

  async function handleAddKanbanCard() {
    if (!onAddKanbanCard) return
    setNewCardError(null)
    const quantity = Number(newCardQuantity)
    if (!Number.isFinite(quantity) || quantity < 0) {
      setNewCardError("Informe uma quantidade valida para o novo card.")
      return
    }
    setSaving(true)
    try {
      await onAddKanbanCard(
        newCardStatus,
        quantity,
        note || undefined,
        estimatedArrival || undefined,
      )
      setNewCardQuantity("")
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
              <p className="font-mono text-xs text-muted-foreground">
                {product.mlItemId ?? product.sku}
              </p>
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
                {" / "}
                {product.minStock} min
              </div>
              {product.unitCost > 0 && (
                <div>
                  <span className="text-muted-foreground">Preço (custo): </span>
                  {formatCurrencyBRL(product.unitCost)}
                </div>
              )}
              {product.mlItemId && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">ML ID: </span>
                  {product.mlItemId}
                  {(product.mlItemAliases?.length ?? 0) > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      (+{product.mlItemAliases!.length} alias
                      {product.mlItemAliases!.length > 1 ? "es" : ""})
                    </span>
                  )}
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
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Preço (custo)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editUnitCost}
                  onChange={(e) => setEditUnitCost(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">MLB ID (principal)</label>
                <Input
                  type="text"
                  placeholder="Ex: MLB1234567890"
                  value={editMlItemId}
                  onChange={(e) => {
                    setEditMlItemId(e.target.value)
                    setMlIdError(null)
                  }}
                />
                {mlIdError && <p className="text-xs text-destructive">{mlIdError}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  MLB IDs extras (Full, Catálogo, etc.)
                </label>
                {aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {aliases.map((a, i) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs"
                      >
                        {a}
                        <button
                          type="button"
                          onClick={() => removeAlias(i)}
                          className="rounded hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Input
                    type="text"
                    placeholder="MLB..."
                    value={newAlias}
                    onChange={(e) => {
                      setNewAlias(e.target.value)
                      setAliasError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addAlias()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addAlias}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {aliasError && <p className="text-xs text-destructive">{aliasError}</p>}
              </div>
              {(isCompradoKanbanStatus(product.kanbanStatus) ||
                product.kanbanStatus === "in_transit" ||
                product.kanbanStatus === "awaiting_inspection") && (
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

            {onAddKanbanCard && (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
                <div className="mb-2">
                  <h4 className="text-sm font-medium">Card extra no Kanban</h4>
                  <p className="text-xs text-muted-foreground">
                    Use para o mesmo produto aparecer em outro estágio com outra quantidade.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                  <Select
                    value={newCardStatus}
                    onValueChange={(value) => setNewCardStatus(value as KanbanColumnId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {KANBAN_COLUMNS.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Qtd"
                    value={newCardQuantity}
                    onChange={(event) => {
                      setNewCardQuantity(event.target.value)
                      setNewCardError(null)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={handleAddKanbanCard}
                  >
                    Criar card
                  </Button>
                </div>
                {newCardError && <p className="mt-2 text-xs text-destructive">{newCardError}</p>}
              </div>
            )}

            {kanbanEvents.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium">Histórico de etapas (Kanban)</h4>
                <div className="space-y-2.5">
                  {kanbanEvents.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary/60" />
                      <div>
                        <span className="font-medium">
                          {ev.fromStatus} → {ev.toStatus}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {new Date(ev.createdAt).toLocaleString("pt-BR")}
                        </span>
                        {ev.note && <p className="text-xs text-muted-foreground">{ev.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Movement timeline */}
            {productMovements.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium">Histórico de movimentações</h4>
                <div className="space-y-2.5">
                  {productMovements.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground/40" />
                      <div>
                        <span className="font-medium">{MOVEMENT_LABELS[m.type] ?? m.type}</span>
                        {" · "}
                        {m.quantity} un.{" · "}
                        {new Date(m.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
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
