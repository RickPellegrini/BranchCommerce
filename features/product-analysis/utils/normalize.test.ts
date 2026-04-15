import { describe, expect, it } from "vitest"

import type { MlAttribute } from "@/features/product-analysis/domain/types"

import {
  extractBrand,
  extractCapacity,
  extractColor,
  extractGtin,
  extractModel,
  extractVoltage,
  normalizeTitle,
  removeStopwords,
  titleSimilarity,
} from "./normalize"

function attr(id: string, value_name: string | null): MlAttribute {
  return { id, name: id, value_id: null, value_name, values: [] }
}

// ── removeStopwords ─────────────────────────────────────────────────

describe("removeStopwords", () => {
  it("removes Portuguese stopwords", () => {
    expect(removeStopwords("caixa de som para festa")).toBe("caixa som festa")
  })

  it("removes single-char words", () => {
    expect(removeStopwords("a b caixa")).toBe("caixa")
  })

  it("keeps meaningful words", () => {
    expect(removeStopwords("produto importado premium")).toBe("produto importado premium")
  })
})

// ── normalizeTitle ──────────────────────────────────────────────────

describe("normalizeTitle", () => {
  it("lowercases input", () => {
    expect(normalizeTitle("CAIXA DE SOM")).not.toMatch(/[A-Z]/)
  })

  it("removes accents", () => {
    expect(normalizeTitle("Café Açúcar")).not.toMatch(/[àáâãäéêíóôõúü]/)
  })

  it("removes punctuation", () => {
    expect(normalizeTitle("Produto (10x) - 220V!")).not.toMatch(/[()!-]/)
  })

  it("removes stopwords and normalizes spaces", () => {
    const result = normalizeTitle("Caixa de Som para Festa com LED")
    expect(result).not.toContain("  ")
    expect(result).not.toContain(" de ")
    expect(result).not.toContain(" para ")
    expect(result).not.toContain(" com ")
  })

  it("full normalization pipeline", () => {
    const result = normalizeTitle("Smartphone Samsung Galaxy S24 Ultra 256GB")
    expect(result).toBe("smartphone samsung galaxy s24 ultra 256gb")
  })
})

// ── extractBrand ────────────────────────────────────────────────────

describe("extractBrand", () => {
  it("extracts BRAND attribute", () => {
    expect(extractBrand([attr("BRAND", "Samsung")])).toBe("Samsung")
  })

  it("is case-insensitive on attribute id", () => {
    expect(extractBrand([attr("brand", "Apple")])).toBe("Apple")
  })

  it("returns null when not found", () => {
    expect(extractBrand([attr("COLOR", "Preto")])).toBeNull()
  })
})

// ── extractModel ────────────────────────────────────────────────────

describe("extractModel", () => {
  it("extracts MODEL attribute", () => {
    expect(extractModel([attr("MODEL", "Galaxy S24")])).toBe("Galaxy S24")
  })

  it("falls back to LINE", () => {
    expect(extractModel([attr("LINE", "Galaxy")])).toBe("Galaxy")
  })

  it("falls back to ALPHANUMERIC_MODEL", () => {
    expect(extractModel([attr("ALPHANUMERIC_MODEL", "SM-S928B")])).toBe("SM-S928B")
  })

  it("returns null when none found", () => {
    expect(extractModel([attr("BRAND", "Test")])).toBeNull()
  })
})

// ── extractGtin ─────────────────────────────────────────────────────

describe("extractGtin", () => {
  it("extracts GTIN", () => {
    expect(extractGtin([attr("GTIN", "7891234567890")])).toBe("7891234567890")
  })

  it("falls back to EAN", () => {
    expect(extractGtin([attr("EAN", "1234567890")])).toBe("1234567890")
  })

  it("falls back to UPC", () => {
    expect(extractGtin([attr("UPC", "012345678901")])).toBe("012345678901")
  })

  it("falls back to ISBN", () => {
    expect(extractGtin([attr("ISBN", "978-3-16-148410-0")])).toBe("978-3-16-148410-0")
  })
})

// ── extractVoltage / extractCapacity / extractColor ─────────────────

describe("extractVoltage", () => {
  it("extracts voltage", () => {
    expect(extractVoltage([attr("VOLTAGE", "220V")])).toBe("220V")
  })

  it("returns null when not present", () => {
    expect(extractVoltage([])).toBeNull()
  })
})

describe("extractCapacity", () => {
  it("extracts CAPACITY", () => {
    expect(extractCapacity([attr("CAPACITY", "256GB")])).toBe("256GB")
  })

  it("falls back to WEIGHT", () => {
    expect(extractCapacity([attr("WEIGHT", "500g")])).toBe("500g")
  })
})

describe("extractColor", () => {
  it("extracts COLOR", () => {
    expect(extractColor([attr("COLOR", "Preto")])).toBe("Preto")
  })

  it("falls back to MAIN_COLOR", () => {
    expect(extractColor([attr("MAIN_COLOR", "Azul")])).toBe("Azul")
  })
})

// ── titleSimilarity ─────────────────────────────────────────────────

describe("titleSimilarity", () => {
  it("returns 1 for identical titles", () => {
    expect(titleSimilarity("Caixa de Som", "Caixa de Som")).toBe(1)
  })

  it("returns 0 for completely different titles", () => {
    expect(titleSimilarity("Smartphone Samsung", "Cafeteira Nespresso")).toBe(0)
  })

  it("returns value between 0 and 1 for partial overlap", () => {
    const sim = titleSimilarity("Samsung Galaxy S24 Ultra", "Samsung Galaxy S24")
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })

  it("returns 0 when one title is empty", () => {
    expect(titleSimilarity("", "Something")).toBe(0)
  })
})
