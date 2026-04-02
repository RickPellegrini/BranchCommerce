"use client"

import { Loader2 } from "lucide-react"

export function AnalysisLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="relative">
        <div className="h-12 w-12 rounded-full bg-blue-50 animate-pulse" />
        <Loader2 className="h-6 w-6 text-blue-600 animate-spin absolute top-3 left-3" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Carregando analise...</p>
        <p className="text-xs text-muted-foreground mt-1">Consultando dados do Mercado Livre</p>
      </div>
    </div>
  )
}
