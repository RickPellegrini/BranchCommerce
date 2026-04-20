import type { MlAttribute } from "@/features/product-analysis/domain/types"

const STOPWORDS = new Set([
  "a",
  "o",
  "e",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "na",
  "no",
  "um",
  "uma",
  "para",
  "por",
  "com",
  "se",
  "que",
  "ou",
  "ao",
  "pelo",
  "pela",
  "mais",
  "como",
  "ser",
  "ter",
  "muito",
  "so",
  "kit",
  "pç",
  "pcs",
  "und",
  "uni",
  "c",
])

export function removeStopwords(text: string): string {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .join(" ")
}

export function normalizeTitle(title: string): string {
  let t = title.toLowerCase()
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  t = t.replace(/[^a-z0-9\s]/g, " ")
  t = removeStopwords(t)
  return t.replace(/\s+/g, " ").trim()
}

function findAttr(attrs: MlAttribute[], id: string): string | null {
  const a = attrs.find((x) => x.id.toUpperCase() === id.toUpperCase())
  return a?.value_name?.trim() || null
}

export function extractBrand(attrs: MlAttribute[]): string | null {
  return findAttr(attrs, "BRAND")
}

export function extractModel(attrs: MlAttribute[]): string | null {
  return (
    findAttr(attrs, "MODEL") ?? findAttr(attrs, "LINE") ?? findAttr(attrs, "ALPHANUMERIC_MODEL")
  )
}

export function extractGtin(attrs: MlAttribute[]): string | null {
  return (
    findAttr(attrs, "GTIN") ??
    findAttr(attrs, "EAN") ??
    findAttr(attrs, "UPC") ??
    findAttr(attrs, "ISBN")
  )
}

export function extractVoltage(attrs: MlAttribute[]): string | null {
  return findAttr(attrs, "VOLTAGE")
}

export function extractCapacity(attrs: MlAttribute[]): string | null {
  return (
    findAttr(attrs, "CAPACITY") ?? findAttr(attrs, "TOTAL_CAPACITY") ?? findAttr(attrs, "WEIGHT")
  )
}

export function extractColor(attrs: MlAttribute[]): string | null {
  return findAttr(attrs, "COLOR") ?? findAttr(attrs, "MAIN_COLOR")
}

export function titleSimilarity(a: string, b: string): number {
  const wA = new Set(normalizeTitle(a).split(/\s+/))
  const wB = new Set(normalizeTitle(b).split(/\s+/))
  if (wA.size === 0 || wB.size === 0) return 0
  let inter = 0
  for (const w of wA) if (wB.has(w)) inter++
  const union = new Set([...wA, ...wB]).size
  return union > 0 ? inter / union : 0
}
