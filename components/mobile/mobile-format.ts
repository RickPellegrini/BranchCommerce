export function formatMobileCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatMobileDate(value?: string | number | null): string {
  if (!value) return "Sem data"
  const date =
    typeof value === "number"
      ? new Date(value)
      : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return "Sem data"
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date)
}

export function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
