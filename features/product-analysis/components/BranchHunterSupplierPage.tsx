"use client"

import { FileSearch, Upload } from "lucide-react"

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
            Envie o arquivo do fornecedor para o extractor externo e deixe o Branch Hunter cuidar
            apenas do cruzamento com o catalogo do Mercado Livre.
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

      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 rounded-2xl bg-blue-50 p-5 dark:bg-blue-950/30">
          <FileSearch className="size-10 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold">Importe o fornecedor e analise a margem</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Essa aba e separada da analise de anuncio. Aqui voce envia o arquivo para a extracao
          externa, revisa o retorno e gera a lista final dos produtos aprovados.
        </p>
      </div>

      <SupplierAnalysisPanel />
    </div>
  )
}
