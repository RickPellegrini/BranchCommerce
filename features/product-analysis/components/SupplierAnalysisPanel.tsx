"use client"

import { useMemo, useState } from "react"
import { Upload, Store, Link2, ScanSearch, Copy, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatBrl } from "@/features/product-analysis/utils/money"
import { parseSupplierTable } from "@/lib/branch-hunter/supplier-parser"

type SupplierRow = {
  code: string
  name: string
  gtin: string
  cost: number
}

type SupplierWinner = {
  supplierCode: string | null
  supplierName: string
  supplierCost: number
  gtin: string
  catalogName: string
  catalogProductId: string
  salePrice: number
  feePercent: number
  feeAmount: number
  netProfit: number
  netMargin: number
  grossMargin: number
  offers: number
  catalogLink: string
  itemLink: string
}

type SupplierScanResponse = {
  ok: boolean
  error?: string
  data?: {
    scanned: number
    matched: number
    minMargin: number
    winners: SupplierWinner[]
  }
}

type SupplierImportResponse = {
  ok: boolean
  error?: string
  data?: {
    fileName: string
    rows: SupplierRow[]
    rawText: string
    sourceType: "pdf" | "text"
  }
}

function parseJsonResponse<T>(rawResponse: string) {
  try {
    return JSON.parse(rawResponse) as T
  } catch {
    return null
  }
}

function buildApiErrorMessage(response: Response, fallbackMessage: string, rawResponse: string) {
  const preview = rawResponse.trim().slice(0, 120)
  if (preview.startsWith("<")) {
    return `${fallbackMessage} A API respondeu HTML em vez de JSON (HTTP ${response.status}).`
  }
  return `${fallbackMessage} HTTP ${response.status}.`
}

