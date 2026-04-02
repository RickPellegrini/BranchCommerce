import type { LogEntry } from "@/features/product-analysis/domain/types"

export function createAnalysisLogger() {
  const entries: LogEntry[] = []
  const t0 = Date.now()

  function log(step: string, detail: string, count?: number) {
    const ms = Date.now() - t0
    entries.push({ step, detail, count, ms })
    if (process.env.NODE_ENV === "development") {
      const c = count != null ? ` (count=${count})` : ""
      console.log(`[analysis +${ms}ms] [${step}] ${detail}${c}`)
    }
  }

  return { log, entries, elapsed: () => Date.now() - t0 }
}

export type AnalysisLogger = ReturnType<typeof createAnalysisLogger>
