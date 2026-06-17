"use client"

import { useMemo, useState } from "react"
import { Upload, Store, Link2, ScanSearch, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatBrl } from "@/features/product-analysis/utils/money"

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

function normalizeHeader(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function splitLine(line: string, delimiter: string) {
  return line.split(delimiter).map((value) => value.trim())
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) ?? ""
  if (sample.includes("\t")) return "\t"
  if (sample.includes(";")) return ";"
  return ","
}

function parseSupplierTable(text: string): SupplierRow[] {
  const trimmed = String(text ?? "").trim()
  if (!trimmed) return []

  const delimiter = detectDelimiter(trimmed)
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const headers = splitLine(lines[0], delimiter).map(normalizeHeader)
  const codeIndex = headers.findIndex((header) => ["codigo", "cod", "sku"].includes(header))
  const nameIndex = headers.findIndex((header) => ["descricao", "produto", "nome"].includes(header))
  const gtinIndex = headers.findIndex((header) =>
    ["gtin", "ean", "codigo de barras", "codigo universal de produto"].includes(header),
  )
  const costIndex = headers.findIndex((header) =>
    ["r$ unit.", "r$ unit", "r$ unitario", "unitario", "custo", "preco", "preco custo"].includes(
      header,
    ),
  )

  if (nameIndex === -1 || gtinIndex === -1 || costIndex === -1) {
    return []
  }

  return lines
    .slice(1)
    .map((line) => splitLine(line, delimiter))
    .map((cols) => ({
      code: codeIndex >= 0 ? (cols[codeIndex] ?? "") : "",
      name: cols[nameIndex] ?? "",
      gtin: (cols[gtinIndex] ?? "").replace(/\D/g, ""),
      cost: parseLocaleNumber(cols[costIndex] ?? ""),
    }))
    .filter((row): row is SupplierRow => Boolean(row.name && row.gtin) && row.cost !== null)
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
  const [results, setResults] = useState<SupplierWinner[]>([])
  const [summary, setSummary] = useState<{
    scanned: number
    matched: number
    minMargin: number
  } | null>(null)

  const parsedRows = useMemo(() => parseSupplierTable(rawTable), [rawTable])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
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

      const payload = (await response.json()) as SupplierScanResponse
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || `HTTP ${response.status}`)
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
          Cole a lista do fornecedor e encontre produtos de catalogo com margem minima acima do que
          voce definir.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <label className="text-sm font-medium">Lista do fornecedor</label>
            <Textarea
              rows={10}
              value={rawTable}
              onChange={(event) => setRawTable(event.target.value)}
              placeholder={
                "codigo\tdescricao\tgtin\tcusto\n2485\tACHOCOLATADO PO TODDY 370G\t7892840819507\t8,99"
              }
            />
            <p className="text-xs text-muted-foreground">
              Aceita planilha colada do Excel/Sheets ou CSV com colunas `codigo`, `descricao`,
              `gtin/ean` e `custo`.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Margem minima (%)</label>
              <Input value={minMargin} onChange={(event) => setMinMargin(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Importar CSV</label>
              <Input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleFileChange}
              />
            </div>
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
          <div className="grid gap-3">
            {results.map((row) => (
              <div
                key={`${row.catalogProductId}-${row.gtin}`}
                className="rounded-xl border bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{row.supplierName}</h3>
                    <p className="text-sm text-muted-foreground">{row.catalogName}</p>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                    {formatPercent(row.netMargin)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Custo {formatBrl(row.supplierCost)}</span>
                  <span>Venda {formatBrl(row.salePrice)}</span>
                  <span>Lucro {formatBrl(row.netProfit)}</span>
                  <span>Taxa {formatPercent(row.feePercent)}</span>
                  <span>Ofertas {row.offers}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href={row.catalogLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    <Link2 className="size-4" />
                    Abrir catalogo
                  </a>
                  <a
                    href={row.itemLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    <Upload className="size-4" />
                    Abrir anuncio
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
