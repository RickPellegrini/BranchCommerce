"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

export function AnalysisError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Erro na analise</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 rounded-lg">
        <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
      </Button>
    </div>
  )
}
