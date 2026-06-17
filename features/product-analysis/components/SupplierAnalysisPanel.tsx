"use client"

import { useState } from "react"
import {
  CheckCircle2,
  Copy,
  FileSearch,
  FileText,
  Link2,
  Loader2,
  ScanSearch,
  Store,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
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

type LoadingPhase = "idle" | "importing" | "scanning"

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

function parseSupplierRowsFromText(rawText: string): SupplierRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const maybeHeader = lines[0]?.toLowerCase() ?? ""
  const dataLines =
    maybeHeader.includes("codigo") &&
    maybeHeader.includes("descricao") &&
    maybeHeader.includes("gtin") &&
    maybeHeader.includes("custo")
      ? lines.slice(1)
      : lines

  return dataLines
    .map((line) => {
      const tabParts = line.split("\t").map((part) => part.trim())
      const parts = tabParts.length >= 4 ? tabParts : line.split(/\s+/).filter(Boolean)

      if (parts.length < 4) return null

      const code = parts[0] ?? ""
      const costText = parts.at(-1) ?? ""
      const gtin = parts.at(-2) ?? ""
      const name = parts.slice(1, -2).join(" ")
      const cost = parseLocaleNumber(costText)

      return {
        code: code.trim(),
        name: name.trim(),
        gtin: gtin.replace(/\D/g, "").trim(),
        cost,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row): row is SupplierRow => Boolean(row.name && row.gtin) && row.cost !== null)
    .map((row) => ({
      code: row.code,
      name: row.name,
      gtin: row.gtin,
      cost: row.cost,
    }))
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function SummaryMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "success"
}) {
  return (
    <div className="rounded-2xl border px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div
        className={
          tone === "success"
            ? "mt-2 text-2xl font-semibold text-emerald-700"
            : "mt-2 text-2xl font-semibold text-foreground"
        }
      >
        {value}
      </div>
    </div>
  )
}

