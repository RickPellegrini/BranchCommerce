"use client"

import type { CompetitorSummary as Summary } from "@/features/product-analysis/domain/types"
import { formatBrl } from "@/features/product-analysis/utils/money"
import {
  Users,
  TrendingDown,
  TrendingUp,
  Target,
  DollarSign,
  Store,
  Truck,
  Zap,
} from "lucide-react"

function SummaryCard({
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
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-base font-bold leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  )
}

export function CompetitorSummaryCards({ summary, myPrice }: { summary: Summary; myPrice: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <SummaryCard
        icon={<Users className="h-5 w-5 text-blue-600" />}
        iconBg="bg-blue-50"
        label="Concorrentes"
        value={summary.count}
      />
      <SummaryCard
        icon={<TrendingDown className="h-5 w-5 text-emerald-600" />}
        iconBg="bg-emerald-50"
        label="Menor Preco"
        value={formatBrl(summary.minPrice)}
      />
      <SummaryCard
        icon={<TrendingUp className="h-5 w-5 text-rose-600" />}
        iconBg="bg-rose-50"
        label="Maior Preco"
        value={formatBrl(summary.maxPrice)}
      />
      <SummaryCard
        icon={<Target className="h-5 w-5 text-violet-600" />}
        iconBg="bg-violet-50"
        label="Minha Posicao"
        value={`${summary.myPricePosition}º de ${summary.count}`}
        sub={`${formatBrl(myPrice)} \u2022 Percentil ${summary.myPricePercentile}%`}
      />
      <SummaryCard
        icon={<DollarSign className="h-5 w-5 text-amber-600" />}
        iconBg="bg-amber-50"
        label="Preco Medio"
        value={formatBrl(summary.avgPrice)}
        sub={`Mediana ${formatBrl(summary.medianPrice)}`}
      />
      <SummaryCard
        icon={<Store className="h-5 w-5 text-indigo-600" />}
        iconBg="bg-indigo-50"
        label="Loja Oficial"
        value={summary.officialStoreCount}
      />
      <SummaryCard
        icon={<Truck className="h-5 w-5 text-teal-600" />}
        iconBg="bg-teal-50"
        label="Frete Gratis"
        value={summary.freeShippingCount}
      />
      <SummaryCard
        icon={<Zap className="h-5 w-5 text-orange-600" />}
        iconBg="bg-orange-50"
        label="Fulfillment"
        value={summary.fulfillmentCount}
      />
    </div>
  )
}
