"use client"

import {
  AlertCircle,
  Box,
  ChevronRight,
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { formatMobileCurrency, formatMobileDate } from "@/components/mobile/mobile-format"
import {
  MobileEmpty,
  MobileHero,
  MobileLoading,
  MobileMetric,
  MobilePage,
  MobileSection,
} from "@/components/mobile/mobile-ui"
import { cn } from "@/lib/utils"

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string }
type MlAccount = { connected: boolean; mlNickname?: string | null }
type MlMetrics = {
  listingsTotal: number
  ordersTotal: number
  grossAmountSample: number
  sampleSize: number
  completedOrdersSample: number
  cancelledOrdersSample: number
  averageTicketSample: number
  lastOrderDate: string | null
}
type MlOrder = {
  id: string
  status: string
  dateCreated: string
  totalAmount: number
  buyerNickname: string
  shippingStatus: string
  items: Array<{ id: string; title: string; sku: string; quantity: number; unitPrice: number }>
}
type MlListing = {
  id: string
  title: string
  price: number
  available_quantity: number
  sold_quantity: number
  status: string
  sku?: string
  catalogListing?: boolean | null
}
type SalesTab = "summary" | "orders" | "listings"

async function loadApi<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" })
  const body = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || !body.ok || !body.data) throw new Error(body.error || "Falha ao carregar.")
  return body.data
}

const orderStatus: Record<string, string> = {
  paid: "Pago",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  payment_required: "Aguardando pagamento",
}

