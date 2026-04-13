"use client"

import { X, RefreshCw, ExternalLink, Clock, BarChart3, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useProductAnalysis } from "@/features/product-analysis/hooks/use-product-analysis"
import { AnalysisLoading } from "./AnalysisLoading"
import { AnalysisEmpty } from "./AnalysisEmpty"
import { AnalysisError } from "./AnalysisError"
import { CatalogOverview } from "./CatalogOverview"
import { CompetitorSummaryCards } from "./CompetitorSummary"
import { CompetitorTable } from "./CompetitorTable"

const strategyLabels: Record<string, string> = {
  catalog_product_items: "Catalogo (oficial)",
}

export function AnalysisModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { phase, data, error, refresh } = useProductAnalysis(itemId)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl relative animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Analise de Produto</h2>
              <span className="text-[11px] text-muted-foreground font-mono">{itemId}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase !== "loading" && (
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                className="gap-1.5 text-xs rounded-lg h-8"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[80vh] overflow-y-auto">
          {phase === "loading" && <AnalysisLoading />}
          {phase === "error" && <AnalysisError message={error ?? "Erro desconhecido"} onRetry={refresh} />}

          {(phase === "success" || phase === "partial") && data && (
            <>
              {/* Info bar */}
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-lg border bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {data.timings.totalMs}ms
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                  {strategyLabels[data.competitors.strategy] ?? data.competitors.strategy}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  {data.competitors.totalCandidatesRaw} brutos &rarr; {data.competitors.totalAfterFilters} final
                </span>
                <a
                  href={data.catalog.item.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Ver no ML <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <Tabs defaultValue="competitors">
                <TabsList className="bg-gray-100/80 rounded-lg p-1 h-auto">
                  <TabsTrigger value="catalog" className="rounded-md text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Catalogo
                  </TabsTrigger>
                  <TabsTrigger value="competitors" className="rounded-md text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2">
                    <Users className="h-3.5 w-3.5" />
                    Concorrentes ({data.competitors.competitors.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="catalog" className="mt-5">
                  <CatalogOverview data={data.catalog} />
                </TabsContent>

                <TabsContent value="competitors" className="mt-5 space-y-5">
                  {data.competitors.competitors.length === 0 ? (
                    <AnalysisEmpty onRetry={refresh} />
                  ) : (
                    <>
                      <CompetitorSummaryCards
                        summary={data.competitors.summary}
                        myPrice={data.catalog.item.price}
                      />
                      <CompetitorTable
                        competitors={data.competitors.competitors}
                        myPrice={data.catalog.item.price}
                      />
                    </>
                  )}
                  {phase === "partial" && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      Dados de catalogo carregados, mas a descoberta de concorrentes falhou parcialmente.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
