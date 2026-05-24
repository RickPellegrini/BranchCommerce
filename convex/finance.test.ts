/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

describe("finance", () => {
  // ── addCategory ───────────────────────────────────────────────────

  describe("addCategory", () => {
    it("inserts a category and returns its id", async () => {
      const t = convexTest(schema, modules)
      const id = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Vendas",
        kind: "income",
      })
      expect(id).toBeTruthy()
    })

    it("stores name, kind, and timestamps", async () => {
      const t = convexTest(schema, modules)
      const id = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Operacional",
        kind: "expense",
      })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      const cat = data.categories.find((c) => c._id === id)
      expect(cat).toBeTruthy()
      expect(cat!.name).toBe("Operacional")
      expect(cat!.kind).toBe("expense")
      expect(cat!.createdAt).toBeGreaterThan(0)
    })
  })

  // ── updateCategory ────────────────────────────────────────────────

  describe("updateCategory", () => {
    it("updates category name", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Old Name",
        kind: "expense",
      })
      await t.mutation(api.finance.updateCategory, {
        userId: "user1",
        categoryId: catId,
        name: "New Name",
      })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(data.categories[0].name).toBe("New Name")
    })

    it("throws when userId does not match", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "income",
      })
      await expect(
        t.mutation(api.finance.updateCategory, {
          userId: "user2",
          categoryId: catId,
          name: "Hack",
        }),
      ).rejects.toThrow("Categoria nao encontrada")
    })
  })

  // ── addTransaction ────────────────────────────────────────────────

  describe("addTransaction", () => {
    it("inserts a transaction linked to a valid category", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Vendas",
        kind: "income",
      })
      const txId = await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "income",
        amount: 500,
        date: "2025-06-15",
        description: "Venda #1",
        categoryId: catId,
      })
      expect(txId).toBeTruthy()
    })

    it("throws when categoryId belongs to another user", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "income",
      })
      await expect(
        t.mutation(api.finance.addTransaction, {
          userId: "user2",
          kind: "income",
          amount: 100,
          date: "2025-01-01",
          description: "test",
          categoryId: catId,
        }),
      ).rejects.toThrow("Categoria invalida")
    })

    it("accepts optional fields", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Ops",
        kind: "expense",
      })
      const txId = await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "expense",
        amount: 200,
        date: "2025-06-01",
        description: "Aluguel",
        categoryId: catId,
        origin: "Manual",
        expenseType: "fixed",
        periodicity: "monthly",
      })
      expect(txId).toBeTruthy()
    })
  })

  // ── addExpenseWithPayment ────────────────────────────────────────

  describe("addExpenseWithPayment", () => {
    it("sets credit installments to the first day of each month", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Compras",
        kind: "expense",
      })

      await t.mutation(api.finance.addExpenseWithPayment, {
        userId: "user1",
        amount: 300,
        date: "2025-06-18",
        description: "Compra parcelada",
        categoryId: catId,
        paymentMethod: "credit",
        installmentCount: 3,
        firstChargeDate: "2025-07-20",
      })

      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      const dates = data.transactions
        .sort((a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0))
        .map((transaction) => transaction.date)

      expect(dates).toEqual(["2025-07-01", "2025-08-01", "2025-09-01"])
    })
  })

  // ── updateTransaction ─────────────────────────────────────────────

  describe("updateTransaction", () => {
    it("updates transaction fields", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "income",
      })
      const txId = await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "income",
        amount: 100,
        date: "2025-01-01",
        description: "old",
        categoryId: catId,
      })
      await t.mutation(api.finance.updateTransaction, {
        userId: "user1",
        transactionId: txId,
        kind: "income",
        amount: 200,
        date: "2025-02-01",
        description: "updated",
        categoryId: catId,
      })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(data.transactions[0].amount).toBe(200)
      expect(data.transactions[0].description).toBe("updated")
    })

    it("throws when transaction belongs to another user", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "income",
      })
      const txId = await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "income",
        amount: 100,
        date: "2025-01-01",
        description: "test",
        categoryId: catId,
      })
      await expect(
        t.mutation(api.finance.updateTransaction, {
          userId: "user2",
          transactionId: txId,
          kind: "income",
          amount: 999,
          date: "2025-01-01",
          description: "hacked",
          categoryId: catId,
        }),
      ).rejects.toThrow("Lancamento nao encontrado")
    })
  })

  // ── deleteTransaction ─────────────────────────────────────────────

  describe("deleteTransaction", () => {
    it("deletes a regular transaction", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "expense",
      })
      const txId = await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "expense",
        amount: 50,
        date: "2025-01-01",
        description: "delete me",
        categoryId: catId,
      })
      await t.mutation(api.finance.deleteTransaction, {
        userId: "user1",
        transactionId: txId,
      })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(data.transactions).toHaveLength(0)
    })

    it("blocks deletion of 'Venda online' origin transactions", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Vendas",
        kind: "income",
      })
      const txId = await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "income",
        amount: 300,
        date: "2025-06-01",
        description: "Sale",
        categoryId: catId,
        origin: "Venda online",
      })
      await expect(
        t.mutation(api.finance.deleteTransaction, {
          userId: "user1",
          transactionId: txId,
        }),
      ).rejects.toThrow("estoque")
    })

    it("throws when transaction not found", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "expense",
      })
      const txId = await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "expense",
        amount: 10,
        date: "2025-01-01",
        description: "x",
        categoryId: catId,
      })
      await expect(
        t.mutation(api.finance.deleteTransaction, {
          userId: "user2",
          transactionId: txId,
        }),
      ).rejects.toThrow("Lancamento nao encontrado")
    })
  })

  // ── addBill ───────────────────────────────────────────────────────

  describe("addBill", () => {
    it("inserts a bill", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Ops",
        kind: "expense",
      })
      const billId = await t.mutation(api.finance.addBill, {
        userId: "user1",
        title: "Aluguel",
        amount: 1500,
        dueDate: "2025-06-30",
        status: "pending",
        kind: "payable",
        categoryId: catId,
      })
      expect(billId).toBeTruthy()
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(data.bills).toHaveLength(1)
      expect(data.bills[0].title).toBe("Aluguel")
    })

    it("throws for invalid category", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "expense",
      })
      await expect(
        t.mutation(api.finance.addBill, {
          userId: "user2",
          title: "Bill",
          amount: 100,
          dueDate: "2025-01-01",
          status: "pending",
          kind: "payable",
          categoryId: catId,
        }),
      ).rejects.toThrow("Categoria invalida")
    })
  })

  // ── updateBillStatus ──────────────────────────────────────────────

  describe("updateBillStatus", () => {
    it("updates bill status", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "expense",
      })
      const billId = await t.mutation(api.finance.addBill, {
        userId: "user1",
        title: "Test",
        amount: 100,
        dueDate: "2025-01-01",
        status: "pending",
        kind: "payable",
        categoryId: catId,
      })
      await t.mutation(api.finance.updateBillStatus, {
        userId: "user1",
        billId,
        status: "paid",
      })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(data.bills[0].status).toBe("paid")
    })

    it("throws for wrong user", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "expense",
      })
      const billId = await t.mutation(api.finance.addBill, {
        userId: "user1",
        title: "Test",
        amount: 100,
        dueDate: "2025-01-01",
        status: "pending",
        kind: "payable",
        categoryId: catId,
      })
      await expect(
        t.mutation(api.finance.updateBillStatus, {
          userId: "user2",
          billId,
          status: "paid",
        }),
      ).rejects.toThrow("Conta nao encontrada")
    })
  })

  // ── getDashboardData ──────────────────────────────────────────────

  describe("getDashboardData", () => {
    it("returns categories, transactions, and bills for user", async () => {
      const t = convexTest(schema, modules)
      const catId = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "income",
      })
      await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "income",
        amount: 100,
        date: "2025-06-15",
        description: "test",
        categoryId: catId,
      })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(data.categories).toHaveLength(1)
      expect(data.transactions).toHaveLength(1)
      expect(data.bills).toHaveLength(0)
    })

    it("filters transactions by kind", async () => {
      const t = convexTest(schema, modules)
      const incCat = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Inc",
        kind: "income",
      })
      const expCat = await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Exp",
        kind: "expense",
      })
      await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "income",
        amount: 100,
        date: "2025-06-01",
        description: "income",
        categoryId: incCat,
      })
      await t.mutation(api.finance.addTransaction, {
        userId: "user1",
        kind: "expense",
        amount: 50,
        date: "2025-06-01",
        description: "expense",
        categoryId: expCat,
      })
      const data = await t.query(api.finance.getDashboardData, {
        userId: "user1",
        kind: "income",
      })
      expect(data.transactions).toHaveLength(1)
      expect(data.transactions[0].kind).toBe("income")
    })

    it("does not leak data between users", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Cat",
        kind: "income",
      })
      const data = await t.query(api.finance.getDashboardData, { userId: "user2" })
      expect(data.categories).toHaveLength(0)
    })
  })

  // ── ensureEcommerceSetup ──────────────────────────────────────────

  describe("ensureEcommerceSetup", () => {
    it("creates default e-commerce categories", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.finance.ensureEcommerceSetup, { userId: "user1" })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      const names = data.categories.map((c) => c.name)
      expect(names).toContain("Vendas de produtos")
      expect(names).toContain("Ferramentas")
      expect(names).toContain("Investimentos")
      expect(names).toContain("Saques")
      expect(names).toContain("Operacional")
      expect(names).toContain("Devolucoes e creditos")
    })

    it("is idempotent (does not duplicate categories)", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.finance.ensureEcommerceSetup, { userId: "user1" })
      await t.mutation(api.finance.ensureEcommerceSetup, { userId: "user1" })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      expect(data.categories).toHaveLength(6)
    })

    it("does not overwrite existing categories with same name", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.finance.addCategory, {
        userId: "user1",
        name: "Vendas de produtos",
        kind: "income",
      })
      await t.mutation(api.finance.ensureEcommerceSetup, { userId: "user1" })
      const data = await t.query(api.finance.getDashboardData, { userId: "user1" })
      const salesCats = data.categories.filter((c) => c.name === "Vendas de produtos")
      expect(salesCats).toHaveLength(1)
    })
  })
})
