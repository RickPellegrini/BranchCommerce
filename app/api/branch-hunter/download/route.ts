import { promises as fs } from "fs"
import path from "path"

import { NextResponse } from "next/server"
import { zipSync } from "fflate"

import { getCurrentUserEmail } from "@/lib/auth/server"
import { isAdminEmail } from "@/lib/auth/admin"

async function collectFiles(
  rootDir: string,
  currentDir: string,
  files: Record<string, Uint8Array>,
) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      await collectFiles(rootDir, absolutePath, files)
      continue
    }

    const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/")
    const content = await fs.readFile(absolutePath)
    files[`branch-hunter/${relativePath}`] = new Uint8Array(content)
  }
}

export async function GET() {
  try {
    const email = await getCurrentUserEmail()
    if (!isAdminEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Sem permissao para baixar a extensao." },
        { status: 403 },
      )
    }

    const extensionRoot = path.join(process.cwd(), "extensions", "branch-hunter")
    const zipFiles: Record<string, Uint8Array> = {}
    await collectFiles(extensionRoot, extensionRoot, zipFiles)
    const zipContent = zipSync(zipFiles, { level: 6 })

    return new NextResponse(Buffer.from(zipContent), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="branch-hunter-extension.zip"',
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao gerar arquivo da extensao.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
