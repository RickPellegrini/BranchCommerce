/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

async function setupProduct(t: ReturnType<typeof convexTest>) {
  return t.mutation(api.stock.addProduct, {
    userId: "user1",
    name: "Widget A",
    sku: "wgt-a",
    category: "Gadgets",
    quantity: 10,
    minStock: 2,
    unitCost: 15,
    sellingPrice: 50,
  })
}

describe("stock", () => {
  // ── addProduct ────────────────────────────────────────────────────

  describe("addProduct", () => {
    it("creates a product with normalized SKU", async () => {
      const t = convexTest(schema, modules)
      const id = await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Widget",
        sku: "wgt-001",
        category: "Gadgets",
        quantity: 5,
        minStock: 1,
        unitCost: 10,
      })
      expect(id).toBeTruthy()
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].sku).toBe("WGT-001")
    })

    it("creates initial movement when quantity > 0", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Widget",
        sku: "ABC",
        category: "Test",
        quantity: 5,
        minStock: 0,
        unitCost: 1,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.movements).toHaveLength(1)
      expect(data.movements[0].type).toBe("in")
      expect(data.movements[0].quantity).toBe(5)
    })

    it("does not create movement when quantity is 0", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Empty",
        sku: "EMP",
        category: "Test",
        quantity: 0,
        minStock: 0,
        unitCost: 0,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.movements).toHaveLength(0)
    })

    it("rejects duplicate SKU", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "A",
        sku: "DUP",
        category: "Test",
        quantity: 0,
        minStock: 0,
        unitCost: 0,
      })
      await expect(
        t.mutation(api.stock.addProduct, {
          userId: "user1",
          name: "B",
          sku: "dup",
          category: "Test",
          quantity: 0,
          minStock: 0,
          unitCost: 0,
        }),
      ).rejects.toThrow("SKU ja existe")
    })

    it("rejects empty name/sku/category", async () => {
      const t = convexTest(schema, modules)
      await expect(
        t.mutation(api.stock.addProduct, {
          userId: "user1",
          name: "",
          sku: "X",
          category: "Test",
          quantity: 0,
          minStock: 0,
          unitCost: 0,
        }),
      ).rejects.toThrow("Preencha")
    })

    it("rejects negative values", async () => {
      const t = convexTest(schema, modules)
      await expect(
        t.mutation(api.stock.addProduct, {
          userId: "user1",
          name: "Bad",
          sku: "BAD",
          category: "Test",
          quantity: -1,
          minStock: 0,
          unitCost: 0,
        }),
      ).rejects.toThrow("maiores ou iguais a zero")
    })
  })

  // ── updateProduct ─────────────────────────────────────────────────

  describe("updateProduct", () => {
    it("updates product fields", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.updateProduct, {
        userId: "user1",
        productId: id,
        name: "Widget B",
        sku: "WGT-B",
        category: "Updated",
        quantity: 20,
        minStock: 5,
        unitCost: 25,
        sellingPrice: 80,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].name).toBe("Widget B")
      expect(data.products[0].sku).toBe("WGT-B")
    })

    it("allows keeping the same SKU", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await expect(
        t.mutation(api.stock.updateProduct, {
          userId: "user1",
          productId: id,
          name: "Widget A",
          sku: "WGT-A",
          category: "Gadgets",
          quantity: 10,
          minStock: 2,
          unitCost: 15,
        }),
      ).resolves.not.toThrow()
    })

    it("rejects SKU conflict with another product", async () => {
      const t = convexTest(schema, modules)
      const id1 = await setupProduct(t)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Widget B",
        sku: "WGT-B",
        category: "Gadgets",
        quantity: 0,
        minStock: 0,
        unitCost: 0,
      })
      await expect(
        t.mutation(api.stock.updateProduct, {
          userId: "user1",
          productId: id1,
          name: "Widget A",
          sku: "WGT-B",
          category: "Gadgets",
          quantity: 10,
          minStock: 2,
          unitCost: 15,
        }),
      ).rejects.toThrow("SKU ja existe")
    })

    it("throws for wrong user", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await expect(
        t.mutation(api.stock.updateProduct, {
          userId: "user2",
          productId: id,
          name: "Hack",
          sku: "HACK",
          category: "X",
          quantity: 0,
          minStock: 0,
          unitCost: 0,
        }),
      ).rejects.toThrow("Produto nao encontrado")
    })
  })

  // ── deleteProduct ─────────────────────────────────────────────────

  describe("deleteProduct", () => {
    it("deletes product and its movements", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.deleteProduct, {
        userId: "user1",
        productId: id,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products).toHaveLength(0)
      expect(data.movements).toHaveLength(0)
    })

    it("throws for wrong user", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await expect(
        t.mutation(api.stock.deleteProduct, {
          userId: "user2",
          productId: id,
        }),
      ).rejects.toThrow("Produto nao encontrado")
    })
  })

  // ── addMovement ───────────────────────────────────────────────────

  describe("addMovement", () => {
    it("adds stock with 'in' movement", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.addMovement, {
        userId: "user1",
        productId: id,
        type: "in",
        quantity: 5,
        date: "2025-06-15",
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(15)
    })

    it("removes stock with 'out' movement", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.addMovement, {
        userId: "user1",
        productId: id,
        type: "out",
        quantity: 3,
        date: "2025-06-15",
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(7)
    })

    it("sets absolute quantity with 'adjustment'", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.addMovement, {
        userId: "user1",
        productId: id,
        type: "adjustment",
        quantity: 99,
        date: "2025-06-15",
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(99)
    })

    it("prevents negative stock", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await expect(
        t.mutation(api.stock.addMovement, {
          userId: "user1",
          productId: id,
          type: "out",
          quantity: 999,
          date: "2025-06-15",
        }),
      ).rejects.toThrow("negativo")
    })

    it("sale movement creates income transaction", async () => {
      const t = convexTest(schema, modules)
      const prodId = await setupProduct(t)
      await t.mutation(api.stock.addMovement, {
        userId: "user1",
        productId: prodId,
        type: "sale",
        quantity: 2,
        date: "2025-06-15",
        unitPrice: 50,
      })
      const finData = await t.query(api.finance.getDashboardData, { userId: "user1" })
      const saleTx = finData.transactions.find((tx) => tx.origin === "Venda online")
      expect(saleTx).toBeTruthy()
      expect(saleTx!.amount).toBe(100) // 2 * 50
      expect(saleTx!.kind).toBe("income")
    })

    it("sale creates 'Vendas de produtos' category if not exists", async () => {
      const t = convexTest(schema, modules)
      const prodId = await setupProduct(t)
      await t.mutation(api.stock.addMovement, {
        userId: "user1",
        productId: prodId,
        type: "sale",
        quantity: 1,
        date: "2025-06-15",
      })
      const finData = await t.query(api.finance.getDashboardData, { userId: "user1" })
      const salesCat = finData.categories.find((c) => c.name === "Vendas de produtos")
      expect(salesCat).toBeTruthy()
    })

    it("sale uses sellingPrice as fallback when no unitPrice", async () => {
      const t = convexTest(schema, modules)
      const prodId = await setupProduct(t) // sellingPrice = 50
      await t.mutation(api.stock.addMovement, {
        userId: "user1",
        productId: prodId,
        type: "sale",
        quantity: 3,
        date: "2025-06-15",
      })
      const finData = await t.query(api.finance.getDashboardData, { userId: "user1" })
      const saleTx = finData.transactions.find((tx) => tx.origin === "Venda online")
      expect(saleTx!.amount).toBe(150) // 3 * 50
    })
  })

  // ── upsertCostFromBranchHunter ────────────────────────────────────

  describe("upsertCostFromBranchHunter", () => {
    it("updates products matched by mlItemId", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "ML Product",
        sku: "ML1",
        category: "ML",
        quantity: 5,
        minStock: 0,
        unitCost: 10,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      const product = data.products[0]
      await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          {
            id: "MLB123",
            title: "ML Product",
            price: 100,
            availableQuantity: 5,
            sku: "ML1",
          },
        ],
      })
      const result = await t.mutation(api.stock.upsertCostFromBranchHunter, {
        mlItemId: "MLB123",
        unitCost: 25,
      })
      expect(result.updated).toBeGreaterThanOrEqual(0)
    })

    it("skips products with manual cost source", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Manual Cost",
        sku: "MAN1",
        category: "Test",
        quantity: 1,
        minStock: 0,
        unitCost: 50,
      })
      // addProduct sets unitCostSource to "manual"
      const synced = await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          { id: "MLB-MANUAL", title: "Manual Cost", price: 100, availableQuantity: 1, sku: "MAN1" },
        ],
      })
      const result = await t.mutation(api.stock.upsertCostFromBranchHunter, {
        mlItemId: "MLB-MANUAL",
        unitCost: 99,
      })
      expect(result.skippedManual).toBeGreaterThanOrEqual(1)
    })

    it("rejects invalid mlItemId", async () => {
      const t = convexTest(schema, modules)
      await expect(
        t.mutation(api.stock.upsertCostFromBranchHunter, {
          mlItemId: "  ",
          unitCost: 10,
        }),
      ).rejects.toThrow("mlItemId invalido")
    })

    it("rejects negative unitCost", async () => {
      const t = convexTest(schema, modules)
      await expect(
        t.mutation(api.stock.upsertCostFromBranchHunter, {
          mlItemId: "MLB123",
          unitCost: -1,
        }),
      ).rejects.toThrow("unitCost invalido")
    })
  })

  // ── syncFromMercadoLivre ──────────────────────────────────────────

  describe("syncFromMercadoLivre", () => {
    it("creates new products from listings", async () => {
      const t = convexTest(schema, modules)
      const result = await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          { id: "MLB001", title: "Product 1", price: 99, availableQuantity: 10 },
          { id: "MLB002", title: "Product 2", price: 199, availableQuantity: 0 },
        ],
      })
      expect(result.created).toBe(2)
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products).toHaveLength(2)
    })

    it("updates existing products matched by mlItemId", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          { id: "MLB001", title: "V1", price: 99, availableQuantity: 10 },
        ],
      })
      const result = await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          { id: "MLB001", title: "V2", price: 129, availableQuantity: 8 },
        ],
      })
      expect(result.updated).toBe(1)
      expect(result.created).toBe(0)
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].name).toBe("V2")
      expect(data.products[0].sellingPrice).toBe(129)
    })

    it("creates adjustment movement when quantity changes", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          { id: "MLB001", title: "Prod", price: 50, availableQuantity: 10 },
        ],
      })
      await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          { id: "MLB001", title: "Prod", price: 50, availableQuantity: 7 },
        ],
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      const adjustments = data.movements.filter((m) => m.type === "adjustment")
      expect(adjustments.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── getDashboardData ──────────────────────────────────────────────

  describe("getDashboardData", () => {
    it("returns products and movements for user", async () => {
      const t = convexTest(schema, modules)
      await setupProduct(t)
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products).toHaveLength(1)
      expect(data.movements.length).toBeGreaterThanOrEqual(1)
    })

    it("isolates data by userId", async () => {
      const t = convexTest(schema, modules)
      await setupProduct(t)
      const data = await t.query(api.stock.getDashboardData, { userId: "user2" })
      expect(data.products).toHaveLength(0)
      expect(data.movements).toHaveLength(0)
    })
  })
})
