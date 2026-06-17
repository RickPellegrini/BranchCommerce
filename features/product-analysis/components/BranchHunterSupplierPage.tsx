"use client"

import { Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SupplierAnalysisPanel } from "./SupplierAnalysisPanel"

export function BranchHunterSupplierPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span>
        <span>&rsaquo;</span>
        <span className="font-medium text-foreground">Analise de Fornecedor</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analise de Fornecedor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie o arquivo do fornecedor, deixe a OpenAI extrair os dados e depois o Branch Hunter
            faz o cruzamento com o catalogo do Mercado Livre.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 gap-2"
          onClick={() => {
            window.location.href = "/api/branch-hunter/download"
          }}
        >
          <Upload className="size-4" />
          Baixar extensao
        </Button>
      </div>
      <SupplierAnalysisPanel />
    </div>
  )
}
