"use client"

import { useUser } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Filter,
  Plus,
  ReceiptText,
  Search,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  currentIsoDate,
  formatMobileCurrency,
  formatMobileDate,
} from "@/components/mobile/mobile-format"
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

type TransactionKind = "income" | "expense"
type FinanceFilter = "month" | "income" | "expense" | "all"
type PaymentMethod = "pix" | "debit" | "credit" | "boleto"

const fieldClass =
  "mobile-tap w-full rounded-2xl border border-current/10 bg-current/4 px-4 text-base outline-none transition focus:border-current/30 focus:ring-2 focus:ring-[var(--mobile-accent)]/40"

export function MobileFinanceScreen() {
  const { user } = useUser()
  const userId = user?.id
  const searchParams = useSearchParams()
  const finance = useQuery(api.finance.getDashboardData, userId ? { userId } : "skip")
  const addTransaction = useMutation(api.finance.addTransaction)
  const addExpenseWithPayment = useMutation(api.finance.addExpenseWithPayment)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [filter, setFilter] = useState<FinanceFilter>("month")
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [form, setForm] = useState({
    kind: "expense" as TransactionKind,
    amount: "",
    date: currentIsoDate(),
    description: "",
    categoryId: "",
    paymentMethod: "pix" as PaymentMethod,
    installmentCount: "1",
    firstChargeDate: currentIsoDate(),
  })

  useEffect(() => {
    if (searchParams.get("novo") === "1") setSheetOpen(true)
  }, [searchParams])

  if (!userId || !finance) {
    return (
      <MobilePage>
        <MobileLoading label="Carregando financeiro" />
      </MobilePage>
    )
  }

  const month = new Date().toISOString().slice(0, 7)
  const monthRows = finance.transactions.filter((item) => item.date.startsWith(month))
  const income = monthRows
    .filter((item) => item.kind === "income")
    .reduce((total, item) => total + item.amount, 0)
  const expense = monthRows
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + item.amount, 0)
  const categoryById = new Map(finance.categories.map((category) => [category._id, category.name]))
  const normalizedSearch = search.trim().toLowerCase()
  const visibleRows = [...finance.transactions]
    .filter((item) => {
      if (filter === "month" && !item.date.startsWith(month)) return false
      if (filter === "income" && item.kind !== "income") return false
      if (filter === "expense" && item.kind !== "expense") return false
      if (!normalizedSearch) return true
      return (
        item.description.toLowerCase().includes(normalizedSearch) ||
        (categoryById.get(item.categoryId) || "").toLowerCase().includes(normalizedSearch)
      )
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!userId || !form.categoryId) return
    const amount = Number(form.amount.replace(",", "."))
    if (!Number.isFinite(amount) || amount <= 0 || !form.description.trim()) {
      setFeedback("Informe descrição e um valor válido.")
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      if (form.kind === "expense") {
        await addExpenseWithPayment({
          userId,
          amount,
          date: form.date,
          description: form.description.trim(),
          categoryId: form.categoryId as Id<"categories">,
          expenseType: "variable",
          periodicity: "one_time",
          paymentMethod: form.paymentMethod,
          installmentCount:
            form.paymentMethod === "credit"
              ? Math.min(24, Math.max(1, Number(form.installmentCount) || 1))
              : undefined,
          firstChargeDate: form.paymentMethod === "credit" ? form.firstChargeDate : undefined,
        })
      } else {
        await addTransaction({
          userId,
          kind: "income",
          amount,
          date: form.date,
          description: form.description.trim(),
          categoryId: form.categoryId as Id<"categories">,
          periodicity: "one_time",
        })
      }
      setForm((current) => ({ ...current, amount: "", description: "" }))
      setSheetOpen(false)
      setFeedback("Lançamento salvo.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <MobilePage>
      <MobileHero
        eyebrow="Financeiro"
        title={formatMobileCurrency(income - expense)}
        description="Resultado acumulado no mês atual."
        action={
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="mobile-tap mt-1 inline-flex items-center gap-2 rounded-2xl bg-[var(--mobile-accent)] px-4 text-sm font-black text-[#17352a]"
          >
            <Plus className="size-4" />
            Novo lançamento
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <MobileMetric label="Entradas" value={formatMobileCurrency(income)} tone="positive" />
        <MobileMetric label="Saídas" value={formatMobileCurrency(expense)} tone="danger" />
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl bg-[var(--mobile-card)] px-4 py-3 text-sm font-semibold shadow-sm">
          <CheckCircle2 className="size-4 text-emerald-600" />
          {feedback}
        </div>
      )}

      <MobileSection title="Movimentações" description={`${visibleRows.length} resultado(s)`}>
        <div className="flex gap-2">
          <label className="mobile-tap flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-[var(--mobile-card)] px-4 shadow-sm">
            <Search className="size-4 text-current/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar lançamento"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current/35"
            />
          </label>
          <button
            type="button"
            className="mobile-tap grid size-12 place-items-center rounded-2xl bg-[var(--mobile-card)] shadow-sm"
            onClick={() => {
              const order: FinanceFilter[] = ["month", "income", "expense", "all"]
              setFilter(order[(order.indexOf(filter) + 1) % order.length])
            }}
            aria-label="Mudar filtro"
          >
            <Filter className="size-5" />
          </button>
        </div>

        <div className="mobile-scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["month", "Este mês"],
              ["income", "Entradas"],
              ["expense", "Saídas"],
              ["all", "Tudo"],
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
          {visibleRows.slice(0, 60).map((transaction) => {
            const isIncome = transaction.kind === "income"
            const Icon = isIncome ? ArrowUpRight : ArrowDownRight
            return (
              <article
                key={transaction._id}
                className="flex items-center gap-3 rounded-[1.35rem] bg-[var(--mobile-card)] p-3.5 shadow-sm"
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-2xl",
                    isIncome ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/8 text-red-600",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {transaction.description}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[0.68rem] text-current/42">
                    <CalendarDays className="size-3" />
                    {formatMobileDate(transaction.date)} ·{" "}
                    {categoryById.get(transaction.categoryId)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-black tabular-nums">
                  {isIncome ? "+" : "−"}
                  {formatMobileCurrency(transaction.amount)}
                </span>
              </article>
            )
          })}
          {visibleRows.length === 0 && (
            <MobileEmpty
              icon={ReceiptText}
              title="Nada por aqui"
              description="Altere o filtro ou registre um novo lançamento."
            />
          )}
        </div>
      </MobileSection>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="mobile-tap fixed bottom-24 right-4 z-30 flex size-14 items-center justify-center rounded-[1.2rem] bg-[var(--mobile-ink)] text-[var(--mobile-accent)] shadow-[0_14px_32px_rgb(23_53_42/30%)] active:scale-95"
        aria-label="Novo lançamento"
      >
        <Plus className="size-6" />
      </button>

      <MobileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Novo lançamento"
        description="O mesmo lançamento do webapp, adaptado para preencher pelo celular."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-current/5 p-1.5">
            {(
              [
                ["expense", "Despesa"],
                ["income", "Receita"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((current) => ({ ...current, kind: value, categoryId: "" }))}
                className={cn(
                  "mobile-tap rounded-xl text-sm font-bold",
                  form.kind === value && "bg-[var(--mobile-ink)] text-[var(--mobile-surface)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-current/55">Valor</span>
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="0,00"
              className={`${fieldClass} mobile-display text-xl font-semibold`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-current/55">Descrição</span>
            <input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Ex.: Compra de embalagem"
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-current/55">Data</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, date: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-current/55">Categoria</span>
              <select
                value={form.categoryId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, categoryId: event.target.value }))
                }
                className={fieldClass}
              >
                <option value="">Selecionar</option>
                {finance.categories
                  .filter((category) => category.kind === form.kind)
                  .map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {form.kind === "expense" && (
            <div className="space-y-3 rounded-2xl bg-current/5 p-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-current/55">Forma de pagamento</span>
                <select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      paymentMethod: event.target.value as PaymentMethod,
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="pix">Pix</option>
                  <option value="debit">Débito</option>
                  <option value="credit">Crédito</option>
                  <option value="boleto">Boleto</option>
                </select>
              </label>
              {form.paymentMethod === "credit" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-current/55">Parcelas</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={form.installmentCount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          installmentCount: event.target.value,
                        }))
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-current/55">Primeira cobrança</span>
                    <input
                      type="date"
                      value={form.firstChargeDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          firstChargeDate: event.target.value,
                        }))
                      }
                      className={fieldClass}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          {finance.categories.filter((category) => category.kind === form.kind).length === 0 && (
            <p className="rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-800">
              Crie uma categoria pelo Financeiro no webapp antes do primeiro lançamento.
            </p>
          )}
          <button
            type="submit"
            disabled={saving || !form.categoryId}
            className="mobile-tap w-full rounded-2xl bg-[var(--mobile-accent)] px-4 text-sm font-black text-[#17352a] disabled:opacity-45"
          >
            {saving ? "Salvando..." : "Salvar lançamento"}
          </button>
        </form>
      </MobileSheet>
    </MobilePage>
  )
}
