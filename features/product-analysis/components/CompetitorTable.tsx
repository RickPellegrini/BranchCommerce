"use client"

import type { CompetitorEntry } from "@/features/product-analysis/domain/types"
import { formatBrl } from "@/features/product-analysis/utils/money"
import { Truck, Store, Package, MapPin, Shield, Zap, ArrowDown, ArrowUp, Minus } from "lucide-react"

function ShippingBadge({ entry }: { entry: CompetitorEntry }) {
  if (entry.logisticType === "fulfillment") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
        <Zap className="h-3 w-3" /> Full
      </span>
    )
  }
  if (entry.logisticType === "xd_drop_off" || entry.logisticType === "cross_docking") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
        <Truck className="h-3 w-3" /> {entry.logisticType === "xd_drop_off" ? "Coleta" : "ME2"}
      </span>
    )
  }
  if (entry.freeShipping) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <Truck className="h-3 w-3" /> Gratis
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">-</span>
}

function PriceDelta({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" /> Igual
      </span>
    )
  }
  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-rose-600">
        <ArrowDown className="h-3 w-3" /> {formatBrl(Math.abs(diff))}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
      <ArrowUp className="h-3 w-3" /> {formatBrl(diff)}
    </span>
  )
}

function ListingTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-xs text-muted-foreground">-</span>
  const label = type === "gold_pro" ? "Premium" : type === "gold_special" ? "Clássico" : type
  const color = type === "gold_pro" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  )
}

export function CompetitorTable({
  competitors,
  myPrice,
}: {
  competitors: CompetitorEntry[]
  myPrice: number
}) {
  if (competitors.length === 0) return null

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50/80">
            <th className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-8">#</th>
            <th className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Item ID</th>
            <th className="p-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preco</th>
            <th className="p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Condicao</th>
            <th className="p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Frete</th>
            <th className="p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
            <th className="p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Info</th>
            <th className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Local</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {competitors.map((c, i) => {
            const diff = c.price - myPrice
            const isMyItem = c.sellerId === 0
            return (
              <tr
                key={c.itemId}
                className={`transition-colors hover:bg-blue-50/40 ${isMyItem ? "bg-blue-50/30" : ""}`}
              >
                <td className="p-3 text-xs font-medium text-muted-foreground">{i + 1}</td>
                <td className="p-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-foreground">{c.itemId}</p>
                    {c.sellerNickname ? (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{c.sellerNickname}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Seller {c.sellerId}</p>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <p className="font-semibold text-foreground">{formatBrl(c.price)}</p>
                  <PriceDelta diff={diff} />
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    c.condition === "new" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {c.condition === "new" ? "Novo" : c.condition ?? "-"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <ShippingBadge entry={c} />
                </td>
                <td className="p-3 text-center">
                  <ListingTypeBadge type={c.listingType} />
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {c.officialStore && (
                      <span title="Loja Oficial" className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
                        <Store className="h-3 w-3 text-blue-600" />
                      </span>
                    )}
                    {c.logisticType === "fulfillment" && (
                      <span title="Fulfillment" className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100">
                        <Package className="h-3 w-3 text-purple-600" />
                      </span>
                    )}
                    {c.warranty && (
                      <span title={c.warranty} className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
                        <Shield className="h-3 w-3 text-gray-500" />
                      </span>
                    )}
                    {!c.officialStore && c.logisticType !== "fulfillment" && !c.warranty && (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-left">
                  {c.location ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[130px]">{c.location}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
