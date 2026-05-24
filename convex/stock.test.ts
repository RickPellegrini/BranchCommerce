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
    mlItemId: "MLB000001",
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
    it("creates a product with mlItemId as sku", async () => {
      const t = convexTest(schema, modules)
      const id = await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Widget",
        mlItemId: "MLB100001",
        category: "Gadgets",
        quantity: 5,
        minStock: 1,
        unitCost: 10,
      })
      expect(id).toBeTruthy()
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].mlItemId).toBe("MLB100001")
      expect(data.products[0].sku).toBe("MLB100001")
    })

    it("creates initial movement when quantity > 0", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Widget",
        mlItemId: "MLB100002",
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
        mlItemId: "MLB100003",
        category: "Test",
        quantity: 0,
        minStock: 0,
        unitCost: 0,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.movements).toHaveLength(0)
      expect(data.products[0].kanbanStatus).toBe("purchased")
    })

    it("rejects duplicate MLB ID", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "A",
        mlItemId: "MLB100004",
        category: "Test",
        quantity: 0,
        minStock: 0,
        unitCost: 0,
      })
      await expect(
        t.mutation(api.stock.addProduct, {
          userId: "user1",
          name: "B",
          mlItemId: "MLB100004",
          category: "Test",
          quantity: 0,
          minStock: 0,
          unitCost: 0,
        }),
      ).rejects.toThrow("MLB ID")
    })

    it("rejects empty name/mlItemId/category", async () => {
      const t = convexTest(schema, modules)
      await expect(
        t.mutation(api.stock.addProduct, {
          userId: "user1",
          name: "",
          mlItemId: "MLB100005",
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
          mlItemId: "MLB100006",
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
        category: "Updated",
        quantity: 20,
        minStock: 5,
        unitCost: 25,
        sellingPrice: 80,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].name).toBe("Widget B")
    })

    it("allows keeping the same name", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await expect(
        t.mutation(api.stock.updateProduct, {
          userId: "user1",
          productId: id,
          name: "Widget A",
          category: "Gadgets",
          quantity: 10,
          minStock: 2,
          unitCost: 15,
        }),
      ).resolves.not.toThrow()
    })

    it("throws for wrong user", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await expect(
        t.mutation(api.stock.updateProduct, {
          userId: "user2",
          productId: id,
          name: "Hack",
          category: "X",
          quantity: 0,
          minStock: 0,
          unitCost: 0,
        }),
      ).rejects.toThrow("Produto nao encontrado")
    })
  })

  // ── applyKanbanMove ─────────────────────────────────────────────

  describe("applyKanbanMove", () => {
    it("move to em_falta zeros stock and records out movement", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.applyKanbanMove, {
        userId: "user1",
        productId: id,
        target: "em_falta",
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(0)
      expect(data.products[0].kanbanStatus).toBe("in_stock")
      const outs = data.movements.filter((m) => m.type === "out")
      expect(outs).toHaveLength(1)
      expect(outs[0].quantity).toBe(10)
    })

    it("rejects in_stock target when quantity is zero", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Empty",
        mlItemId: "MLB200001",
        category: "Test",
        quantity: 0,
        minStock: 0,
        unitCost: 0,
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      const id = data.products[0]._id
      await expect(
        t.mutation(api.stock.applyKanbanMove, {
          userId: "user1",
          productId: id,
          target: "in_stock",
        }),
      ).rejects.toThrow("Sem unidades em estoque")
    })

    it("pipeline move only updates kanban when qty unchanged", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.applyKanbanMove, {
        userId: "user1",
        productId: id,
        target: "purchased",
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(10)
      expect(data.products[0].kanbanStatus).toBe("purchased")
    })

    it("moves an extra kanban card without changing base product quantity", async () => {
      const t = convexTest(schema, modules)
      const productId = await setupProduct(t)
      const cardId = await t.mutation(api.stock.addKanbanCard, {
        userId: "user1",
        productId,
        kanbanStatus: "fulfillment",
        quantity: 3,
      })

      await t.mutation(api.stock.applyKanbanMove, {
        userId: "user1",
        productId,
        kanbanCardId: cardId,
        target: "in_transit",
      })

      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(10)
      expect(data.kanbanCards).toHaveLength(1)
      expect(data.kanbanCards[0].kanbanStatus).toBe("in_transit")
      expect(data.kanbanCards[0].quantity).toBe(3)
    })
  })

  // ── stockKanbanCards ──────────────────────────────────────────────

  describe("stockKanbanCards", () => {
    it("creates, updates and deletes extra cards for the same product", async () => {
      const t = convexTest(schema, modules)
      const productId = await setupProduct(t)
      const cardId = await t.mutation(api.stock.addKanbanCard, {
        userId: "user1",
        productId,
        kanbanStatus: "fulfillment",
        quantity: 3,
        note: "Full",
      })

      let data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(10)
      expect(data.kanbanCards).toMatchObject([
        { productId, kanbanStatus: "fulfillment", quantity: 3 },
      ])

      await t.mutation(api.stock.updateKanbanCard, {
        userId: "user1",
        kanbanCardId: cardId,
        quantity: 4,
        kanbanStatus: "in_transit",
      })
      data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.kanbanCards[0].quantity).toBe(4)
      expect(data.kanbanCards[0].kanbanStatus).toBe("in_transit")

      await t.mutation(api.stock.deleteKanbanCard, { userId: "user1", kanbanCardId: cardId })
      data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.kanbanCards).toHaveLength(0)
    })

    it("deletes extra cards when deleting the product", async () => {
      const t = convexTest(schema, modules)
      const productId = await setupProduct(t)
      await t.mutation(api.stock.addKanbanCard, {
        userId: "user1",
        productId,
        kanbanStatus: "fulfillment",
        quantity: 3,
      })
      await t.mutation(api.stock.deleteProduct, { userId: "user1", productId })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products).toHaveLength(0)
      expect(data.kanbanCards).toHaveLength(0)
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

    it("moves product to missing column when out movement zeroes stock", async () => {
      const t = convexTest(schema, modules)
      const id = await setupProduct(t)
      await t.mutation(api.stock.updateProduct, {
        userId: "user1",
        productId: id,
        name: "Widget A",
        sku: "MLB000001",
        category: "Gadgets",
        quantity: 10,
        minStock: 2,
        unitCost: 15,
        sellingPrice: 50,
        kanbanStatus: "fulfillment",
      })

      await t.mutation(api.stock.addMovement, {
        userId: "user1",
        productId: id,
        type: "out",
        quantity: 10,
        date: "2025-06-15",
      })

      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(0)
      expect(data.products[0].kanbanStatus).toBe("in_stock")
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

  // ── addManualStockEntry ───────────────────────────────────────────

  describe("addManualStockEntry", () => {
    it("requires mlItemId and stores normalized MLB ID as sku", async () => {
      const t = convexTest(schema, modules)
      const id = await t.mutation(api.stock.addManualStockEntry, {
        userId: "user1",
        name: "Item manual",
        mlItemId: "MLB300001",
        quantity: 2,
        unitCost: 10,
        supplier: "Forn X",
        manualEntryDate: "2025-01-15",
        location: "in_stock_physical",
      })
      expect(id).toBeTruthy()
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].mlItemId).toBe("MLB300001")
      expect(data.products[0].sku).toBe("MLB300001")
    })

    it("rejects duplicate MLB ID", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "A",
        mlItemId: "MLB300002",
        category: "X",
        quantity: 1,
        minStock: 0,
        unitCost: 1,
      })
      await expect(
        t.mutation(api.stock.addManualStockEntry, {
          userId: "user1",
          name: "B",
          mlItemId: "MLB300002",
          quantity: 1,
          unitCost: 2,
          supplier: "S",
          manualEntryDate: "2025-01-15",
          location: "in_stock_physical",
        }),
      ).rejects.toThrow("MLB ID")
    })
  })

  // ── upsertCostFromBranchHunter ────────────────────────────────────

  describe("upsertCostFromBranchHunter", () => {
    it("updates products matched by mlItemId", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "ML Product",
        mlItemId: "MLB400001",
        category: "ML",
        quantity: 5,
        minStock: 0,
        unitCost: 10,
      })
      const result = await t.mutation(api.stock.upsertCostFromBranchHunter, {
        mlItemId: "MLB400001",
        unitCost: 25,
      })
      expect(result.updated).toBeGreaterThanOrEqual(0)
    })

    it("skips products with manual cost source", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Manual Cost",
        mlItemId: "MLBMANUAL01",
        category: "Test",
        quantity: 1,
        minStock: 0,
        unitCost: 50,
      })
      const result = await t.mutation(api.stock.upsertCostFromBranchHunter, {
        mlItemId: "MLBMANUAL01",
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

  // ── reconcileSalesFromMercadoLivre ───────────────────────────────

  describe("reconcileSalesFromMercadoLivre", () => {
    it("creates stock sale movement and finance transaction for ML orders", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Multiprocessador",
        mlItemId: "MLB123",
        category: "Eletro",
        quantity: 2,
        minStock: 0,
        unitCost: 100,
      })

      const result = await t.mutation(api.stock.reconcileSalesFromMercadoLivre, {
        userId: "user1",
        orders: [
          {
            orderId: "2001",
            status: "paid",
            paymentStatus: "approved",
            date: "2026-05-20T12:00:00.000Z",
            items: [
              {
                itemKey: "MLB123:0",
                mlItemId: "MLB123",
                title: "Multiprocessador",
                quantity: 2,
                unitPrice: 350,
              },
            ],
          },
        ],
      })

      expect(result.movementsCreated).toBe(1)
      expect(result.transactionsCreated).toBe(1)
      const stockData = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(stockData.products[0].quantity).toBe(0)
      expect(stockData.products[0].kanbanStatus).toBe("in_stock")
      expect(stockData.movements.some((movement) => movement.type === "sale")).toBe(true)
      const financeData = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(financeData.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            origin: "Venda online",
            amount: 700,
            externalOrderId: "2001",
            externalItemId: "MLB123:0",
          }),
        ]),
      )
    })

    it("is idempotent by ML order and item", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Ferro",
        mlItemId: "MLB999",
        category: "Eletro",
        quantity: 3,
        minStock: 0,
        unitCost: 80,
      })

      const args = {
        userId: "user1",
        orders: [
          {
            orderId: "2002",
            status: "paid",
            paymentStatus: "approved",
            date: "2026-05-20",
            items: [
              {
                itemKey: "MLB999:0",
                mlItemId: "MLB999",
                title: "Ferro",
                quantity: 1,
                unitPrice: 120,
              },
            ],
          },
        ],
      }

      await t.mutation(api.stock.reconcileSalesFromMercadoLivre, args)
      const second = await t.mutation(api.stock.reconcileSalesFromMercadoLivre, args)

      expect(second.skippedAlreadyProcessed).toBe(1)
      const stockData = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(stockData.products[0].quantity).toBe(2)
      expect(stockData.movements.filter((movement) => movement.type === "sale")).toHaveLength(1)
    })

    it("moves fulfillment product to missing column when ML sale zeroes stock", async () => {
      const t = convexTest(schema, modules)
      const productId = await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Ferro",
        mlItemId: "MLB777",
        category: "Eletro",
        quantity: 1,
        minStock: 0,
        unitCost: 80,
      })
      await t.mutation(api.stock.updateProduct, {
        userId: "user1",
        productId,
        name: "Ferro",
        sku: "MLB777",
        category: "Eletro",
        quantity: 1,
        minStock: 0,
        unitCost: 80,
        kanbanStatus: "fulfillment",
      })

      await t.mutation(api.stock.reconcileSalesFromMercadoLivre, {
        userId: "user1",
        orders: [
          {
            orderId: "2003",
            status: "paid",
            paymentStatus: "approved",
            date: "2026-05-20T12:00:00.000Z",
            items: [
              {
                itemKey: "MLB777:0",
                mlItemId: "MLB777",
                title: "Ferro",
                quantity: 1,
                unitPrice: 120,
              },
            ],
          },
        ],
      })

      const stockData = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(stockData.products[0].quantity).toBe(0)
      expect(stockData.products[0].kanbanStatus).toBe("in_stock")
    })
  })

  // ── syncFromMercadoLivre ──────────────────────────────────────────

  describe("syncFromMercadoLivre", () => {
    it("creates new products from fulfillment listings", async () => {
      const t = convexTest(schema, modules)
      const result = await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          {
            id: "MLB001",
            title: "Product 1",
            price: 99,
            availableQuantity: 10,
            logisticType: "fulfillment",
          },
          {
            id: "MLB002",
            title: "Product 2",
            price: 199,
            availableQuantity: 0,
            logisticType: "fulfillment",
          },
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
          {
            id: "MLB001",
            title: "V1",
            price: 99,
            availableQuantity: 10,
            logisticType: "fulfillment",
          },
        ],
      })
      const result = await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          {
            id: "MLB001",
            title: "V2",
            price: 129,
            availableQuantity: 8,
            logisticType: "fulfillment",
          },
        ],
      })
      expect(result.updated).toBe(1)
      expect(result.created).toBe(0)
    })

    it("creates adjustment movement when quantity changes", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          {
            id: "MLB001",
            title: "Prod",
            price: 50,
            availableQuantity: 10,
            logisticType: "fulfillment",
          },
        ],
      })
      await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          {
            id: "MLB001",
            title: "Prod",
            price: 50,
            availableQuantity: 7,
            logisticType: "fulfillment",
          },
        ],
      })
      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      const adjustments = data.movements.filter((m) => m.type === "adjustment")
      expect(adjustments.length).toBeGreaterThanOrEqual(1)
    })

    it("creates a Full card for an existing physical product instead of overwriting it", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.stock.addProduct, {
        userId: "user1",
        name: "Ferro",
        mlItemId: "MLBFERRO1",
        category: "Ferros",
        quantity: 5,
        minStock: 0,
        unitCost: 131,
      })

      await t.mutation(api.stock.syncFromMercadoLivre, {
        userId: "user1",
        listings: [
          {
            id: "MLBFERRO1",
            title: "Ferro",
            price: 199,
            availableQuantity: 3,
            logisticType: "fulfillment",
          },
        ],
      })

      const data = await t.query(api.stock.getDashboardData, { userId: "user1" })
      expect(data.products[0].quantity).toBe(5)
      expect(data.products[0].kanbanStatus).toBe("in_stock")
      expect(data.kanbanCards).toMatchObject([
        { productId: data.products[0]._id, kanbanStatus: "fulfillment", quantity: 3 },
      ])
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
