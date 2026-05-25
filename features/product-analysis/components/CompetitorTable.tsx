"use client"

import type { CompetitorEntry } from "@/features/product-analysis/domain/types"
import { formatBrl } from "@/features/product-analysis/utils/money"
import { ExternalLink, Zap, Truck, Trophy } from "lucide-react"

// ─── Reputation level bar (5 dots like the reference) ───────────────

const LEVEL_MAP: Record<string, { level: number; color: string }> = {
  "5_green": { level: 5, color: "bg-emerald-500" },
  "5_light_green": { level: 5, color: "bg-lime-500" },
  "4_light_green": { level: 4, color: "bg-lime-500" },
  "4_green": { level: 4, color: "bg-emerald-500" },
  "3_yellow": { level: 3, color: "bg-yellow-500" },
  "3_green": { level: 3, color: "bg-emerald-500" },
  "2_orange": { level: 2, color: "bg-orange-500" },
  "2_yellow": { level: 2, color: "bg-yellow-500" },
  "1_red": { level: 1, color: "bg-red-500" },
}

function ReputationBar({ levelId }: { levelId: string | null }) {
  if (!levelId) return null
  const info = LEVEL_MAP[levelId] ?? { level: 0, color: "bg-muted-foreground/30" }
  return (
    <div className="flex items-center gap-[2px]" title={`Reputacao ${info.level}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-[7px] w-[12px] rounded-sm ${n <= info.level ? info.color : "bg-muted"}`}
        />
      ))}
    </div>
  )
}

// ─── Power seller badge ─────────────────────────────────────────────

const POWER_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  platinum: { label: "Platinum", bg: "bg-emerald-500", text: "text-white" },
  gold: { label: "Ouro", bg: "bg-amber-400", text: "text-white" },
  silver: { label: "Prata", bg: "bg-gray-400", text: "text-white" },
}

function PowerBadge({ status }: { status: string | null }) {
  if (!status) return null
  const c = POWER_CONFIG[status]
  if (!c) return null
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  )
}

// ─── Logistics badge ────────────────────────────────────────────────

function LogisticBadge({ entry }: { entry: CompetitorEntry }) {
  if (entry.logisticType === "fulfillment") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
        <Zap className="h-3 w-3" /> Full
      </span>
    )
  }
  if (entry.logisticType === "xd_drop_off" || entry.logisticType === "cross_docking") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
        <Truck className="h-3 w-3" /> Flex
      </span>
    )
  }
  if (entry.freeShipping) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        <Truck className="h-3 w-3" /> Gratis
      </span>
    )
  }
  return null
}

// ─── Listing type ───────────────────────────────────────────────────

function ListingTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-xs text-muted-foreground">-</span>
  if (type === "gold_pro") return <span className="text-xs font-medium">Premium</span>
  if (type === "gold_special")
    return <span className="text-xs text-muted-foreground">Classico</span>
  return <span className="text-xs text-muted-foreground">{type}</span>
}

// ─── Main table ─────────────────────────────────────────────────────

export function CompetitorTable({
  competitors,
  myPrice,
  winnerItemId,
}: {
  competitors: CompetitorEntry[]
  myPrice: number
  winnerItemId: string | null
}) {
  if (competitors.length === 0) return null

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[260px]">
                Vendedor
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Preco
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Estoque
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {competitors.map((c) => {
              const priceDiff = c.price - myPrice
              const pricePct = myPrice > 0 ? (priceDiff / myPrice) * 100 : 0
              const isWinner = winnerItemId != null && c.itemId === winnerItemId

              return (
                <tr
                  key={c.itemId}
                  className={`transition-colors hover:bg-muted/50 ${
                    isWinner
                      ? "bg-amber-50/60 dark:bg-amber-950/20 border-l-[3px] border-l-amber-400"
                      : ""
                  }`}
                >
                  {/* ── Vendedor ── */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isWinner && (
                          <span
                            className="inline-flex items-center justify-center rounded-full bg-amber-400 p-1 shadow-md shadow-amber-400/30"
                            title="Ganhador do Buy Box"
                          >
                            <Trophy className="h-3.5 w-3.5 text-white" />
                          </span>
                        )}
                        {c.sellerNickname ? (
                          <a
                            href={c.sellerPermalink ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-xs text-foreground hover:text-blue-600 hover:underline transition-colors"
                          >
                            {c.sellerNickname}
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.itemId}
                          </span>
                        )}
                        {(c.sellerPermalink || c.permalink) && (
                          <a
                            href={c.sellerPermalink ?? c.permalink ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-blue-600"
                            title={c.sellerPermalink ? "Abrir vendedor" : "Abrir anuncio"}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <PowerBadge status={c.sellerPowerStatus} />
                        {isWinner && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/20 dark:bg-amber-400/10 border border-amber-400/50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            Buy Box
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <ReputationBar levelId={c.sellerRepLevel} />
                        {c.location && (
                          <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                            {c.location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <LogisticBadge entry={c} />
                        {c.officialStore && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            Oficial
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* ── Preco ── */}
                  <td className="px-4 py-3 text-right">
                    <p className="font-bold text-sm">{formatBrl(c.price)}</p>
                    {c.originalPrice && c.originalPrice > c.price && (
                      <p className="text-[10px] text-muted-foreground line-through">
                        {formatBrl(c.originalPrice)}
                      </p>
                    )}
                    {Math.abs(priceDiff) >= 0.01 && (
                      <p
                        className={`text-[10px] font-medium ${priceDiff < 0 ? "text-emerald-600" : priceDiff > 0 ? "text-rose-600" : "text-muted-foreground"}`}
                      >
                        {priceDiff > 0 ? "+" : ""}
                        {pricePct.toFixed(1)}%
                      </p>
                    )}
                  </td>

                  {/* ── Estoque ── */}
                  <td className="px-4 py-3 text-right">
                    {c.referenceStockLabel ? (
                      <>
                        <p
                          className={`font-semibold text-xs tabular-nums ${
                            c.referenceStock != null && c.referenceStock <= 1
                              ? "text-rose-600"
                              : c.referenceStock != null && c.referenceStock <= 50
                                ? "text-amber-600"
                                : "text-foreground"
                          }`}
                        >
                          {c.referenceStockLabel}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Ref. API</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>

                  {/* ── Tipo ── */}
                  <td className="px-4 py-3 text-center">
                    <ListingTypeBadge type={c.listingType} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