function parseLocaleNumber(value: string) {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[R$r$]/gi, "")
  if (!sanitized) return null
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function SupplierAnalysisPanel() {
  const [rawTable, setRawTable] = useState("")
  const [minMargin, setMinMargin] = useState("15")
  const [status, setStatus] = useState(
    "Cole a lista do fornecedor para procurar produtos de catalogo com margem boa.",
  )
  const [isLoading, setIsLoading] = useState(false)
  const [importedRows, setImportedRows] = useState<SupplierRow[]>([])
  const [results, setResults] = useState<SupplierWinner[]>([])
  const [importedFileName, setImportedFileName] = useState<string | null>(null)
  const [summary, setSummary] = useState<{
    scanned: number
    matched: number
    minMargin: number
  } | null>(null)

  const parsedRows = useMemo(
    () => (importedRows.length > 0 ? importedRows : parseSupplierTable(rawTable)),
    [importedRows, rawTable],
  )

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const lowerName = file.name.toLowerCase()
    setImportedFileName(file.name)

    if (lowerName.endsWith(".pdf")) {
      const formData = new FormData()
      formData.append("file", file)
      setStatus("Lendo PDF do fornecedor...")

      try {
        const response = await fetch("/api/branch-hunter/supplier-import", {
          method: "POST",
          body: formData,
        })
        const rawResponse = await response.text()
        const payload = parseJsonResponse<SupplierImportResponse>(rawResponse)
        if (!response.ok || !payload?.ok || !payload.data) {
          throw new Error(
            payload?.error ||
              buildApiErrorMessage(response, "Erro ao importar o PDF do fornecedor.", rawResponse),
          )
        }
        setImportedRows(payload.data.rows)
        setRawTable(payload.data.rawText)
        setStatus(
          `${payload.data.rows.length} itens extraidos do PDF. Agora clique em Analisar lista do fornecedor.`,
        )
      } catch (error) {
        setImportedRows([])
        setRawTable("")
        setStatus(error instanceof Error ? error.message : "Erro ao importar o PDF do fornecedor.")
      }
      return
    }

    const text = await file.text()
    setImportedRows([])
    setRawTable(text)
    setStatus("Arquivo carregado. Agora clique em Analisar lista do fornecedor.")
  }

  async function handleRunScan() {
    if (parsedRows.length === 0) {
      setResults([])
      setSummary(null)
      setStatus("Nao consegui ler a planilha. Use colunas codigo, descricao, gtin/ean e custo.")
      return
    }

    setIsLoading(true)
    setStatus(`Analisando ${parsedRows.length} itens no catalogo do Mercado Livre...`)
    setResults([])

    try {
      const response = await fetch("/api/branch-hunter/supplier-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: parsedRows,
          minMargin: parseLocaleNumber(minMargin) ?? 15,
        }),
      })

      const rawResponse = await response.text()
      const payload = parseJsonResponse<SupplierScanResponse>(rawResponse)
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(
          payload?.error ||
            buildApiErrorMessage(response, "Erro ao analisar a lista do fornecedor.", rawResponse),
        )
      }

      setResults(payload.data.winners)
      setSummary({
        scanned: payload.data.scanned,
        matched: payload.data.matched,
        minMargin: payload.data.minMargin,
      })
      setStatus(
        `${payload.data.scanned} itens lidos, ${payload.data.matched} bateram no catalogo e ${payload.data.winners.length} passaram da margem minima.`,
      )
    } catch (error) {
      setResults([])
      setSummary(null)
      setStatus(error instanceof Error ? error.message : "Erro ao analisar a lista do fornecedor.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopySummary() {
    if (results.length === 0) return
    const text = results
      .map(
        (row) =>
          `${row.supplierName} | custo ${formatBrl(row.supplierCost)} | venda ${formatBrl(row.salePrice)} | margem ${formatPercent(row.netMargin)} | ${row.catalogLink}`,
      )
      .join("\n")
    await navigator.clipboard.writeText(text)
    setStatus("Resumo copiado para a area de transferencia.")
  }

  return (
    <Card className="border-blue-200/70">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Store className="size-5 text-blue-600" />
          Analise de Fornecedor
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Envie PDF, CSV ou texto do fornecedor e encontre produtos de catalogo com margem minima
          acima do que voce definir.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <label className="text-sm font-medium">Lista do fornecedor</label>
            <Textarea
              rows={10}
              value={rawTable}
              onChange={(event) => {
                setImportedRows([])
                setRawTable(event.target.value)
              }}
              placeholder={
                "codigo\tdescricao\tgtin\tcusto\n2485\tACHOCOLATADO PO TODDY 370G\t7892840819507\t8,99"
              }
            />
            <p className="text-xs text-muted-foreground">
              Aceita planilha colada do Excel/Sheets, CSV/TXT e PDF com colunas `codigo`,
              `descricao`, `gtin/ean` e `custo`.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Margem minima (%)</label>
              <Input value={minMargin} onChange={(event) => setMinMargin(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Importar PDF ou CSV</label>
              <Input
                type="file"
                accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
                onChange={handleFileChange}
              />
            </div>
            {importedFileName && (
              <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                <FileText className="size-4" />
                {importedFileName}
              </div>
            )}
            <Button onClick={handleRunScan} disabled={isLoading} className="w-full gap-2">
              <ScanSearch className="size-4" />
              {isLoading ? "Analisando..." : "Analisar lista do fornecedor"}
            </Button>
            <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
              {parsedRows.length} linhas validas detectadas
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {status}
        </div>

        {summary && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3">
            <div className="text-sm">
              <strong>{results.length}</strong> produtos aprovados
              <span className="text-muted-foreground">
                {" "}
                de {summary.matched} catalogos encontrados e {summary.scanned} itens lidos
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopySummary} className="gap-2">
              <Copy className="size-4" />
              Copiar resumo
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Menor preco catalogo</TableHead>
                  <TableHead>Margem est.</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={`${row.catalogProductId}-${row.gtin}`}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="font-medium">{row.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{row.catalogName}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">{formatBrl(row.supplierCost)}</TableCell>
                    <TableCell className="align-top">{formatBrl(row.salePrice)}</TableCell>
                    <TableCell className="align-top font-semibold text-emerald-700">
                      {formatPercent(row.netMargin)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-2">
                        <a
                          href={row.catalogLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          <Link2 className="size-4" />
                          catalogo
                        </a>
                        <a
                          href={row.itemLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          <Upload className="size-4" />
                          anuncio
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
