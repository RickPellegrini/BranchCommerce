function escapeCsvCell(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function movementTypePt(type: "in" | "out" | "adjustment" | "sale"): string {
  switch (type) {
    case "in":
      return "Entrada"
    case "out":
      return "Saida"
    case "adjustment":
      return "Ajuste"
    case "sale":
      return "Venda"
    default:
      return type
  }
}

export type StockMovementExportRow = {
  id: string
  productId: string
  type: "in" | "out" | "adjustment" | "sale"
  quantity: number
  date: string
  unitPrice?: number
  note?: string
  createdAt?: number
}

export type StockProductExportInfo = {
  name: string
  sku: string
  category: string
  mlItemId?: string
  unitCost: number
  sellingPrice?: number
}

/** Exporta o historico de movimentacoes com dados do produto (CSV UTF-8, separador `;`). */
export function exportStockMovementHistoryToCsv(
  movements: StockMovementExportRow[],
  productById: Map<string, StockProductExportInfo>,
): void {
  const header = [
    "IdMovimento",
    "DataMovimento",
    "DataRegistro",
    "IdProduto",
    "NomeProduto",
    "MLB_ID",
    "Categoria",
    "CustoUnitarioProduto",
    "PrecoVendaCatalogo",
    "TipoMovimento",
    "CodigoTipo",
    "Quantidade",
    "PrecoUnitarioMovimento",
    "Observacao",
  ]

  const sorted = movements.slice().sort((a, b) => b.date.localeCompare(a.date))

  const lines = [header.join(";")]
  for (const m of sorted) {
    const p = productById.get(m.productId)
    const nome = p?.name ?? ""
    const mlbId = p?.mlItemId ?? p?.sku ?? ""
    const cat = p?.category ?? ""
    const custo = p != null ? String(p.unitCost) : ""
    const pvCat = p?.sellingPrice != null ? String(p.sellingPrice) : ""
    const reg = m.createdAt != null ? new Date(m.createdAt).toISOString() : ""
    const puMov = m.unitPrice != null ? String(m.unitPrice) : ""

    lines.push(
      [
        m.id,
        m.date,
        reg,
        m.productId,
        nome,
        mlbId,
        cat,
        custo,
        pvCat,
        movementTypePt(m.type),
        m.type,
        String(m.quantity),
        puMov,
        m.note ?? "",
      ]
        .map((c) => escapeCsvCell(String(c)))
        .join(";"),
    )
  }

  const bom = "\uFEFF"
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `historico-estoque-${new Date().toISOString().slice(0, 10)}.csv`
  a.rel = "noopener"
  a.click()
  URL.revokeObjectURL(url)
}
