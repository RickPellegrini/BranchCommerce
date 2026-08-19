/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const testServerKey = "test-store-server-key"
process.env.STORE_SERVER_KEY = testServerKey

async function setupPublishedProduct(t: ReturnType<typeof convexTest>, quantity = 5) {
  const stockProductId = await t.mutation(api.stock.addProduct, {
    userId: "owner1",
    name: "Fone Branch X1",
    mlItemId: "MLB900001",
    category: "Eletronicos",
    quantity,
    minStock: 1,
    unitCost: 35,
    sellingPrice: 129.9,
  })

  const storeProductId = await t.mutation(api.storeCatalog.upsertStoreProduct, {
    userId: "owner1",
    stockProductId,
    title: "Fone Branch X1",
    slug: "fone-branch-x1",
    subtitle: "Som limpo para trabalho e jogo",
    description: "Produto publicado na loja propria.",
    price: 129.9,
    compareAtPrice: 169.9,
    status: "published",
    featured: true,
    sortOrder: 1,
  })

  return { stockProductId, storeProductId }
}

describe("store MVP", () => {
  it("lists only published products without operational cost fields", async () => {
    const t = convexTest(schema, modules)
    await setupPublishedProduct(t)

    const draftStockId = await t.mutation(api.stock.addProduct, {
      userId: "owner1",
      name: "Produto oculto",
      mlItemId: "MLB900002",
      category: "Interno",
      quantity: 3,
      minStock: 1,
      unitCost: 10,
      sellingPrice: 50,
    })
    await t.mutation(api.storeCatalog.upsertStoreProduct, {
      userId: "owner1",
      stockProductId: draftStockId,
      title: "Produto oculto",
      slug: "produto-oculto",
      price: 50,
      status: "draft",
      featured: false,
    })

    const catalog = await t.query(api.storeCatalog.listPublishedProducts, { limit: 10 })
    expect(catalog.products).toHaveLength(1)
    expect(catalog.products[0].title).toBe("Fone Branch X1")
    expect(catalog.products[0]).not.toHaveProperty("unitCost")
    expect(catalog.products[0]).not.toHaveProperty("supplier")
    expect(catalog.products[0]).not.toHaveProperty("kanbanStatus")
  })

  it("adds cart items and rejects quantities above public availability", async () => {
    const t = convexTest(schema, modules)
    const { storeProductId } = await setupPublishedProduct(t, 2)

    const cart = await t.mutation(api.storeCart.addItem, {
      cartTokenHash: "cart-hash-1",
      storeProductId,
      quantity: 2,
    })

    expect(cart.itemCount).toBe(2)
    expect(cart.subtotal).toBe(259.8)

    await expect(
      t.mutation(api.storeCart.addItem, {
        cartTokenHash: "cart-hash-1",
        storeProductId,
        quantity: 1,
      }),
    ).rejects.toThrow("estoque disponivel")
  })

  it("creates reservations, consumes them on payment, and keeps webhook idempotent", async () => {
    const t = convexTest(schema, modules)
    const { storeProductId } = await setupPublishedProduct(t, 5)

    await t.mutation(api.storeCart.addItem, {
      cartTokenHash: "cart-hash-2",
      storeProductId,
      quantity: 2,
    })

    const pending = await t.mutation(api.storeCheckout.createPendingOrder, {
      cartTokenHash: "cart-hash-2",
      customer: {
        email: "cliente@example.com",
        name: "Cliente Branch",
      },
      shippingAddress: {
        name: "Cliente Branch",
        zipCode: "01001000",
        street: "Rua Teste",
        number: "123",
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
      },
    })

    expect(pending.order?.paymentStatus).toBe("pending")
    expect(pending.items).toHaveLength(1)

    const productDuringReservation = await t.query(api.storeCatalog.getProductBySlug, {
      slug: "fone-branch-x1",
    })
    expect(productDuringReservation?.availableQuantity).toBe(3)

    await t.mutation(api.storeCheckout.applyMercadoPagoPayment, {
      serverKey: testServerKey,
      orderNumber: pending.order!.orderNumber,
      mpPaymentId: "mp-payment-1",
      status: "paid",
      rawStatus: "approved",
      amount: pending.order!.grandTotal,
    })

    await t.mutation(api.storeCheckout.applyMercadoPagoPayment, {
      serverKey: testServerKey,
      orderNumber: pending.order!.orderNumber,
      mpPaymentId: "mp-payment-1",
      status: "paid",
      rawStatus: "approved",
      amount: pending.order!.grandTotal,
    })

    const stock = await t.query(api.stock.getDashboardData, { userId: "owner1" })
    const product = stock.products.find((row) => row.name === "Fone Branch X1")
    expect(product?.quantity).toBe(3)
    expect(stock.movements.filter((movement) => movement.externalSource === "store")).toHaveLength(
      1,
    )

    const finance = await t.query(api.finance.getDashboardData, { userId: "owner1" })
    const storeRevenue = finance.transactions.filter(
      (transaction) => transaction.externalSource === "store",
    )
    expect(storeRevenue).toHaveLength(1)
    expect(storeRevenue[0].amount).toBe(pending.order!.grandTotal)
  })

  it("rejects payment confirmation without the server-side key", async () => {
    const t = convexTest(schema, modules)
    const { storeProductId } = await setupPublishedProduct(t, 1)

    await t.mutation(api.storeCart.addItem, {
      cartTokenHash: "cart-hash-3",
      storeProductId,
      quantity: 1,
    })
    const pending = await t.mutation(api.storeCheckout.createPendingOrder, {
      cartTokenHash: "cart-hash-3",
      customer: {
        email: "cliente@example.com",
        name: "Cliente Branch",
      },
      shippingAddress: {
        name: "Cliente Branch",
        zipCode: "01001000",
        street: "Rua Teste",
        number: "123",
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
      },
    })

    await expect(
      t.mutation(api.storeCheckout.applyMercadoPagoPayment, {
        serverKey: "wrong",
        orderNumber: pending.order!.orderNumber,
        mpPaymentId: "mp-payment-forged",
        status: "paid",
        rawStatus: "approved",
        amount: pending.order!.grandTotal,
      }),
    ).rejects.toThrow("Chave server-side invalida")
  })
})
