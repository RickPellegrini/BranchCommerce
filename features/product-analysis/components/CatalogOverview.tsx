"use client"

import type { CatalogSection } from "@/features/product-analysis/domain/types"
import { formatBrl } from "@/features/product-analysis/utils/money"
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
  Eye,
  Tag,
  Truck,
  Store,
  BarChart3,
  Award,
  ShieldCheck,
  Trophy,
  TrendingUp,
} from "lucide-react"

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  linked: { label: "Vinculado ao Catalogo", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  eligible: { label: "Elegivel", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  not_catalog: { label: "Fora do Catalogo", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  undetermined: { label: "Indeterminado", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" },
}

function StatusIcon({ status }: { status: string }) {
  if (status === "linked") return <CheckCircle className="h-4 w-4 text-emerald-600" />
  if (status === "eligible") return <AlertCircle className="h-4 w-4 text-amber-600" />
  return <XCircle className="h-4 w-4 text-rose-500" />
}

function MetricCard({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function PriceToWinCard({ ptw }: { ptw: NonNullable<CatalogSection["priceToWin"]> }) {
  const statusColors: Record<string, string> = {
    winning: "bg-emerald-100 text-emerald-700",
    competing: "bg-rose-100 text-rose-700",
    sharing_first_place: "bg-amber-100 text-amber-700",
    listed: "bg-gray-100 text-gray-600",
  }
  const statusLabels: Record<string, string> = {
    winning: "Ganhando",
    competing: "Perdendo",
    sharing_first_place: "Dividindo 1o",
    listed: "Listado",
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
          <Trophy className="h-4 w-4 text-blue-600" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price to Win</h4>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColors[ptw.status] ?? "bg-gray-100 text-gray-600"}`}>
            {statusLabels[ptw.status] ?? ptw.status}
          </span>
        </div>
        {ptw.price_to_win != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Preco alvo</span>
            <span className="text-sm font-bold text-blue-600">{formatBrl(ptw.price_to_win)}</span>
          </div>
        )}
        {ptw.visit_share != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Share visitas</span>
            <span className={`text-xs font-medium ${
              ptw.visit_share === "maximum" ? "text-emerald-600" :
              ptw.visit_share === "medium" ? "text-amber-600" : "text-rose-600"
            }`}>
              {ptw.visit_share === "maximum" ? "Maximo" : ptw.visit_share === "medium" ? "Medio" : "Minimo"}
            </span>
          </div>
        )}
        {ptw.winner && ptw.winner.price != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Preco ganhador</span>
            <span className="text-sm font-semibold">{formatBrl(ptw.winner.price)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function CatalogOverview({ data }: { data: CatalogSection }) {
  const sc = statusConfig[data.status] ?? statusConfig.undetermined
  const { item } = data
  const ptw = data.priceToWin

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-24 w-24 rounded-xl object-cover border shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sc.bg} ${sc.text} ${sc.border}`}>
                <StatusIcon status={data.status} />
                {sc.label}
              </span>
              {data.catalogProductId && (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {data.catalogProductId}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-2">{item.title}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-600">{formatBrl(item.price)}</span>
              {item.originalPrice && item.originalPrice > item.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatBrl(item.originalPrice)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Package className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          label="Estoque"
          value={item.stock}
        />
        <MetricCard
          icon={<BarChart3 className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-50"
          label="Vendidos"
          value={item.sold}
        />
        <MetricCard
          icon={<Eye className="h-4 w-4 text-cyan-600" />}
          iconBg="bg-cyan-50"
          label="Visitas 7d"
          value={data.visits["7d"] ?? "-"}
        />
        <MetricCard
          icon={<Eye className="h-4 w-4 text-teal-600" />}
          iconBg="bg-teal-50"
          label="Visitas 30d"
          value={data.visits["30d"] ?? "-"}
        />
        <MetricCard
          icon={<Truck className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Frete"
          value={item.freeShipping ? "Gratis" : "Pago"}
          sub={item.shippingType ?? undefined}
        />
        <MetricCard
          icon={<Store className="h-4 w-4 text-indigo-600" />}
          iconBg="bg-indigo-50"
          label="Loja Oficial"
          value={item.officialStore ? "Sim" : "Nao"}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-50"
          label="Tipo"
          value={item.listingType === "gold_pro" ? "Premium" : item.listingType === "gold_special" ? "Classico" : item.listingType}
        />
        <MetricCard
          icon={<Award className="h-4 w-4 text-rose-600" />}
          iconBg="bg-rose-50"
          label="Idade"
          value={`${item.ageDays}d`}
        />
      </div>

      {/* Price to Win + Completeness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ptw && <PriceToWinCard ptw={ptw} />}

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completude</h4>
            <span className="ml-auto text-lg font-bold">{data.completenessScore}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${data.completenessScore}%`,
                backgroundColor:
                  data.completenessScore >= 80 ? "#10b981" : data.completenessScore >= 50 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {data.completenessDetails.map((d) => (
              <div key={d.field} className="flex items-center gap-1.5 text-[11px]">
                {d.present ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                )}
                <span className={d.present ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {d.field.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Identifiers */}
      {(data.identifiers.hasBrand || data.identifiers.hasModel || data.identifiers.hasGtin) && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <Tag className="h-4 w-4 text-purple-600" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identificadores</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.identifiers.brand && (
              <span className="inline-flex items-center rounded-lg border bg-gray-50 px-3 py-1.5 text-xs font-medium">
                Marca: <span className="ml-1 font-semibold">{data.identifiers.brand}</span>
              </span>
            )}
            {data.identifiers.model && (
              <span className="inline-flex items-center rounded-lg border bg-gray-50 px-3 py-1.5 text-xs font-medium">
                Modelo: <span className="ml-1 font-semibold">{data.identifiers.model}</span>
              </span>
            )}
            {data.identifiers.gtin && (
              <span className="inline-flex items-center rounded-lg border bg-gray-50 px-3 py-1.5 text-xs font-medium">
                GTIN: <span className="ml-1 font-mono font-semibold">{data.identifiers.gtin}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
