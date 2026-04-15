import { describe, expect, it } from "vitest"

import type { MlItemFull } from "@/features/product-analysis/domain/types"

import { computeCompleteness } from "./scoring"

function makeItem(overrides: Partial<MlItemFull> = {}): MlItemFull {
  return {
    id: "MLB123",
    title: "Test Product",
    site_id: "MLB",
    category_id: "MLB12345",
    price: 100,
    original_price: null,
    currency_id: "BRL",
    available_quantity: 0,
    sold_quantity: 0,
    listing_type_id: "gold_special",
    condition: "new",
    permalink: "https://example.com",
    thumbnail: "https://example.com/thumb.jpg",
    pictures: [],
    attributes: [],
    tags: [],
    catalog_product_id: null,
    seller_id: 1,
    official_store_id: null,
    status: "active",
    shipping: {},
    ...overrides,
  }
}

describe("computeCompleteness", () => {
  it("returns score 0 for minimal item", () => {
    const { score } = computeCompleteness(makeItem())
    expect(score).toBeLessThan(20)
  })

  it("returns score 100 for fully complete item", () => {
    const item = makeItem({
      catalog_product_id: "MLB-P-123",
      available_quantity: 10,
      condition: "new",
      original_price: 150,
      shipping: { free_shipping: true },
      pictures: [
        { id: "1", url: "a", secure_url: "a" },
        { id: "2", url: "b", secure_url: "b" },
        { id: "3", url: "c", secure_url: "c" },
      ],
      attributes: [
        { id: "BRAND", name: "Marca", value_id: null, value_name: "Samsung", values: [] },
        { id: "MODEL", name: "Modelo", value_id: null, value_name: "Galaxy", values: [] },
        { id: "GTIN", name: "GTIN", value_id: null, value_name: "789123456", values: [] },
        { id: "COLOR", name: "Cor", value_id: null, value_name: "Preto", values: [] },
        { id: "VOLTAGE", name: "Voltagem", value_id: null, value_name: "220V", values: [] },
      ],
    })
    const { score } = computeCompleteness(item)
    expect(score).toBe(100)
  })

  it("details array has 10 entries with field, present, weight", () => {
    const { details } = computeCompleteness(makeItem())
    expect(details).toHaveLength(10)
    details.forEach((d) => {
      expect(d).toHaveProperty("field")
      expect(d).toHaveProperty("present")
      expect(d).toHaveProperty("weight")
      expect(d.weight).toBeGreaterThan(0)
    })
  })

  it("catalog_product_id alone contributes 15 points", () => {
    const base = computeCompleteness(makeItem())
    const withCatalog = computeCompleteness(makeItem({ catalog_product_id: "MLB-P-1" }))
    const diff = withCatalog.score - base.score
    expect(diff).toBe(15)
  })

  it("stock_positive contributes 15 points", () => {
    const base = computeCompleteness(makeItem({ available_quantity: 0 }))
    const withStock = computeCompleteness(makeItem({ available_quantity: 5 }))
    const diff = withStock.score - base.score
    expect(diff).toBe(15)
  })

  it("free_shipping contributes 10 points", () => {
    const base = computeCompleteness(makeItem())
    const withShipping = computeCompleteness(makeItem({ shipping: { free_shipping: true } }))
    const diff = withShipping.score - base.score
    expect(diff).toBe(10)
  })
})
