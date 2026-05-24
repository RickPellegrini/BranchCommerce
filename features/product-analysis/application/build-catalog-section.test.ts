import { describe, expect, it } from "vitest"

import type { MlItemFull } from "@/features/product-analysis/domain/types"

import { buildCatalogSection } from "./build-catalog-section"

function makeItem(overrides: Partial<MlItemFull> = {}): MlItemFull {
  return {
    id: "MLB123",
    title: "Test Product",
    site_id: "MLB",
    category_id: "MLB12345",
    price: 100,
    original_price: null,
    currency_id: "BRL",
    available_quantity: 5,
    sold_quantity: 10,
    listing_type_id: "gold_special",
    condition: "new",
    permalink: "https://example.com/item",
    thumbnail: "https://example.com/thumb.jpg",
    pictures: [{ id: "1", url: "http://img.jpg", secure_url: "https://img.jpg" }],
    attributes: [
      { id: "BRAND", name: "Marca", value_id: null, value_name: "TestBrand", values: [] },
    ],
    tags: [],
    catalog_product_id: null,
    seller_id: 1,
    official_store_id: null,
    status: "active",
    shipping: { free_shipping: true, logistic_type: "xd_drop_off" },
    date_created: "2024-01-15T10:00:00Z",
    ...overrides,
  }
}

describe("buildCatalogSection", () => {
  it("sets status to 'linked' when catalog_product_id is present", () => {
    const item = makeItem({ catalog_product_id: "MLB-P-100" })
    const section = buildCatalogSection(item, null, null, null)
    expect(section.status).toBe("linked")
    expect(section.catalogProductId).toBe("MLB-P-100")
  })

  it("sets status to 'eligible' when tag is present", () => {
    const item = makeItem({ tags: ["catalog_listing_eligible"] })
    const section = buildCatalogSection(item, null, null, null)
    expect(section.status).toBe("eligible")
  })

  it("sets status to 'linked' when catalog_listing is truthy", () => {
    const item = makeItem({ catalog_listing: true })
    const section = buildCatalogSection(item, null, null, null)
    expect(section.status).toBe("linked")
  })

  it("sets status to 'not_catalog' as fallback", () => {
    const item = makeItem()
    const section = buildCatalogSection(item, null, null, null)
    expect(section.status).toBe("not_catalog")
  })

  it("populates item fields correctly", () => {
    const section = buildCatalogSection(makeItem(), 100, 400, null)
    expect(section.item.id).toBe("MLB123")
    expect(section.item.title).toBe("Test Product")
    expect(section.item.price).toBe(100)
    expect(section.item.stock).toBe(5)
    expect(section.item.sold).toBe(10)
    expect(section.item.freeShipping).toBe(true)
    expect(section.visits["7d"]).toBe(100)
    expect(section.visits["30d"]).toBe(400)
  })

  it("keeps unavailable stock and sold values as null", () => {
    const section = buildCatalogSection(
      makeItem({ available_quantity: null, sold_quantity: null }),
      null,
      null,
      null,
    )
    expect(section.item.stock).toBeNull()
    expect(section.item.sold).toBeNull()
  })

  it("extracts identifiers from attributes", () => {
    const item = makeItem({
      attributes: [
        { id: "BRAND", name: "Marca", value_id: null, value_name: "Samsung", values: [] },
        { id: "MODEL", name: "Modelo", value_id: null, value_name: "Galaxy", values: [] },
        { id: "GTIN", name: "GTIN", value_id: null, value_name: "789000", values: [] },
      ],
    })
    const section = buildCatalogSection(item, null, null, null)
    expect(section.identifiers.brand).toBe("Samsung")
    expect(section.identifiers.model).toBe("Galaxy")
    expect(section.identifiers.gtin).toBe("789000")
    expect(section.identifiers.hasBrand).toBe(true)
    expect(section.identifiers.hasModel).toBe(true)
    expect(section.identifiers.hasGtin).toBe(true)
  })

  it("includes completeness score and details", () => {
    const section = buildCatalogSection(makeItem(), null, null, null)
    expect(typeof section.completenessScore).toBe("number")
    expect(Array.isArray(section.completenessDetails)).toBe(true)
    expect(section.completenessDetails.length).toBeGreaterThan(0)
  })
})