export function MobileSalesScreen() {
  const [tab, setTab] = useState<SalesTab>("summary")
  const [account, setAccount] = useState<MlAccount | null>(null)
  const [metrics, setMetrics] = useState<MlMetrics | null>(null)
  const [orders, setOrders] = useState<MlOrder[]>([])
  const [listings, setListings] = useState<MlListing[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const nextAccount = await loadApi<MlAccount>("/api/ml/account")
        if (!active) return
        setAccount(nextAccount)
        if (!nextAccount.connected) return
        const [nextMetrics, orderPayload, listingPayload] = await Promise.all([
          loadApi<MlMetrics>("/api/ml/metrics"),
          loadApi<{ orders: MlOrder[] }>("/api/ml/orders?limit=30&offset=0"),
          loadApi<{ listings: MlListing[] }>("/api/ml/listings?limit=30&offset=0"),
        ])
        if (!active) return
        setMetrics(nextMetrics)
        setOrders(orderPayload.orders)
        setListings(listingPayload.listings)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Falha ao carregar.")
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [refreshKey])

  const normalizedSearch = search.trim().toLowerCase()
  const visibleOrders = orders.filter((order) =>
    [order.id, order.buyerNickname, ...order.items.flatMap((item) => [item.title, item.sku])]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  )
  const visibleListings = listings.filter((listing) =>
    [listing.id, listing.title, listing.sku]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  )

  return (
    <MobilePage>
      <MobileHero
        eyebrow="Mercado Livre"
        title={
          account?.connected ? account.mlNickname || "Sua operação de vendas" : "Conecte sua loja"
        }
        description={
          account?.connected
            ? "Pedidos, anúncios e sinais comerciais em um formato feito para consulta rápida."
            : "Vincule sua conta para acompanhar a operação pelo celular."
        }
        action={
          account?.connected ? (
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="mobile-tap mt-1 inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 text-sm font-bold text-white"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Atualizar
            </button>
          ) : (
            <Link
              href="/mobile/integracoes"
              className="mobile-tap mt-1 inline-flex items-center rounded-2xl bg-[var(--mobile-accent)] px-4 text-sm font-black text-[#17352a]"
            >
              Configurar integração
            </Link>
          )
        }
      />

      {loading && !account ? (
        <MobileLoading label="Sincronizando Mercado Livre" />
      ) : error ? (
        <MobileEmpty
          icon={AlertCircle}
          title="Não foi possível carregar"
          description={error}
          action={
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="mobile-tap rounded-2xl bg-[var(--mobile-ink)] px-4 text-sm font-bold text-[var(--mobile-surface)]"
            >
              Tentar novamente
            </button>
          }
        />
      ) : !account?.connected ? (
        <MobileEmpty
          icon={Store}
          title="Mercado Livre desconectado"
          description="Conecte a conta uma vez para trazer pedidos, anúncios e métricas."
        />
      ) : (
        <>
          <div className="mobile-scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            <MobileMetric
              label="Pedidos"
              value={String(metrics?.ordersTotal ?? orders.length)}
              detail={`${metrics?.completedOrdersSample ?? 0} pagos na amostra`}
            />
            <MobileMetric
              label="Vendas recentes"
              value={formatMobileCurrency(metrics?.grossAmountSample ?? 0)}
              detail={`${metrics?.sampleSize ?? 0} pedidos analisados`}
              tone="positive"
            />
            <MobileMetric
              label="Ticket médio"
              value={formatMobileCurrency(metrics?.averageTicketSample ?? 0)}
            />
            <MobileMetric
              label="Anúncios"
              value={String(metrics?.listingsTotal ?? listings.length)}
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-[1.35rem] bg-[var(--mobile-card)] p-1.5 shadow-sm">
            {(
              [
                ["summary", "Resumo"],
                ["orders", "Pedidos"],
                ["listings", "Anúncios"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "mobile-tap rounded-2xl text-xs font-bold",
                  tab === value && "bg-[var(--mobile-ink)] text-[var(--mobile-surface)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab !== "summary" && (
            <label className="mobile-tap flex items-center gap-2 rounded-2xl bg-[var(--mobile-card)] px-4 shadow-sm">
              <Search className="size-4 text-current/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  tab === "orders" ? "Pedido, comprador ou produto" : "Anúncio, SKU ou MLB"
                }
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current/35"
              />
            </label>
          )}

          {tab === "summary" && (
            <MobileSection title="Pulso comercial" description="O que aconteceu mais recentemente">
              <div className="grid gap-3">
                <div className="rounded-[1.4rem] bg-[var(--mobile-card)] p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                      <CircleDollarSign className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">Última venda</p>
                      <p className="text-xs text-current/45">
                        {formatMobileDate(metrics?.lastOrderDate)}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className="mobile-tap flex items-center gap-3 rounded-[1.4rem] bg-[var(--mobile-card)] p-4 text-left shadow-sm"
                >
                  <ShoppingBag className="size-5 text-current/45" />
                  <span className="flex-1 text-sm font-bold">Abrir pedidos recentes</span>
                  <ChevronRight className="size-4 text-current/25" />
                </button>
                <button
                  type="button"
                  onClick={() => setTab("listings")}
                  className="mobile-tap flex items-center gap-3 rounded-[1.4rem] bg-[var(--mobile-card)] p-4 text-left shadow-sm"
                >
                  <Box className="size-5 text-current/45" />
                  <span className="flex-1 text-sm font-bold">Revisar anúncios e estoque</span>
                  <ChevronRight className="size-4 text-current/25" />
                </button>
              </div>
            </MobileSection>
          )}

          {tab === "orders" && (
            <MobileSection
              title="Pedidos recentes"
              description={`${visibleOrders.length} carregado(s)`}
            >
              <div className="space-y-2.5">
                {visibleOrders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-[1.4rem] bg-[var(--mobile-card)] p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-current/40">
                          #{order.id}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold">
                          {order.items[0]?.title || "Pedido Mercado Livre"}
                        </p>
                        <p className="mt-1 text-xs text-current/45">
                          {order.buyerNickname} · {formatMobileDate(order.dateCreated)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black tabular-nums">
                        {formatMobileCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-current/6 pt-3 text-xs">
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-700">
                        {orderStatus[order.status] || order.status}
                      </span>
                      <span className="text-current/45">{order.items.length} item(ns)</span>
                    </div>
                  </article>
                ))}
                {visibleOrders.length === 0 && (
                  <MobileEmpty
                    icon={ShoppingBag}
                    title="Nenhum pedido"
                    description="Não há pedidos que correspondam à busca."
                  />
                )}
              </div>
            </MobileSection>
          )}

          {tab === "listings" && (
            <MobileSection title="Anúncios" description={`${visibleListings.length} carregado(s)`}>
              <div className="space-y-2.5">
                {visibleListings.map((listing) => (
                  <article
                    key={listing.id}
                    className="flex items-center gap-3 rounded-[1.4rem] bg-[var(--mobile-card)] p-3.5 shadow-sm"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-current/5">
                      {listing.available_quantity > 0 ? (
                        <PackageCheck className="size-5 text-emerald-700" />
                      ) : (
                        <Box className="size-5 text-red-600" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{listing.title}</span>
                      <span className="mt-0.5 block text-[0.68rem] text-current/42">
                        {listing.id} · {listing.available_quantity} disponível(is)
                      </span>
                      <span className="mt-1 block text-xs font-black">
                        {formatMobileCurrency(listing.price)}
                      </span>
                    </span>
                  </article>
                ))}
                {visibleListings.length === 0 && (
                  <MobileEmpty
                    icon={Box}
                    title="Nenhum anúncio"
                    description="Não há anúncios que correspondam à busca."
                  />
                )}
              </div>
            </MobileSection>
          )}
        </>
      )}
    </MobilePage>
  )
}
