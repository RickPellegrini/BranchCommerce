import { NextRequest } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

type SupplierRow = {
  code: string
  name: string
  gtin: string
  cost: number
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeGtin(value: unknown) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .trim()
}

function normalizeCost(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[R$r$]/gi, "")
  if (!raw) return null
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function rowsToTabbedText(rows: SupplierRow[]) {
  if (rows.length === 0) return ""
  const header = "codigo\tdescricao\tgtin\tcusto"
  const body = rows.map((row) => `${row.code}\t${row.name}\t${row.gtin}\t${row.cost.toFixed(2)}`)
  return [header, ...body].join("\n")
}

function normalizeSupplierRows(payload: unknown): SupplierRow[] {
  const source =
    (payload as { rows?: unknown[] })?.rows ??
    (payload as { data?: { rows?: unknown[] } })?.data?.rows ??
    (payload as { result?: { rows?: unknown[] } })?.result?.rows ??
    (payload as { items?: unknown[] })?.items ??
    []

  if (!Array.isArray(source)) return []

  return source
    .map((row) => {
      const record = row as Record<string, unknown>
      return {
        code: normalizeText(record.code ?? record.codigo ?? record.sku),
        name: normalizeText(
          record.name ?? record.nome ?? record.descricao ?? record.descrição ?? record.produto,
        ),
        gtin: normalizeGtin(record.gtin ?? record.ean ?? record["gtin/ean"] ?? record.barcode),
        cost: normalizeCost(record.cost ?? record.custo ?? record.preco ?? record.preço),
      }
    })
    .filter((row): row is SupplierRow => Boolean(row.name && row.gtin) && row.cost !== null)
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedAppUserId()

    const doclingUrl = String(
      process.env.DOCLING_SUPPLIER_EXTRACT_URL ?? process.env.EXTEND_SUPPLIER_EXTRACT_URL ?? "",
    ).trim()
    if (!doclingUrl) {
      return Response.json(
        {
          ok: false,
          error:
            "Configure DOCLING_SUPPLIER_EXTRACT_URL para usar a extracao do fornecedor via Docling.",
        },
        { status: 500 },
      )
    }

    const incomingFormData = await request.formData()
    const file = incomingFormData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "Arquivo obrigatorio." }, { status: 400 })
    }

    const upstreamFormData = new FormData()
    upstreamFormData.append("file", file)

    const apiKey = String(
      process.env.DOCLING_SUPPLIER_EXTRACT_API_KEY ??
        process.env.EXTEND_SUPPLIER_EXTRACT_API_KEY ??
        "",
    ).trim()
    const authToken = String(
      process.env.DOCLING_SUPPLIER_EXTRACT_BEARER_TOKEN ??
        process.env.EXTEND_SUPPLIER_EXTRACT_BEARER_TOKEN ??
        "",
    ).trim()

    const headers = new Headers()
    if (apiKey) headers.set("x-api-key", apiKey)
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`)

    const upstreamResponse = await fetch(doclingUrl, {
      method: "POST",
      headers,
      body: upstreamFormData,
    })

    const rawResponse = await upstreamResponse.text()
    let payload: unknown = null
    try {
      payload = JSON.parse(rawResponse)
    } catch {
      payload = null
    }

    if (!upstreamResponse.ok) {
      return Response.json(
        {
          ok: false,
          error:
            (payload as { error?: string })?.error ||
            `Docling respondeu HTTP ${upstreamResponse.status}.`,
        },
        { status: upstreamResponse.status },
      )
    }

    const rows = normalizeSupplierRows(payload)
    const sourceType = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "text"

    return Response.json({
      ok: true,
      data: {
        fileName: file.name,
        rows,
        rawText: rowsToTabbedText(rows),
        sourceType,
      },
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao importar arquivo pela extracao Docling.",
      },
      { status: 500 },
    )
  }
}
