import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  categories: defineTable({
    userId: v.string(),
    name: v.string(),
    kind: v.union(v.literal("income"), v.literal("expense")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  transactions: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("income"), v.literal("expense")),
    amount: v.number(),
    date: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    origin: v.optional(v.string()),
    expenseType: v.optional(v.union(v.literal("fixed"), v.literal("variable"))),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_category", ["userId", "categoryId"]),

  bills: defineTable({
    userId: v.string(),
    title: v.string(),
    amount: v.number(),
    dueDate: v.string(),
    status: v.union(v.literal("paid"), v.literal("pending"), v.literal("overdue")),
    kind: v.union(v.literal("payable"), v.literal("receivable")),
    categoryId: v.id("categories"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_due_date", ["userId", "dueDate"]),

  stockProducts: defineTable({
    userId: v.string(),
    name: v.string(),
    sku: v.string(),
    category: v.string(),
    quantity: v.number(),
    minStock: v.number(),
    unitCost: v.number(),
    sellingPrice: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_sku", ["userId", "sku"]),

  stockMovements: defineTable({
    userId: v.string(),
    productId: v.id("stockProducts"),
    type: v.union(
      v.literal("in"),
      v.literal("out"),
      v.literal("adjustment"),
      v.literal("sale"),
    ),
    quantity: v.number(),
    date: v.string(),
    unitPrice: v.optional(v.number()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  mercadoLivreAccounts: defineTable({
    appUserId: v.string(),
    mlUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
    expiresIn: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_user", ["appUserId"])
    .index("by_ml_user", ["mlUserId"]),
});
