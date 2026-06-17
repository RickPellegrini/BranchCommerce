export type SupplierRow = {
  code: string
  name: string
  gtin: string
  cost: number
}

export function parseLocaleNumber(value: string) {
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

function parsePdfStyleRow(line: string): SupplierRow | null {
  const normalizedLine = String(line ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalizedLine) return null

  const match = normalizedLine.match(/^(\d+)\s+(.+?)\s+(\d{8,14})\s+(?:R\$\s*)?(\d+[.,]\d{2})$/i)
  if (!match) return null

  const cost = parseLocaleNumber(match[4])
  if (cost === null) return null

  return {
    code: match[1],
    name: match[2].trim(),
    gtin: match[3],
    cost,
  }
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) ?? ""
  if (sample.includes("\t")) return "\t"
  if (sample.includes(";")) return ";"
  return ","
}

export function parseSupplierTable(text: string): SupplierRow[] {
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
    return lines
      .slice(1)
      .map(parsePdfStyleRow)
      .filter((row): row is SupplierRow => row !== null)
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

export function parseSupplierPdfText(text: string): SupplierRow[] {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const rows: SupplierRow[] = []

  for (const line of lines) {
    const parsedRow = parsePdfStyleRow(line)
    if (parsedRow) {
      rows.push(parsedRow)
      continue
    }

    const richMatch = line.match(
      /^(\d+)\s+(.+?)\s+(\d{8,14})\s+R\$(\d+[.,]\d{2})\s+\d+\s+\d+\s+\d{8,14}\s+R\$\d+[.,]\d{2}$/i,
    )
    if (!richMatch) continue

    const cost = parseLocaleNumber(richMatch[4])
    if (cost === null) continue

    rows.push({
      code: richMatch[1],
      name: richMatch[2].trim(),
      gtin: richMatch[3],
      cost,
    })
  }

  return rows
}

export function rowsToTabbedText(rows: SupplierRow[]) {
  if (rows.length === 0) return ""
  const header = "codigo\tdescricao\tgtin\tcusto"
  const body = rows.map((row) => `${row.code}\t${row.name}\t${row.gtin}\t${row.cost.toFixed(2)}`)
  return [header, ...body].join("\n")
}
