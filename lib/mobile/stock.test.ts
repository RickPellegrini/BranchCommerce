import { describe, expect, it } from "vitest"

import { compareMobileStockProducts, nextStockQuantity } from "./stock"

describe("mobile stock helpers", () => {
  it("shows available products before low and empty products", () => {
    const products = [
      { name: "Sem estoque", quantity: 0, minStock: 2 },
      { name: "Baixo", quantity: 1, minStock: 2 },
      { name: "Disponível", quantity: 8, minStock: 2 },
    ]

    expect(products.sort(compareMobileStockProducts).map((product) => product.name)).toEqual([
      "Disponível",
      "Baixo",
      "Sem estoque",
    ])
  })

  it("calculates every movement type consistently", () => {
    expect(nextStockQuantity(10, "in", 3)).toBe(13)
    expect(nextStockQuantity(10, "out", 3)).toBe(7)
    expect(nextStockQuantity(10, "sale", 3)).toBe(7)
    expect(nextStockQuantity(10, "adjustment", 3)).toBe(3)
  })
})
