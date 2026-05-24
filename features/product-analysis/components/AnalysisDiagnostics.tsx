"use client"

import type {
  AnalysisDataSource,
  AnalysisStatus,
  LogEntry,
  PrimaryItemSource,
  ResolvedInputType,
} from "@/features/product-analysis/domain/types"

const statusLabel: Record<AnalysisDataSource["status"], string> = {
  success: "OK",
  partial: "Parcial",
  failed: "Falhou",
  skipped: "Ignorado",
  unavailable: "Indisponivel",
}

const kindLabel: Record<AnalysisDataSource["kind"], string> = {
  mercadolivre_api: "API ML",
  scraping: "Scraping",
  extension: "Extensao",
  computed: "Calculado",
}

const statusClass: Record<AnalysisDataSource["status"], string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  partial:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  failed:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
  skipped: "border-border bg-muted/40 text-muted-foreground",
  unavailable:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300",
}

const analysisStatusLabel: Record<AnalysisStatus, string> = {
  success: "Completa",
  partial: "Parcial",
  no_competitors: "Sem concorrentes",
  not_catalog: "Fora do catalogo",
}

function inputTypeLabel(type: ResolvedInputType) {
  return type === "catalog_product" ? "Catalogo" : "Anuncio"
}

function itemSourceLabel(source: PrimaryItemSource) {
  return source === "synthetic_catalog_item" ? "Item sintetico de catalogo" : "Anuncio real"
}

export function AnalysisDiagnostics({
  dataSources,
  logs,
  analysisStatus,
  receivedId,
  resolvedInputType,
  primaryItemSource,
}: {
  dataSources: AnalysisDataSource[]
  logs: LogEntry[]
  analysisStatus: AnalysisStatus
  receivedId: string
  resolvedInputType: ResolvedInputType
  primaryItemSource: PrimaryItemSource
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            ID recebido
          </p>
          <p className="mt-1 font-mono text-xs font-semibold">{receivedId}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo resolvido
          </p>
          <p className="mt-1 text-xs font-semibold">{inputTypeLabel(resolvedInputType)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fonte principal
          </p>
          <p className="mt-1 text-xs font-semibold">{itemSourceLabel(primaryItemSource)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <p className="mt-1 text-xs font-semibold">{analysisStatusLabel[analysisStatus]}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Fontes da analise</h3>
        </div>
        <div className="divide-y">
          {dataSources.map((source) => (
            <div key={source.key} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{source.label}</p>
                  <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {kindLabel[source.kind]}
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusClass[source.status]}`}
                  >
                    {statusLabel[source.status]}
                  </span>
                </div>
                {(source.detail || source.error || source.endpoint) && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {source.error ?? source.detail ?? source.endpoint}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground md:justify-end">
                {source.count != null && <span>{source.count} itens</span>}
                {source.durationMs != null && <span>{source.durationMs}ms</span>}
                <span>{source.used ? "usado" : "nao usado"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {logs.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Logs internos</h3>
          </div>
          <div className="max-h-64 overflow-auto p-3">
            <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
              {logs.map((log, index) => (
                <p key={`${log.step}-${index}`}>
                  [{log.step}] {log.detail}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
