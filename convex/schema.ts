import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

const paymentMethodValidator = v.union(
  v.literal("pix"),
  v.literal("debit"),
  v.literal("credit"),
  v.literal("boleto"),
)

const payStatusValidator = v.union(v.literal("none"), v.literal("pending"), v.literal("paid"))

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
    periodicity: v.optional(
      v.union(
        v.literal("one_time"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("semiannual"),
        v.literal("annual"),
      ),
    ),
    createdAt: v.number(),
    paymentMethod: v.optional(paymentMethodValidator),
    installmentPlanId: v.optional(v.string()),
    installmentIndex: v.optional(v.number()),
    installmentCount: v.optional(v.number()),
    payStatus: v.optional(payStatusValidator),
    /** Vincula estorno/devolução ao lançamento de despesa original */
    linkedSourceTransactionId: v.optional(v.id("transactions")),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_category", ["userId", "categoryId"])
    .index("by_user_plan_index", ["userId", "installmentPlanId", "installmentIndex"])
    .index("by_linked_source", ["linkedSourceTransactionId"]),

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
    mlItemId: v.optional(v.string()),
    mlItemAliases: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    category: v.string(),
    quantity: v.number(),
    minStock: v.number(),
    unitCost: v.number(),
    unitCostSource: v.optional(v.union(v.literal("manual"), v.literal("extension"))),
    stockSource: v.optional(v.union(v.literal("manual"), v.literal("ml_full"))),
    sellingPrice: v.optional(v.number()),
    kanbanStatus: v.optional(
      v.union(
        v.literal("purchased"),
        v.literal("planned"),
        v.literal("buying"),
        v.literal("in_transit"),
        v.literal("awaiting_inspection"),
        v.literal("returned"),
        v.literal("completed"),
        v.literal("in_stock"),
        v.literal("fulfillment"),
      ),
    ),
    estimatedArrival: v.optional(v.string()),
    kanbanNote: v.optional(v.string()),
    kanbanHidden: v.optional(v.boolean()),
    supplier: v.optional(v.string()),
    manualEntryDate: v.optional(v.string()),
    /** Chave composta para dedupe de entrada manual (nome+fornecedor+data) */
    manualDedupeKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_sku", ["userId", "sku"])
    .index("by_user_ml_item", ["userId", "mlItemId"])
    .index("by_user_ml_item_source", ["userId", "mlItemId", "stockSource"])
    .index("by_ml_item", ["mlItemId"])
    .index("by_user_manual_dedupe", ["userId", "manualDedupeKey"]),

  stockMovements: defineTable({
    userId: v.string(),
    productId: v.id("stockProducts"),
    type: v.union(v.literal("in"), v.literal("out"), v.literal("adjustment"), v.literal("sale")),
    quantity: v.number(),
    date: v.string(),
    unitPrice: v.optional(v.number()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  stockKanbanCards: defineTable({
    userId: v.string(),
    productId: v.id("stockProducts"),
    kanbanStatus: v.union(
      v.literal("purchased"),
      v.literal("planned"),
      v.literal("buying"),
      v.literal("in_transit"),
      v.literal("awaiting_inspection"),
      v.literal("returned"),
      v.literal("completed"),
      v.literal("in_stock"),
      v.literal("fulfillment"),
    ),
    quantity: v.number(),
    note: v.optional(v.string()),
    estimatedArrival: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"])
    .index("by_user_product_status", ["userId", "productId", "kanbanStatus"]),

  /** Log de mudanças de etapa no Kanban por produto */
  productKanbanEvents: defineTable({
    userId: v.string(),
    productId: v.id("stockProducts"),
    fromStatus: v.string(),
    toStatus: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  /** Metadados de ficheiros no Convex Storage, por lançamento */
  transactionAttachments: defineTable({
    userId: v.string(),
    transactionId: v.id("transactions"),
    storageId: v.string(),
    fileName: v.string(),
    byteSize: v.number(),
    mimeType: v.string(),
    dedupeKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_transaction", ["transactionId"])
    .index("by_dedupe_key", ["dedupeKey"]),

  /** Devolução iniciada a partir de um lançamento (uma por lançamento origem) */
  transactionReturns: defineTable({
    userId: v.string(),
    sourceTransactionId: v.id("transactions"),
    reason: v.union(
      v.literal("defect"),
      v.literal("wrong_item"),
      v.literal("regret"),
      v.literal("other"),
    ),
    note: v.string(),
    proofStorageId: v.optional(v.string()),
    creditTransactionId: v.id("transactions"),
    productId: v.optional(v.id("stockProducts")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_source_transaction", ["userId", "sourceTransactionId"])
    .index("by_credit_transaction", ["creditTransactionId"]),

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

  mercadoPagoAccounts: defineTable({
    appUserId: v.string(),
    mpUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
    publicKey: v.optional(v.string()),
    liveMode: v.optional(v.boolean()),
    expiresIn: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_user", ["appUserId"])
    .index("by_mp_user", ["mpUserId"]),

  mpBalanceAnchors: defineTable({
    appUserId: v.string(),
    balance: v.number(),
    currencyId: v.string(),
    anchoredAt: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_app_user", ["appUserId"]),

  mpAccountMovements: defineTable({
    appUserId: v.string(),
    mpUserId: v.string(),
    movementKey: v.string(),
    sourceId: v.optional(v.string()),
    externalReference: v.optional(v.string()),
    fileName: v.string(),
    date: v.string(),
    description: v.string(),
    amount: v.number(),
    type: v.union(v.literal("credit"), v.literal("debit")),
    status: v.string(),
    rawJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_user", ["appUserId"])
    .index("by_app_user_key", ["appUserId", "movementKey"])
    .index("by_app_user_date", ["appUserId", "date"]),

  mpReportSyncRuns: defineTable({
    appUserId: v.string(),
    status: v.union(v.literal("success"), v.literal("pending"), v.literal("failed")),
    fileName: v.optional(v.string()),
    imported: v.number(),
    skipped: v.number(),
    message: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_app_user", ["appUserId"]),
})
