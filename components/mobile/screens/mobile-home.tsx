"use client"

import { useUser } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  FileSearch,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  Store,
  WalletCards,
} from "lucide-react"
import Link from "next/link"

import { api } from "@/convex/_generated/api"
import { formatMobileCurrency, formatMobileDate } from "@/components/mobile/mobile-format"
import {
  MobileActionLink,
  MobileEmpty,
  MobileHero,
  MobileLoading,
  MobileMetric,
  MobilePage,
  MobileSection,
} from "@/components/mobile/mobile-ui"

export function MobileHomeScreen() {
  const { user } = useUser()
  const userId = user?.id
  const finance = useQuery(api.finance.getDashboardData, userId ? { userId } : "skip")
  const stock = useQuery(api.stock.getDashboardData, userId ? { userId } : "skip")

  if (!userId || !finance || !stock) {
    return (
      <MobilePage>
        <MobileLoading label="Montando sua visão de hoje" />
      </MobilePage>
    )
  }

  const month = new Date().toISOString().slice(0, 7)
  const monthTransactions = finance.transactions.filter((item) => item.date.startsWith(month))
  const income = monthTransactions
    .filter((item) => item.kind === "income")
    .reduce((total, item) => total + item.amount, 0)
  const expense = monthTransactions
    .filter((item) => item.kind === "expense")
    .reduce((total, item) => total + item.amount, 0)
  const lowStock = stock.products.filter(
    (product) => product.quantity > 0 && product.quantity <= product.minStock,
  )
  const outOfStock = stock.products.filter((product) => product.quantity === 0)
  const inTransit = stock.products.filter((product) => product.kanbanStatus === "in_transit")
  const openBills = finance.bills.filter((bill) => bill.status !== "paid")
  const categoryById = new Map(finance.categories.map((category) => [category._id, category.name]))
  const recentTransactions = [...finance.transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 4)
  const firstName = user.firstName || user.fullName?.split(" ")[0] || "Ricardo"

  return (
    <MobilePage>
      <MobileHero
        eyebrow="Seu negócio agora"
        title={`Olá, ${firstName}. O que precisa da sua atenção?`}
        description="Um resumo curto para decidir rápido, sem navegar por relatórios inteiros."
        action={
          <div className="flex gap-2 pt-1">
            <Link
              href="/mobile/financeiro?novo=1"
              className="mobile-tap inline-flex items-center gap-2 rounded-2xl bg-[var(--mobile-accent)] px-4 text-sm font-black text-[#17352a]"
            >
              <Plus className="size-4" />
              Lançar
            </Link>
            <Link
              href="/mobile/hunter"
              className="mobile-tap inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 text-sm font-bold text-white"
            >
              <Search className="size-4" />
              Analisar
            </Link>
          </div>
        }
      />

      <div className="mobile-scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        <MobileMetric
          label="Resultado do mês"
          value={formatMobileCurrency(income - expense)}
          detail={`${formatMobileCurrency(income)} entrou`}
          tone={income - expense >= 0 ? "positive" : "danger"}
        />
        <MobileMetric
          label="Saídas"
          value={formatMobileCurrency(expense)}
          detail={`${monthTransactions.length} movimentos`}
        />
        <MobileMetric
          label="Estoque crítico"
          value={String(lowStock.length + outOfStock.length)}
          detail={`${inTransit.length} em trânsito`}
          tone={lowStock.length + outOfStock.length > 0 ? "warning" : "positive"}
        />
      </div>

      <MobileSection title="Ações rápidas" description="As tarefas mais frequentes a um toque">
        <div className="grid grid-cols-2 gap-3">
          <MobileActionLink
            href="/mobile/financeiro?novo=1"
            icon={ReceiptText}
            label="Novo lançamento"
            detail="Receita ou despesa"
            accent
          />
          <MobileActionLink
            href="/mobile/estoque"
            icon={Boxes}
            label="Movimentar"
            detail="Entrada ou saída"
          />
          <MobileActionLink
            href="/mobile/vendas"
            icon={Store}
            label="Ver pedidos"
            detail="Mercado Livre"
          />
          <MobileActionLink
            href="/mobile/hunter"
            icon={FileSearch}
            label="Branch Hunter"
            detail="Buscar oportunidade"
          />
        </div>
      </MobileSection>

      <MobileSection
        title="Precisa de atenção"
        description="Pendências ordenadas por impacto"
        action={
          <Link href="/mobile/estoque" className="text-xs font-bold text-current/50">
            Ver tudo
          </Link>
        }
      >
        <div className="space-y-2.5">
          {outOfStock.length > 0 && (
            <Link
              href="/mobile/estoque?filtro=sem-estoque"
              className="mobile-tap flex items-center gap-3 rounded-[1.35rem] bg-[var(--mobile-card)] p-3.5 shadow-sm"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-red-500/10 text-red-600">
                <AlertTriangle className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {outOfStock.length} item(ns) sem estoque
                </span>
                <span className="block text-xs text-current/45">
                  Reponha antes de perder vendas
                </span>
              </span>
              <ChevronRight className="size-4 text-current/30" />
            </Link>
          )}
          {lowStock.length > 0 && (
            <Link
              href="/mobile/estoque?filtro=baixo"
              className="mobile-tap flex items-center gap-3 rounded-[1.35rem] bg-[var(--mobile-card)] p-3.5 shadow-sm"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-amber-500/12 text-amber-700">
                <Boxes className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {lowStock.length} próximo(s) do mínimo
                </span>
                <span className="block text-xs text-current/45">Planeje a próxima compra</span>
              </span>
              <ChevronRight className="size-4 text-current/30" />
            </Link>
          )}
          {openBills.length > 0 && (
            <Link
              href="/mobile/financeiro"
              className="mobile-tap flex items-center gap-3 rounded-[1.35rem] bg-[var(--mobile-card)] p-3.5 shadow-sm"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-orange-500/12 text-orange-700">
                <WalletCards className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {openBills.length} conta(s) em aberto
                </span>
                <span className="block text-xs text-current/45">Confira vencimentos e valores</span>
              </span>
              <ChevronRight className="size-4 text-current/30" />
            </Link>
          )}
          {outOfStock.length === 0 && lowStock.length === 0 && openBills.length === 0 && (
            <MobileEmpty
              icon={PackageCheck}
              title="Tudo sob controle"
              description="Não encontramos pendências críticas agora."
            />
          )}
        </div>
      </MobileSection>

      <MobileSection
        title="Últimos movimentos"
        description="Entradas e saídas financeiras recentes"
        action={
          <Link href="/mobile/financeiro" className="text-xs font-bold text-current/50">
            Histórico
          </Link>
        }
      >
        <div className="overflow-hidden rounded-[1.5rem] bg-[var(--mobile-card)] shadow-sm">
          {recentTransactions.map((transaction, index) => {
            const incomeTransaction = transaction.kind === "income"
            const Icon = incomeTransaction ? ArrowUpRight : ArrowDownRight
            return (
              <div
                key={transaction._id}
                className={`flex items-center gap-3 p-4 ${index > 0 ? "border-t border-current/6" : ""}`}
              >
                <span
                  className={`grid size-10 place-items-center rounded-2xl ${
                    incomeTransaction
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-red-500/8 text-red-600"
                  }`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {transaction.description}
                  </span>
                  <span className="block text-xs text-current/40">
                    {categoryById.get(transaction.categoryId) || "Sem categoria"} ·{" "}
                    {formatMobileDate(transaction.date)}
                  </span>
                </span>
                <span className="text-sm font-black tabular-nums">
                  {incomeTransaction ? "+" : "−"}
                  {formatMobileCurrency(transaction.amount)}
                </span>
              </div>
            )
          })}
          {recentTransactions.length === 0 && (
            <MobileEmpty
              icon={ReceiptText}
              title="Nenhum movimento"
              description="Seu próximo lançamento aparecerá aqui."
            />
          )}
        </div>
      </MobileSection>
    </MobilePage>
  )
}
