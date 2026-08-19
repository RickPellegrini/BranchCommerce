"use client"

import { useUser } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ChevronRight,
  PackageOpen,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { api } from "@/convex/_generated/api"
import { currentIsoDate, formatMobileCurrency } from "@/components/mobile/mobile-format"
import { MobileSheet } from "@/components/mobile/mobile-sheet"
import {
  MobileEmpty,
  MobileHero,
  MobileLoading,
  MobileMetric,
  MobilePage,
  MobileSection,
} from "@/components/mobile/mobile-ui"
import { cn } from "@/lib/utils"
import { compareMobileStockProducts, nextStockQuantity } from "@/lib/mobile/stock"

type Product = Doc<"stockProducts">
type StockFilter = "all" | "low" | "empty" | "transit" | "full"
type MovementType = "in" | "out" | "sale" | "adjustment"

const statusLabels: Record<string, string> = {
  purchased: "Comprado",
  planned: "Planejado",
  buying: "Em compra",
  in_transit: "Em trânsito",
  awaiting_inspection: "Aguardando conferência",
  returned: "Devolvido",
  completed: "Concluído",
  in_stock: "Estoque físico",
  fulfillment: "Full",
}

const fieldClass =
  "mobile-tap w-full rounded-2xl border border-current/10 bg-current/4 px-4 text-base outline-none focus:border-current/30 focus:ring-2 focus:ring-[var(--mobile-accent)]/40"

