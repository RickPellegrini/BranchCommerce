"use client"

import type { AnalysisDataSource, CatalogSection } from "@/features/product-analysis/domain/types"
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

/** Rotulos em portugues para os criterios da checklist (score interno BranchCommerce, nao e nota do ML). */
const COMPLETENESS_FIELD_LABELS: Record<string, string> = {
  catalog_product_id: "Vinculo ao catalogo ML",
  gtin: "Codigo de barras (GTIN)",
  brand: "Marca preenchida",
  model: "Modelo preenchido",
  "pictures_3+": "3 ou mais fotos",
  "attributes_5+": "5 ou mais atributos",
  free_shipping: "Frete gratis",
  original_price: "Preco promocional (original > atual)",
  condition_new: "Condicao: novo",
  stock_positive: "Estoque disponivel",
}

function completenessFieldLabel(field: string): string {
  return COMPLETENESS_FIELD_LABELS[field] ?? field.replace(/_/g, " ")
}

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  linked: {
    label: "Vinculado ao Catalogo",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  eligible: {
    label: "Elegivel",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  not_catalog: {
    label: "Fora do Catalogo",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
  undetermined: {
    label: "Indeterminado",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border",
  },
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
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function PriceToWinCard({ ptw }: { ptw: NonNullable<CatalogSection["priceToWin"]> }) {
  const statusColors: Record<string, string> = {
    winning: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    competing: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
    sharing_first_place: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    listed: "bg-muted text-muted-foreground",
  }
  const statusLabels: Record<string, string> = {
    winning: "Ganhando",
    competing: "Perdendo",
    sharing_first_place: "Dividindo 1o",
    listed: "Listado",
  }
  const diff =
    ptw.current_price != null && ptw.price_to_win != null
      ? ptw.current_price - ptw.price_to_win
      : null

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
          <Trophy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Price to Win
        </h4>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColors[ptw.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {statusLabels[ptw.status] ?? ptw.status}
          </span>
        </div>
        {ptw.price_to_win != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Preco alvo</span>
            <span className="text-sm font-bold text-blue-600">{formatBrl(ptw.price_to_win)}</span>
          </div>
        )}
        {diff != null && Math.abs(diff) >= 0.01 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Diferenca para ganhar</span>
            <span
              className={
                diff > 0
                  ? "text-sm font-semibold text-rose-600"
                  : "text-sm font-semibold text-emerald-600"
              }
            >
              {diff > 0 ? "-" : "+"}
              {formatBrl(Math.abs(diff))}
            </span>
          </div>
        )}
        {ptw.visit_share != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Share visitas</span>
            <span
              className={`text-xs font-medium ${
                ptw.visit_share === "maximum"
                  ? "text-emerald-600"
                  : ptw.visit_share === "medium"
                    ? "text-amber-600"
                    : "text-rose-600"
              }`}
            >
              {ptw.visit_share === "maximum"
                ? "Maximo"
                : ptw.visit_share === "medium"
                  ? "Medio"
                  : "Minimo"}
            </span>
          </div>
        )}
        {ptw.winner && ptw.winner.price != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Preco ganhador</span>
            <span className="text-sm font-semibold">{formatBrl(ptw.winner.price)}</span>
          </div>
        )}
        {ptw.reason && ptw.reason.length > 0 && (
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Motivo: {ptw.reason.join(", ")}
          </div>
        )}
        {ptw.boosts && ptw.boosts.length > 0 && (
          <div className="space-y-1">
            {ptw.boosts.slice(0, 3).map((boost, index) => (
              <div
                key={`${boost.id ?? "boost"}-${index}`}
                className="text-[11px] text-muted-foreground"
              >
                {boost.description ?? boost.id}: {boost.status ?? "-"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PriceToWinUnavailableCard({ source }: { source?: AnalysisDataSource }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Price to Win
        </h4>
      </div>
      <p className="text-sm font-semibold text-foreground">Buy Box nao confirmado</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {source?.error ?? source?.detail ?? "O Mercado Livre nao retornou dados de Price to Win."}
      </p>
    </div>
  )
}

export function CatalogOverview({
  data,
  priceToWinSource,
}: {
  data: CatalogSection
  priceToWinSource?: AnalysisDataSource
}) {
  const sc = statusConfig[data.status] ?? statusConfig.undetermined
  const { item } = data
  const ptw = data.priceToWin

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex gap-4">
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-24 w-24 rounded-xl object-cover border shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sc.bg} ${sc.text} ${sc.border}`}
              >
                <StatusIcon status={data.status} />
                {sc.label}
              </span>
              {data.catalogProductId && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
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
          iconBg="bg-blue-50 dark:bg-blue-950/30"
          label="Estoque"
          value={item.stock ?? "-"}
        />
        <MetricCard
          icon={<BarChart3 className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-950/30"
          label="Vendidos"
          value={item.sold ?? "-"}
        />
        <MetricCard
          icon={<Eye className="h-4 w-4 text-cyan-600" />}
          iconBg="bg-cyan-50 dark:bg-cyan-950/30"
          label="Visitas 7d"
          value={data.visits["7d"] ?? "-"}
        />
        <MetricCard
          icon={<Eye className="h-4 w-4 text-teal-600" />}
          iconBg="bg-teal-50 dark:bg-teal-950/30"
          label="Visitas 30d"
          value={data.visits["30d"] ?? "-"}
        />
        <MetricCard
          icon={<Truck className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/30"
          label="Frete"
          value={item.freeShipping ? "Gratis" : "Pago"}
          sub={item.shippingType ?? undefined}
        />
        <MetricCard
          icon={<Store className="h-4 w-4 text-indigo-600" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/30"
          label="Loja Oficial"
          value={item.officialStore ? "Sim" : "Nao"}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-50 dark:bg-amber-950/30"
          label="Tipo"
          value={
            item.listingType === "gold_pro"
              ? "Premium"
              : item.listingType === "gold_special"
                ? "Classico"
                : item.listingType
          }
        />
        <MetricCard
          icon={<Award className="h-4 w-4 text-rose-600" />}
          iconBg="bg-rose-50 dark:bg-rose-950/30"
          label="Idade"
          value={`${item.ageDays}d`}
        />
      </div>

      {/* Price to Win + Completeness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ptw ? (
          <PriceToWinCard ptw={ptw} />
        ) : (
          <PriceToWinUnavailableCard source={priceToWinSource} />
        )}

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Qualidade do anuncio
                </h4>
                <span className="shrink-0 text-lg font-bold tabular-nums">
                  {data.completenessScore}%
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Checklist interno: o quanto seu anuncio preenche boas praticas (fotos, catalogo,
                frete, etc.). Nao e pontuacao oficial do Mercado Livre — serve para voce ver o que
                falta melhorar.
              </p>
            </div>
          </div>
          <div className="mb-3 h-2.5 w-full rounded-full bg-muted">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                data.completenessScore >= 80
                  ? "bg-primary"
                  : data.completenessScore >= 50
                    ? "bg-chart-4"
                    : "bg-destructive"
              }`}
              style={{ width: `${data.completenessScore}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {data.completenessDetails.map((d) => (
              <div key={d.field} className="flex items-center gap-1.5 text-[11px]">
                {d.present ? (
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                )}
                <span
                  className={d.present ? "font-medium text-foreground" : "text-muted-foreground"}
                >
                  {completenessFieldLabel(d.field)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Identifiers */}
      {(data.identifiers.hasBrand || data.identifiers.hasModel || data.identifiers.hasGtin) && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/30">
              <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Identificadores
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.identifiers.brand && (
              <span className="inline-flex items-center rounded-lg border bg-muted/50 px-3 py-1.5 text-xs font-medium">
                Marca: <span className="ml-1 font-semibold">{data.identifiers.brand}</span>
              </span>
            )}
            {data.identifiers.model && (
              <span className="inline-flex items-center rounded-lg border bg-muted/50 px-3 py-1.5 text-xs font-medium">
                Modelo: <span className="ml-1 font-semibold">{data.identifiers.model}</span>
              </span>
            )}
            {data.identifiers.gtin && (
              <span className="inline-flex items-center rounded-lg border bg-muted/50 px-3 py-1.5 text-xs font-medium">
                GTIN: <span className="ml-1 font-mono font-semibold">{data.identifiers.gtin}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
