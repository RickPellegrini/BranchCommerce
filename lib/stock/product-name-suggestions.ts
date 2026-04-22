/** Normaliza texto para comparação (minúsculas, sem acentos). */
export function normalizeProductSearchText(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
}

export type ProductSuggestionCandidate = {
  id: string
  name: string
  sku?: string
  imageUrl?: string
  mlItemId?: string
  sellingPrice?: number
}

/**
 * Sugestões para alinhar nome/foto ao catálogo (ex.: item já sincronizado com ML).
 * Prioriza itens com ML ou imagem; ordena por relevância do texto.
 */
export function getProductNameSuggestions(
  query: string,
  candidates: ProductSuggestionCandidate[],
  limit = 8,
): ProductSuggestionCandidate[] {
  const q = normalizeProductSearchText(query)
  if (q.length < 2) return []

  const scored: { p: ProductSuggestionCandidate; score: number }[] = []

  for (const p of candidates) {
    const name = normalizeProductSearchText(p.name)
    if (!name.includes(q)) continue

    let score = 0
    if (name.startsWith(q)) score += 50
    const idx = name.indexOf(q)
    score += Math.max(0, 40 - idx)
    score -= Math.min(20, p.name.length / 20)
    if (p.mlItemId) score += 15
    if (p.imageUrl) score += 10

    scored.push({ p, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.p)
}
