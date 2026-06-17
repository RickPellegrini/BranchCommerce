import { NextRequest } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import {
  parseSupplierPdfText,
  parseSupplierTable,
  rowsToTabbedText,
} from "@/lib/branch-hunter/supplier-parser"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

async function ensurePdfNodeGlobals() {
  if (typeof globalThis.DOMMatrix !== "undefined") return
  const nodeRequire = eval("require") as (id: string) => {
    DOMMatrix: typeof globalThis.DOMMatrix
    ImageData: typeof globalThis.ImageData
    Path2D: typeof globalThis.Path2D
  }
  const canvas = nodeRequire("@napi-rs/canvas")
  globalThis.DOMMatrix = canvas.DOMMatrix as typeof globalThis.DOMMatrix
  globalThis.ImageData = canvas.ImageData as typeof globalThis.ImageData
  globalThis.Path2D = canvas.Path2D as typeof globalThis.Path2D
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedAppUserId()

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "Arquivo obrigatorio." }, { status: 400 })
    }

    const lowerName = file.name.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())

    let extractedText = ""
    let rows = []

    if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
      await ensurePdfNodeGlobals()
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      extractedText = result.text
      rows = parseSupplierPdfText(extractedText)
      await parser.destroy()
    } else {
      extractedText = new TextDecoder("utf-8").decode(buffer)
      rows = parseSupplierTable(extractedText)
    }

    return Response.json({
      ok: true,
      data: {
        fileName: file.name,
        rows,
        rawText: rowsToTabbedText(rows),
        sourceType: file.type === "application/pdf" || lowerName.endsWith(".pdf") ? "pdf" : "text",
      },
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao importar arquivo do fornecedor.",
      },
      { status: 500 },
    )
  }
}