export function MobileStockScreen() {
  const { user } = useUser()
  const userId = user?.id
  const searchParams = useSearchParams()
  const stock = useQuery(api.stock.getDashboardData, userId ? { userId } : "skip")
  const addMovement = useMutation(api.stock.addMovement)
  const [filter, setFilter] = useState<StockFilter>("all")
  const [search, setSearch] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [movementType, setMovementType] = useState<MovementType>("in")
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const requested = searchParams.get("filtro")
    if (requested === "baixo") setFilter("low")
    if (requested === "sem-estoque") setFilter("empty")
  }, [searchParams])

  if (!userId || !stock) {
    return (
      <MobilePage>
        <MobileLoading label="Contando seu estoque" />
      </MobilePage>
    )
  }

  const lowStock = stock.products.filter(
    (product) => product.quantity > 0 && product.quantity <= product.minStock,
  )
  const emptyStock = stock.products.filter((product) => product.quantity === 0)
  const transitStock = stock.products.filter((product) => product.kanbanStatus === "in_transit")
  const inventoryValue = stock.products.reduce(
    (total, product) => total + product.quantity * product.unitCost,
    0,
  )
  const normalizedSearch = search.trim().toLowerCase()
  const visibleProducts = [...stock.products]
    .filter((product) => {
      if (filter === "low" && !(product.quantity > 0 && product.quantity <= product.minStock))
        return false
      if (filter === "empty" && product.quantity !== 0) return false
      if (filter === "transit" && product.kanbanStatus !== "in_transit") return false
      if (filter === "full" && product.kanbanStatus !== "fulfillment") return false
      if (!normalizedSearch) return true
      return [product.name, product.sku, product.mlItemId, product.category]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    })
    .sort(compareMobileStockProducts)

  async function saveMovement(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedProduct || !userId) return
    const parsedQuantity = Number(quantity.replace(",", "."))
    const requiresPositiveQuantity = movementType !== "adjustment"
    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity < 0 ||
      (requiresPositiveQuantity && parsedQuantity === 0)
    ) {
      setFeedback("Informe uma quantidade válida.")
      return
    }
    if (
      (movementType === "out" || movementType === "sale") &&
      parsedQuantity > selectedProduct.quantity
    ) {
      setFeedback(`Há somente ${selectedProduct.quantity} unidade(s) disponível(is).`)
      return
    }

    const parsedUnitPrice = unitPrice ? Number(unitPrice.replace(",", ".")) : undefined
    const effectiveSalePrice = parsedUnitPrice ?? selectedProduct.sellingPrice ?? 0
    if (
      movementType === "sale" &&
      (!Number.isFinite(effectiveSalePrice) || effectiveSalePrice <= 0)
    ) {
      setFeedback("Informe um valor unitário válido para registrar a receita.")
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      await addMovement({
        userId,
        productId: selectedProduct._id,
        type: movementType,
        quantity: parsedQuantity,
        date: currentIsoDate(),
        unitPrice: movementType === "sale" ? effectiveSalePrice : undefined,
        note: note.trim() || undefined,
      })
      setSelectedProduct(null)
      setQuantity("")
      setUnitPrice("")
      setNote("")
      setFeedback("Estoque atualizado.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível movimentar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <MobilePage>
      <MobileHero
        eyebrow="Operação de estoque"
        title={`${stock.products.length} produtos sob controle`}
        description="Itens disponíveis aparecem primeiro; alertas e itens zerados continuam acessíveis pelos filtros."
      />

      <div className="mobile-scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        <MobileMetric label="Valor em estoque" value={formatMobileCurrency(inventoryValue)} />
        <MobileMetric
          label="Abaixo do mínimo"
          value={String(lowStock.length)}
          tone={lowStock.length ? "warning" : "positive"}
        />
        <MobileMetric
          label="Sem estoque"
          value={String(emptyStock.length)}
          tone={emptyStock.length ? "danger" : "positive"}
        />
        <MobileMetric label="Em trânsito" value={String(transitStock.length)} />
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl bg-[var(--mobile-card)] px-4 py-3 text-sm font-semibold shadow-sm">
          <CheckCircle2 className="size-4 text-emerald-600" />
          {feedback}
        </div>
      )}

      <MobileSection title="Produtos" description={`${visibleProducts.length} resultado(s)`}>
        <label className="mobile-tap flex items-center gap-2 rounded-2xl bg-[var(--mobile-card)] px-4 shadow-sm">
          <Search className="size-4 text-current/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, SKU ou MLB"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current/35"
          />
        </label>

        <div className="mobile-scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", "Todos"],
              ["low", "Baixo"],
              ["empty", "Sem estoque"],
              ["transit", "Em trânsito"],
              ["full", "Full"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "mobile-tap shrink-0 rounded-2xl px-4 text-xs font-bold",
                filter === value
                  ? "bg-[var(--mobile-ink)] text-[var(--mobile-surface)]"
                  : "bg-[var(--mobile-card)] text-current/55",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {visibleProducts.map((product) => {
            const isEmpty = product.quantity === 0
            const isLow = !isEmpty && product.quantity <= product.minStock
            return (
              <button
                key={product._id}
                type="button"
                onClick={() => {
                  setSelectedProduct(product)
                  setMovementType("in")
                  setQuantity("")
                  setUnitPrice(product.sellingPrice ? String(product.sellingPrice) : "")
                  setNote("")
                }}
                className="mobile-tap flex w-full items-center gap-3 rounded-[1.4rem] bg-[var(--mobile-card)] p-3.5 text-left shadow-sm active:scale-[0.985]"
              >
                <span
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-2xl font-black",
                    isEmpty
                      ? "bg-red-500/10 text-red-600"
                      : isLow
                        ? "bg-amber-500/12 text-amber-700"
                        : "bg-emerald-500/10 text-emerald-700",
                  )}
                >
                  {isEmpty ? (
                    <PackageOpen className="size-5" />
                  ) : product.kanbanStatus === "in_transit" ? (
                    <Truck className="size-5" />
                  ) : (
                    product.quantity
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{product.name}</span>
                  <span className="mt-0.5 block truncate text-[0.68rem] text-current/42">
                    {product.sku || product.mlItemId || "Sem SKU"} ·{" "}
                    {statusLabels[product.kanbanStatus || "in_stock"]}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-current/65">
                    {product.quantity} un. · mínimo {product.minStock}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-current/25" />
              </button>
            )
          })}
          {visibleProducts.length === 0 && (
            <MobileEmpty
              icon={Boxes}
              title="Nenhum produto encontrado"
              description="Altere o filtro ou a busca para ver outros itens."
            />
          )}
        </div>
      </MobileSection>

      <MobileSheet
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        title={selectedProduct?.name || "Movimentar estoque"}
        description={`${selectedProduct?.quantity ?? 0} unidade(s) disponíveis agora`}
      >
        {selectedProduct && (
          <form className="space-y-4" onSubmit={saveMovement}>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-current/5 p-1.5">
              {(
                [
                  ["in", "Entrada", ArrowDownToLine],
                  ["out", "Saída", ArrowUpFromLine],
                  ["sale", "Venda", ShoppingCart],
                  ["adjustment", "Ajustar", AlertTriangle],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMovementType(value)}
                  className={cn(
                    "mobile-tap flex flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold",
                    movementType === value && "bg-[var(--mobile-ink)] text-[var(--mobile-surface)]",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-current/55">
                {movementType === "adjustment" ? "Novo total" : "Quantidade"}
              </span>
              <input
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
                className={`${fieldClass} mobile-display text-xl font-semibold`}
              />
            </label>
            {movementType === "sale" && (
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-current/55">Valor unitário da venda</span>
                <input
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  placeholder="0,00"
                  className={`${fieldClass} mobile-display text-xl font-semibold`}
                />
              </label>
            )}
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-current/55">Observação</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Opcional"
                className={fieldClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-current/5 p-3 text-xs">
              <div>
                <p className="text-current/45">Custo unitário</p>
                <p className="mt-1 font-bold">{formatMobileCurrency(selectedProduct.unitCost)}</p>
              </div>
              <div>
                <p className="text-current/45">Etapa</p>
                <p className="mt-1 font-bold">
                  {statusLabels[selectedProduct.kanbanStatus || "in_stock"]}
                </p>
              </div>
            </div>
            {quantity && Number.isFinite(Number(quantity.replace(",", "."))) && (
              <div className="flex items-center justify-between rounded-2xl border border-current/10 px-4 py-3 text-sm">
                <span className="text-current/55">Estoque depois</span>
                <strong className="tabular-nums">
                  {Math.max(
                    0,
                    nextStockQuantity(
                      selectedProduct.quantity,
                      movementType,
                      Number(quantity.replace(",", ".")),
                    ),
                  )}{" "}
                  un.
                </strong>
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="mobile-tap w-full rounded-2xl bg-[var(--mobile-accent)] text-sm font-black text-[#17352a] disabled:opacity-45"
            >
              {saving
                ? "Atualizando..."
                : movementType === "sale"
                  ? "Registrar venda e receita"
                  : "Confirmar movimentação"}
            </button>
          </form>
        )}
      </MobileSheet>
    </MobilePage>
  )
}
