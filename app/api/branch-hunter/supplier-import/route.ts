import { NextRequest } from "next/server"
import { PDFParse } from "pdf-parse"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import {
  parseSupplierPdfText,
  parseSupplierTable,
  rowsToTabbedText,
} from "@/lib/branch-hunter/supplier-parser"

export const dynamic = "force-dynamic"
export const revalidate = 0

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
