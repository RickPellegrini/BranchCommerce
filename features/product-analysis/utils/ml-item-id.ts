/** Variantes comuns do mesmo anuncio (MLB-123 vs MLB123) para bater chaves API <-> scrape. */
export function mlItemIdLookupKeys(raw: string): string[] {
  const m = raw.match(/^(MLB)-?(\d+)$/i)
  if (!m) return [raw]
  const digits = m[2]
  const compact = `MLB${digits}`
  const hyphen = `MLB-${digits}`
  return [...new Set([raw, compact, hyphen, raw.replace(/-/g, "")])]
}

export function getScrapedRowForItem<T extends object>(
  map: Record<string, T> | undefined,
  itemId: string,
): T | undefined {
  if (!map) return undefined
  for (const k of mlItemIdLookupKeys(itemId)) {
    const row = map[k]
    if (row !== undefined) return row
  }
  return undefined
}
