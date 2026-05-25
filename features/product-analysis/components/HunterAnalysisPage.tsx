"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  Search,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Clock,
  BarChart3,
  Users,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Truck,
  Zap,
  Tag,
  Filter,
  Package,
  MapPin,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useProductAnalysis } from "@/features/product-analysis/hooks/use-product-analysis"
import { formatBrl } from "@/features/product-analysis/utils/money"
import { AnalysisLoading } from "./AnalysisLoading"
import { AnalysisError } from "./AnalysisError"
import { AnalysisEmpty } from "./AnalysisEmpty"
import { CatalogOverview } from "./CatalogOverview"
import { CompetitorTable } from "./CompetitorTable"
import { AnalysisDiagnostics } from "./AnalysisDiagnostics"
import type { CompetitorEntry } from "@/features/product-analysis/domain/types"

function parseMlId(input: string): string | null {
  const trimmed = input.trim()
  const match = trimmed.match(/ML[A-Z][-]?\d+/i)
  if (!match) return null
  return match[0].toUpperCase().replace("-", "")
}

type RecentSearch = { id: string; title: string; timestamp: number }

function StatCard({
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
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-base font-bold leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  )
}

export function HunterAnalysisPage() {
  const [searchInput, setSearchInput] = useState("")
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const lastRecordedId = useRef<string | null>(null)

  const { phase, data, error, refresh } = useProductAnalysis(activeItemId)

  const handleAnalyze = useCallback(() => {
    setSearchError(null)
    const mlId = parseMlId(searchInput)
    if (!mlId) {
      setSearchError("Insira um link ou ID valido do Mercado Livre (ex: MLB1234567890)")
      return
    }
    setActiveItemId(mlId)
  }, [searchInput])

  useEffect(() => {
    if (!data || !activeItemId) return
    if (lastRecordedId.current === activeItemId) return
    lastRecordedId.current = activeItemId
    queueMicrotask(() => {
      setRecentSearches((prev) => {
        const filtered = prev.filter((s) => s.id !== activeItemId)
        return [
          {
            id: activeItemId,
            title: data.catalog.item.title,
            timestamp: Date.now(),
          },
          ...filtered,
        ].slice(0, 10)
      })
    })
  }, [data, activeItemId])

  const handleBack = useCallback(() => {
    setActiveItemId(null)
    setSearchError(null)
    lastRecordedId.current = null
  }, [])

  const handleLoadRecent = useCallback((id: string) => {
    setSearchInput(id)
    setActiveItemId(id)
    lastRecordedId.current = null
  }, [])

  const isShowingResults =
    activeItemId !== null &&
    (phase === "loading" ||
      phase === "success" ||
      phase === "partial" ||
      phase === "no_competitors" ||
      phase === "not_catalog" ||
      phase === "error")

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isShowingResults ? (
          <button className="hover:text-foreground transition-colors" onClick={handleBack}>
            &larr; Voltar
          </button>
        ) : (
          <>
            <span>Dashboard</span>
            <ChevronRight className="size-3" />
            <span className="font-medium text-foreground">Analise de Anuncio</span>
          </>
        )}
      </div>

      {/* Header */}
      {!isShowingResults && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analise de Anuncio</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Analise anuncios e catalogos do Mercado Livre para ver metricas de vendas, informacoes
              do vendedor e desempenho.
            </p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            placeholder="Cole o link do Mercado Livre (https://mercadolivre.com.br/.../p/MLB... ou https://produto.mercadolivre.com.br/MLB-...)"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setSearchError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAnalyze()
            }}
            className="flex-1"
          />
          <Button
            className="shrink-0 gap-2 bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500"
            onClick={handleAnalyze}
            disabled={phase === "loading"}
          >
            <Search className="size-4" />
            Analisar
          </Button>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
      </div>

      {/* ── Empty state ── */}
      {!isShowingResults && (
        <>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-2xl bg-orange-50 p-5 dark:bg-orange-950/30">
              <BarChart3 className="size-10 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold">Analise anuncios do Mercado Livre</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Cole o link ou ID de um anuncio e veja metricas de vendas, informacoes do vendedor e
              desempenho em segundos.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Buscas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSearches.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhuma busca recente
                </p>
              ) : (
                <div className="space-y-1">
                  {recentSearches.map((s) => (
                    <button
                      key={s.id}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() => handleLoadRecent(s.id)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Search className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{s.title}</span>
                      </div>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">Carregar</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Loading ── */}
      {isShowingResults && phase === "loading" && <AnalysisLoading />}

      {/* ── Error ── */}
      {isShowingResults && phase === "error" && (
        <AnalysisError message={error ?? "Erro desconhecido"} onRetry={refresh} />
      )}

      {/* ── Results ── */}
      {isShowingResults &&
        (phase === "success" ||
          phase === "partial" ||
          phase === "no_competitors" ||
          phase === "not_catalog") &&
        data && <AnalysisResults data={data} refresh={refresh} phase={phase} />}
    </div>
  )
}

// ─── Filter pill button ─────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-muted-foreground border-border hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  )
}

// ─── Results component ──────────────────────────────────────────────

type LogisticFilter = "all" | "full" | "flex"

function AnalysisResults({
  data,
  refresh,
  phase,
}: {
  data: NonNullable<ReturnType<typeof useProductAnalysis>["data"]>
  refresh: () => void
  phase: string
}) {
  const { item } = data.catalog
  const { summary, competitors: rawCompetitors } = data.competitors
  const [logisticFilter, setLogisticFilter] = useState<LogisticFilter>("all")
  const [listingFilter, setListingFilter] = useState<"all" | "gold_pro" | "gold_special">("all")
  const [cityFilter, setCityFilter] = useState<string | null>(null)

  const competitors = rawCompetitors
  const effectiveBuyBoxWinner = data.competitors.buyBoxWinnerItemId
  const effectiveDataSources = data.dataSources
  const priceToWinSource = effectiveDataSources.find((source) => source.key === "price_to_win")
  const stockSource = effectiveDataSources.find((source) => source.key === "reference_stock")

  const availableCities = useMemo(() => {
    const cities = new Map<string, number>()
    for (const c of competitors) {
      if (!c.location) continue
      const city = c.location.split(",")[0].trim()
      if (city) cities.set(city, (cities.get(city) ?? 0) + 1)
    }
    return [...cities.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ city, count }))
  }, [competitors])

  const filtered = useMemo(() => {
    let list: CompetitorEntry[] = competitors
    if (logisticFilter === "full") {
      list = list.filter((c) => c.logisticType === "fulfillment")
    } else if (logisticFilter === "flex") {
      list = list.filter(
        (c) => c.logisticType === "xd_drop_off" || c.logisticType === "cross_docking",
      )
    }
    if (listingFilter !== "all") {
      list = list.filter((c) => c.listingType === listingFilter)
    }
    if (cityFilter) {
      list = list.filter((c) => c.location?.split(",")[0].trim() === cityFilter)
    }
    return list
  }, [competitors, logisticFilter, listingFilter, cityFilter])

  const fullCount = competitors.filter((c) => c.logisticType === "fulfillment").length
  const flexCount = competitors.filter(
    (c) => c.logisticType === "xd_drop_off" || c.logisticType === "cross_docking",
  ).length

  return (
    <div className="space-y-5">
      {/* ═══ Product Hero Card ═══ */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex gap-5">
          {item.thumbnail && (
            <img
              src={item.thumbnail}
              alt={item.title}
              className="h-28 w-28 rounded-xl object-cover border shadow-sm shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base leading-snug line-clamp-2 mb-2">{item.title}</h2>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-2xl font-bold text-emerald-600">{formatBrl(item.price)}</span>
              {item.originalPrice && item.originalPrice > item.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatBrl(item.originalPrice)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data.catalog.catalogProductId && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-mono font-medium text-blue-700 dark:text-blue-300">
                  <Tag className="h-3 w-3" />
                  {data.catalog.catalogProductId}
                </span>
              )}
              {data.primaryItemSource === "synthetic_catalog_item" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  Catalogo sem estoque/vendidos reais
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <Users className="h-3 w-3" />
                {competitors.length + 1} vendedores em catalogo
              </span>
              {item.freeShipping && (
                <span className="inline-flex items-center gap-1 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                  <Truck className="h-3 w-3" />
                  Frete Gratis
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                {data.timings.totalMs}ms
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Atualizar
            </Button>
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              Ver no ML <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* ═══ Summary Stats ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/30"
          label="Concorrentes"
          value={summary.count}
          sub={`${summary.officialStoreCount} lojas oficiais`}
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/30"
          label="Menor Preco"
          value={formatBrl(summary.minPrice)}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/30"
          label="Preco Medio"
          value={formatBrl(summary.avgPrice)}
          sub={`Mediana ${formatBrl(summary.medianPrice)}`}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-950/30"
          label="Maior Preco"
          value={formatBrl(summary.maxPrice)}
        />
      </div>

      {/* ═══ Tabs ═══ */}
      <Tabs defaultValue="competitors">
        <TabsList className="bg-muted rounded-lg p-1 h-auto">
          <TabsTrigger
            value="competitors"
            className="rounded-md text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
          >
            <Users className="h-3.5 w-3.5" />
            Anuncios
          </TabsTrigger>
          <TabsTrigger
            value="catalog"
            className="rounded-md text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Detalhes
          </TabsTrigger>
          <TabsTrigger
            value="diagnostics"
            className="rounded-md text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
          >
            <Clock className="h-3.5 w-3.5" />
            Dados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="competitors" className="mt-5 space-y-4">
          {/* Section header + filters */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold">Anuncios do catalogo</h3>
              <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">
                {filtered.length}
              </span>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <FilterPill
              active={logisticFilter === "all" && listingFilter === "all" && !cityFilter}
              onClick={() => {
                setLogisticFilter("all")
                setListingFilter("all")
                setCityFilter(null)
              }}
            >
              Todos os tipos
            </FilterPill>
            <FilterPill
              active={logisticFilter === "full"}
              onClick={() => setLogisticFilter(logisticFilter === "full" ? "all" : "full")}
            >
              <Zap className="h-3 w-3" /> Frete Full ({fullCount})
            </FilterPill>
            <FilterPill
              active={logisticFilter === "flex"}
              onClick={() => setLogisticFilter(logisticFilter === "flex" ? "all" : "flex")}
            >
              <Truck className="h-3 w-3" /> Frete Flex ({flexCount})
            </FilterPill>
            <span className="h-4 w-px bg-border" />
            <FilterPill
              active={listingFilter === "gold_pro"}
              onClick={() => setListingFilter(listingFilter === "gold_pro" ? "all" : "gold_pro")}
            >
              Premium
            </FilterPill>
            <FilterPill
              active={listingFilter === "gold_special"}
              onClick={() =>
                setListingFilter(listingFilter === "gold_special" ? "all" : "gold_special")
              }
            >
              Classico
            </FilterPill>
            {availableCities.length > 1 && (
              <>
                <span className="h-4 w-px bg-border" />
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {cityFilter ? (
                  <button
                    onClick={() => setCityFilter(null)}
                    className="inline-flex items-center gap-1 rounded-full border border-foreground bg-foreground px-3 py-1 text-[11px] font-medium text-background transition-colors"
                  >
                    {cityFilter}
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <select
                    value=""
                    onChange={(e) => setCityFilter(e.target.value || null)}
                    className="h-7 rounded-full border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring dark:[color-scheme:dark]"
                  >
                    <option value="">Todas as cidades</option>
                    {availableCities.map(({ city, count }) => (
                      <option key={city} value={city}>
                        {city} ({count})
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <AnalysisEmpty onRetry={refresh} />
          ) : (
            <CompetitorTable
              competitors={filtered}
              myPrice={item.price}
              winnerItemId={effectiveBuyBoxWinner}
            />
          )}
          {stockSource?.detail && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              {stockSource.detail}
            </div>
          )}
          {(phase === "partial" || phase === "no_competitors" || phase === "not_catalog") && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
              {phase === "partial"
                ? "Analise carregada com algumas fontes indisponiveis. Veja a aba Dados."
                : phase === "not_catalog"
                  ? "Este anuncio nao retornou vinculo de catalogo; a comparacao de concorrentes nao esta disponivel."
                  : "Catalogo encontrado, mas nenhum concorrente foi retornado alem do item analisado."}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-5">
          <CatalogOverview data={data.catalog} priceToWinSource={priceToWinSource} />
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-5">
          <AnalysisDiagnostics
            dataSources={effectiveDataSources}
            logs={data.logs}
            analysisStatus={data.analysisStatus}
            receivedId={data.receivedId}
            resolvedInputType={data.resolvedInputType}
            primaryItemSource={data.primaryItemSource}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