export function SupplierAnalysisPanel() {
  const [rawTable, setRawTable] = useState("")
  const [minMargin, setMinMargin] = useState("15")
  const [status, setStatus] = useState(
    "Importe a tabela do fornecedor e eu ja cruzo tudo com o Mercado Livre.",
  )
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle")
  const [importedRows, setImportedRows] = useState<SupplierRow[]>([])
  const [results, setResults] = useState<SupplierWinner[]>([])
  const [importedFileName, setImportedFileName] = useState<string | null>(null)
  const [summary, setSummary] = useState<{
    scanned: number
    matched: number
    minMargin: number
  } | null>(null)

  const extractedRows = importedRows.length > 0 ? importedRows : parseSupplierRowsFromText(rawTable)
  const isBusy = loadingPhase !== "idle"
  const hasImport = extractedRows.length > 0

  async function runSupplierScan(rows: SupplierRow[]) {
    if (rows.length === 0) {
      setResults([])
      setSummary(null)
      setStatus("Nenhuma linha valida foi retornada pela extracao OpenAI.")
      return
    }

    setLoadingPhase("scanning")
    setResults([])
    setSummary(null)
    setStatus(`Analisando ${rows.length} itens no catalogo do Mercado Livre...`)

    try {
      const response = await fetch("/api/branch-hunter/supplier-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows,
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
        `${payload.data.winners.length} produtos aprovados com margem minima de ${formatPercent(payload.data.minMargin)}.`,
      )
    } catch (error) {
      setResults([])
      setSummary(null)
      setStatus(error instanceof Error ? error.message : "Erro ao analisar a lista do fornecedor.")
    } finally {
      setLoadingPhase("idle")
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImportedFileName(file.name)
    setImportedRows([])
    setRawTable("")
    setResults([])
    setSummary(null)
    setLoadingPhase("importing")
    setStatus("Extraindo produtos do arquivo com OpenAI...")

    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/branch-hunter/supplier-import", {
        method: "POST",
        body: formData,
      })
      const rawResponse = await response.text()
      const payload = parseJsonResponse<SupplierImportResponse>(rawResponse)
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(
          payload?.error ||
            buildApiErrorMessage(
              response,
              "Erro ao importar o arquivo na extracao OpenAI.",
              rawResponse,
            ),
        )
      }

      const normalizedRows =
        payload.data.rows.length > 0
          ? payload.data.rows
          : parseSupplierRowsFromText(payload.data.rawText)

      setImportedRows(normalizedRows)
      setRawTable(payload.data.rawText)
      setStatus(`${normalizedRows.length} itens extraidos. Iniciando analise automatica...`)

      await runSupplierScan(normalizedRows)
    } catch (error) {
      setImportedRows([])
      setRawTable("")
      setResults([])
      setSummary(null)
      setLoadingPhase("idle")
      setStatus(
        error instanceof Error ? error.message : "Erro ao importar arquivo na extracao OpenAI.",
      )
    }
  }

  async function handleCopySummary() {
    if (results.length === 0) return
    const text = results
      .map(
        (row) =>
          `${row.supplierName} | custo ${formatBrl(row.supplierCost)} | venda ${formatBrl(row.salePrice)} | taxa ${formatBrl(row.feeAmount)} | lucro ${formatBrl(row.netProfit)} | margem ${formatPercent(row.netMargin)} | ${row.catalogLink}`,
      )
      .join("\n")
    await navigator.clipboard.writeText(text)
    setStatus("Resumo copiado para a area de transferencia.")
  }

  return (
    <Card className="border-emerald-200/80 bg-gradient-to-b from-white via-white to-emerald-50/30">
      <CardHeader className="space-y-3 border-b border-emerald-100/80 pb-5">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
            <Store className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Analise de Fornecedor</CardTitle>
            <p className="text-sm text-muted-foreground">
              A extracao da OpenAI vira insumo. O que manda aqui e a margem final calculada com base
              no catalogo do Mercado Livre.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Parametros
              </div>
              <h3 className="text-base font-semibold">Importar e analisar</h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Margem minima (%)</label>
              <Input value={minMargin} onChange={(event) => setMinMargin(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Arquivo do fornecedor</label>
              <Input
                type="file"
                accept=".pdf,.csv,.txt,.xlsx,.xls,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                disabled={isBusy}
              />
            </div>

            {importedFileName && (
              <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{importedFileName}</span>
              </div>
            )}

            <Button
              onClick={() => runSupplierScan(extractedRows)}
              disabled={isBusy || !hasImport}
              className="h-11 w-full gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {loadingPhase === "importing" && <Loader2 className="size-4 animate-spin" />}
              {loadingPhase === "scanning" && <Loader2 className="size-4 animate-spin" />}
              {loadingPhase === "idle" && <ScanSearch className="size-4" />}
              {loadingPhase === "importing"
                ? "Extraindo com OpenAI..."
                : loadingPhase === "scanning"
                  ? "Calculando margem..."
                  : "Reprocessar analise"}
            </Button>

            <div className="rounded-2xl border bg-emerald-50 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-700/80">
                Status
              </div>
              <p className="mt-2 text-sm text-foreground">{status}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric label="Itens extraidos" value={String(extractedRows.length)} />
              <SummaryMetric label="Catalogos encontrados" value={String(summary?.matched ?? 0)} />
              <SummaryMetric
                label="Produtos aprovados"
                value={String(results.length)}
                tone="success"
              />
              <SummaryMetric
                label="Margem alvo"
                value={formatPercent(summary?.minMargin ?? parseLocaleNumber(minMargin) ?? 15)}
              />
            </div>

            <div className="rounded-3xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Produtos aprovados</h3>
                    {results.length > 0 && (
                      <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        <CheckCircle2 className="mr-1 size-3.5" />
                        {results.length} encontrados
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Mostrando apenas os itens que passaram pela margem minima definida.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySummary}
                    disabled={results.length === 0}
                    className="gap-2 rounded-full"
                  >
                    <Copy className="size-4" />
                    Copiar resumo
                  </Button>
                </div>
              </div>

              {results.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Custo</TableHead>
                        <TableHead>Venda</TableHead>
                        <TableHead>Taxa ML</TableHead>
                        <TableHead>Lucro</TableHead>
                        <TableHead>Margem</TableHead>
                        <TableHead>Links</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((row) => (
                        <TableRow key={`${row.catalogProductId}-${row.gtin}`}>
                          <TableCell className="min-w-[280px] align-top">
                            <div className="space-y-1">
                              <div className="font-medium">{row.supplierName}</div>
                              <div className="text-xs text-muted-foreground">{row.catalogName}</div>
                              <div className="text-xs text-muted-foreground">GTIN {row.gtin}</div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">{formatBrl(row.supplierCost)}</TableCell>
                          <TableCell className="align-top">{formatBrl(row.salePrice)}</TableCell>
                          <TableCell className="align-top">{formatBrl(row.feeAmount)}</TableCell>
                          <TableCell className="align-top font-medium text-foreground">
                            {formatBrl(row.netProfit)}
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              {formatPercent(row.netMargin)}
                            </span>
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
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="rounded-2xl bg-muted/40 p-4">
                    <FileSearch className="size-8 text-muted-foreground" />
                  </div>
                  <h4 className="mt-4 text-base font-semibold">Nenhum aprovado ainda</h4>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    Assim que a extracao terminar, o sistema cruza os itens com o Mercado Livre e
                    mostra aqui apenas os produtos acima da margem minima.
                  </p>
                </div>
              )}
            </div>

            <details className="rounded-3xl border bg-white px-5 py-4 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-medium">
                Ver saida bruta da OpenAI ({extractedRows.length} itens)
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Essa area fica secundaria porque o foco principal e a aprovacao por margem.
              </p>
              <Textarea
                className="mt-4 min-h-72 font-mono text-xs"
                value={rawTable}
                readOnly
                placeholder="A extracao bruta vai aparecer aqui."
              />
            </details>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
