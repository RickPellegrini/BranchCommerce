export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function dateRange(days: number): { from: string; to: string } {
  const now = new Date()
  const past = new Date(now)
  past.setDate(past.getDate() - days)
  return { from: toIsoDate(past), to: toIsoDate(now) }
}

export function daysSince(iso?: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
}

export function formatDateBr(iso?: string | null): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("pt-BR")
}
