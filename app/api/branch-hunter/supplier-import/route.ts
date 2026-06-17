import { NextRequest } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"
export const maxDuration = 300

type SupplierRow = {
  code: string
  name: string
  gtin: string
  cost: number
}

type OpenAiFileResponse = {
  id?: string
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

type OpenAiResponsesApiResponse = {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
      json?: unknown
    }>
  }>
  error?: {
    message?: string
    type?: string
    code?: string
  }
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

function formatOpenAiError(
  payload: { error?: { message?: string; type?: string; code?: string } } | null,
  fallback: string,
) {
  const message = payload?.error?.message?.trim()
  const code = payload?.error?.code?.trim()
  const type = payload?.error?.type?.trim()
  const details = [message, code, type].filter(Boolean).join(" | ")
  return details ? `${fallback} ${details}` : fallback
}

function formatHttpFailureMessage(status: number, fallback: string) {
  if (status === 504) {
    return `${fallback} A chamada para a OpenAI excedeu o tempo limite (HTTP 504).`
  }
  return `${fallback} HTTP ${status}.`
}

function extractJsonTextFromOpenAiResponse(payload: OpenAiResponsesApiResponse | null) {
  if (!payload) return null

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text
  }

  for (const outputItem of payload.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        return contentItem.text
      }
      if (contentItem.json !== undefined) {
        return JSON.stringify(contentItem.json)
      }
    }
  }

  return null
}

async function uploadFileToOpenAi(file: File, apiKey: string) {
  const formData = new FormData()
  formData.append("purpose", "user_data")
  formData.append("file", file)

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  const rawResponse = await response.text()
  let payload: OpenAiFileResponse | null = null
  try {
    payload = JSON.parse(rawResponse) as OpenAiFileResponse
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.id) {
    throw new Error(
      formatOpenAiError(
        payload,
        formatHttpFailureMessage(response.status, "OpenAI file upload falhou."),
      ),
    )
  }

  return payload.id
}

async function deleteOpenAiFile(fileId: string, apiKey: string) {
  try {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
  } catch {
    // limpeza best effort
  }
}

async function extractSupplierRowsWithOpenAi(fileId: string, fileName: string, apiKey: string) {
  const model = String(process.env.OPENAI_SUPPLIER_EXTRACTION_MODEL ?? "gpt-4o-mini").trim()

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "Voce extrai listas de fornecedores brasileiros.",
                "Leia o arquivo e retorne apenas itens de produto estruturados.",
                "Converta custo para numero decimal usando ponto.",
                "Mantenha gtin apenas com digitos.",
                "Se uma linha estiver ambigua ou incompleta, descarte.",
                "Nao invente dados.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extraia do arquivo ${fileName} uma lista JSON com colunas codigo, name, gtin e cost.`,
            },
            {
              type: "input_file",
              file_id: fileId,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "supplier_rows",
          strict: true,
          schema: {
            type: "object",
            properties: {
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    code: { type: "string" },
                    name: { type: "string" },
                    gtin: { type: "string" },
                    cost: { type: "number" },
                  },
                  required: ["code", "name", "gtin", "cost"],
                  additionalProperties: false,
                },
              },
            },
            required: ["rows"],
            additionalProperties: false,
          },
        },
      },
    }),
  })

  const rawResponse = await response.text()
  let payload: OpenAiResponsesApiResponse | null = null
  try {
    payload = JSON.parse(rawResponse) as OpenAiResponsesApiResponse
  } catch {
    payload = null
  }

  const extractedJson = extractJsonTextFromOpenAiResponse(payload)

  if (!response.ok || !extractedJson) {
    throw new Error(
      formatOpenAiError(
        payload,
        formatHttpFailureMessage(response.status, "OpenAI extraction falhou."),
      ),
    )
  }

  try {
    return JSON.parse(extractedJson) as { rows?: unknown[] }
  } catch {
    throw new Error("OpenAI retornou um payload invalido na extracao do fornecedor.")
  }
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

    const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim()
    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error: "Configure OPENAI_API_KEY para usar a extracao do fornecedor com OpenAI.",
        },
        { status: 500 },
      )
    }

    const incomingFormData = await request.formData()
    const file = incomingFormData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "Arquivo obrigatorio." }, { status: 400 })
    }

    const fileId = await uploadFileToOpenAi(file, apiKey)
    let extractedPayload: unknown = null
    try {
      extractedPayload = await extractSupplierRowsWithOpenAi(fileId, file.name, apiKey)
    } finally {
      await deleteOpenAiFile(fileId, apiKey)
    }

    const rows = normalizeSupplierRows(extractedPayload)
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
          error instanceof Error ? error.message : "Erro ao importar arquivo pela extracao OpenAI.",
      },
      { status: 500 },
    )
  }
}
