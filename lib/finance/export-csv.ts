import type { FinancialCategory, FinancialTransaction } from "@/lib/finance/types"

function escapeCsvCell(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportTransactionsToCsv(
  rows: FinancialTransaction[],
  categoryById: Map<string, FinancialCategory>,
  options?: { attachmentCounts?: Record<string, number> },
): void {
  const header = [
    "Data",
    "Tipo",
    "Descricao",
    "Valor",
    "Categoria",
    "Origem",
    "Periodicidade",
    "Pagamento",
    "Parcela",
    "StatusPagamento",
    "Anexos",
  ]

  const lines = [header.join(";")]
  for (const t of rows) {
    const cat = categoryById.get(t.categoryId)?.name ?? ""
    const pay = t.paymentMethod ?? ""
    const inst =
      t.installmentIndex != null && t.installmentCount != null
        ? `${t.installmentIndex}/${t.installmentCount}`
        : ""
    const ps = t.payStatus ?? ""
    const anexos = options?.attachmentCounts?.[t.id] ?? 0
    lines.push(
      [
        t.date,
        t.kind === "income" ? "Entrada" : "Despesa",
        t.description,
        String(t.amount),
        cat,
        t.origin ?? "",
        t.periodicity ?? "",
        pay,
        inst,
        ps,
        String(anexos),
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
  a.download = `lancamentos-${new Date().toISOString().slice(0, 10)}.csv`
  a.rel = "noopener"
  a.click()
  URL.revokeObjectURL(url)
}
