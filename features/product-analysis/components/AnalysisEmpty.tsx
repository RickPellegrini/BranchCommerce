"use client"

import { Button } from "@/components/ui/button"
import { SearchX, RefreshCw } from "lucide-react"

export function AnalysisEmpty({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
        <SearchX className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Nenhum concorrente encontrado</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Este produto pode nao estar vinculado a um catalogo ou nao possui concorrentes listados.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 rounded-lg">
        <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
      </Button>
    </div>
  )
}
