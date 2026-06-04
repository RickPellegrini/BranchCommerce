import { v } from "convex/values"

import { mutation, query } from "./_generated/server"

import { addMonthsIsoDate, attachmentDedupeKey, firstDayOfIsoMonth } from "./dedupeHelpers"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"

export const getDashboardData = query({
  args: {
    userId: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    kind: v.optional(v.union(v.literal("all"), v.literal("income"), v.literal("expense"))),
  },
  handler: async (ctx, args) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const bills = await ctx.db
      .query("bills")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const filteredTransactions = transactions.filter((transaction) => {
      if (args.kind && args.kind !== "all" && transaction.kind !== args.kind) return false
      if (args.categoryId && transaction.categoryId !== args.categoryId) return false
      if (args.startDate && transaction.date < args.startDate) return false
      if (args.endDate && transaction.date > args.endDate) return false
      return true
    })

    const attachmentRows = await ctx.db
      .query("transactionAttachments")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const transactionAttachments = await Promise.all(
      attachmentRows.map(async (row) => ({
        ...row,
        url: await ctx.storage.getUrl(row.storageId as Id<"_storage">),
      })),
    )

    const returns = await ctx.db
      .query("transactionReturns")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    return {
      categories,
      transactions: filteredTransactions,
      bills,
      transactionAttachments,
      transactionReturns: returns,
    }
  },
})

export const addCategory = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    kind: v.union(v.literal("income"), v.literal("expense")),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now()
    return ctx.db.insert("categories", {
      userId: args.userId,
      name: args.name,
      kind: args.kind,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
})

export const updateCategory = mutation({
  args: {
    userId: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId)
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria nao encontrada.")
    }

    await ctx.db.patch(args.categoryId, {
      name: args.name,
      updatedAt: Date.now(),
    })
  },
})

const paymentMethodValidator = v.union(
  v.literal("pix"),
  v.literal("debit"),
  v.literal("credit"),
  v.literal("boleto"),
)

const payStatusValidator = v.union(v.literal("none"), v.literal("pending"), v.literal("paid"))

export const addTransaction = mutation({
  args: {
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
    paymentMethod: v.optional(paymentMethodValidator),
    installmentPlanId: v.optional(v.string()),
    installmentIndex: v.optional(v.number()),
    installmentCount: v.optional(v.number()),
    payStatus: v.optional(payStatusValidator),
    linkedSourceTransactionId: v.optional(v.id("transactions")),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId)
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria invalida para esta operacao.")
    }

    const now = Date.now()
    return ctx.db.insert("transactions", {
      userId: args.userId,
      kind: args.kind,
      amount: args.amount,
      date: args.date,
      description: args.description,
      categoryId: args.categoryId,
      origin: args.origin,
      expenseType: args.expenseType,
      periodicity: args.periodicity,
      createdAt: now,
      ...(args.paymentMethod !== undefined && { paymentMethod: args.paymentMethod }),
      ...(args.installmentPlanId !== undefined && { installmentPlanId: args.installmentPlanId }),
      ...(args.installmentIndex !== undefined && { installmentIndex: args.installmentIndex }),
      ...(args.installmentCount !== undefined && { installmentCount: args.installmentCount }),
      ...(args.payStatus !== undefined && { payStatus: args.payStatus }),
      ...(args.linkedSourceTransactionId !== undefined && {
        linkedSourceTransactionId: args.linkedSourceTransactionId,
      }),
    })
  },
})

export const updateTransaction = mutation({
  args: {
    userId: v.string(),
    transactionId: v.id("transactions"),
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
    paymentMethod: v.optional(paymentMethodValidator),
    installmentPlanId: v.optional(v.string()),
    installmentIndex: v.optional(v.number()),
    installmentCount: v.optional(v.number()),
    payStatus: v.optional(payStatusValidator),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId)
    if (!transaction || transaction.userId !== args.userId) {
      throw new Error("Lancamento nao encontrado.")
    }

    const category = await ctx.db.get(args.categoryId)
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria invalida para o lancamento.")
    }

    await ctx.db.patch(args.transactionId, {
      kind: args.kind,
      amount: args.amount,
      date: args.date,
      description: args.description,
      categoryId: args.categoryId,
      origin: args.origin,
      expenseType: args.expenseType,
      periodicity: args.periodicity,
      ...(args.paymentMethod !== undefined && { paymentMethod: args.paymentMethod }),
      ...(args.installmentPlanId !== undefined && { installmentPlanId: args.installmentPlanId }),
      ...(args.installmentIndex !== undefined && { installmentIndex: args.installmentIndex }),
      ...(args.installmentCount !== undefined && { installmentCount: args.installmentCount }),
      ...(args.payStatus !== undefined && { payStatus: args.payStatus }),
    })
  },
})

async function deleteAttachmentsForTransaction(
  ctx: MutationCtx,
  transactionId: Id<"transactions">,
) {
  const rows = await ctx.db
    .query("transactionAttachments")
    .withIndex("by_transaction", (q) => q.eq("transactionId", transactionId))
    .collect()
  for (const row of rows) {
    await ctx.storage.delete(row.storageId as Id<"_storage">)
    await ctx.db.delete(row._id)
  }
}

async function deleteOneTransaction(
  ctx: MutationCtx,
  userId: string,
  transactionId: Id<"transactions">,
) {
  const transaction = await ctx.db.get(transactionId)
  if (!transaction || transaction.userId !== userId) {
    throw new Error("Lancamento nao encontrado.")
  }

  // Sales linked to stock movement must be managed in estoque module.
  if (transaction.origin === "Venda online") {
    throw new Error("Lancamentos de venda devem ser alterados no estoque.")
  }

  const asReturn = await ctx.db
    .query("transactionReturns")
    .withIndex("by_source_transaction", (q) =>
      q.eq("userId", userId).eq("sourceTransactionId", transactionId),
    )
    .first()

  if (asReturn) {
    throw new Error(
      "Este lancamento tem devolucao iniciada. Remova a devolucao antes de excluir o original.",
    )
  }

  const creditOfReturn = await ctx.db
    .query("transactionReturns")
    .withIndex("by_credit_transaction", (q) => q.eq("creditTransactionId", transactionId))
    .first()

  if (creditOfReturn && creditOfReturn.userId === userId) {
    await ctx.db.delete(creditOfReturn._id)
  }

  await deleteAttachmentsForTransaction(ctx, transactionId)
  await ctx.db.delete(transactionId)
}

export const deleteTransaction = mutation({
  args: {
    userId: v.string(),
    transactionId: v.id("transactions"),
    installmentScope: v.optional(v.union(v.literal("single"), v.literal("this_and_future"))),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId)
    if (!transaction || transaction.userId !== args.userId) {
      throw new Error("Lancamento nao encontrado.")
    }

    const scope = args.installmentScope ?? "single"

    if (scope === "this_and_future") {
      const planId = transaction.installmentPlanId
      const index = transaction.installmentIndex
      if (!planId || index == null) {
        throw new Error("Este lancamento nao faz parte de um parcelamento no cartao.")
      }

      const toDelete = await ctx.db
        .query("transactions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("installmentPlanId"), planId),
            q.gte(q.field("installmentIndex"), index),
          ),
        )
        .collect()

      toDelete.sort((a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0))
      for (const row of toDelete) {
        await deleteOneTransaction(ctx, args.userId, row._id)
      }
      return { deletedCount: toDelete.length }
    }

    await deleteOneTransaction(ctx, args.userId, args.transactionId)
    return { deletedCount: 1 }
  },
})

export const addBill = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    amount: v.number(),
    dueDate: v.string(),
    status: v.union(v.literal("paid"), v.literal("pending"), v.literal("overdue")),
    kind: v.union(v.literal("payable"), v.literal("receivable")),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId)
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria invalida para esta conta.")
    }

    const timestamp = Date.now()
    return ctx.db.insert("bills", {
      userId: args.userId,
      title: args.title,
      amount: args.amount,
      dueDate: args.dueDate,
      status: args.status,
      kind: args.kind,
      categoryId: args.categoryId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
})

export const updateBillStatus = mutation({
  args: {
    userId: v.string(),
    billId: v.id("bills"),
    status: v.union(v.literal("paid"), v.literal("pending"), v.literal("overdue")),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.billId)
    if (!bill || bill.userId !== args.userId) {
      throw new Error("Conta nao encontrada.")
    }

    await ctx.db.patch(args.billId, {
      status: args.status,
      updatedAt: Date.now(),
    })
  },
})

export const ensureEcommerceSetup = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect()

    const byNameAndKind = new Set(
      existingCategories.map((category) => `${category.kind}:${category.name.toLowerCase()}`),
    )

    const defaultCategories: Array<{
      name: string
      kind: "income" | "expense"
    }> = [
      { name: "Vendas de produtos", kind: "income" },
      { name: "Devolucoes e creditos", kind: "income" },
      { name: "Ferramentas", kind: "expense" },
      { name: "Investimentos", kind: "expense" },
      { name: "Saques", kind: "expense" },
      { name: "Operacional", kind: "expense" },
    ]

    const now = Date.now()
    for (const category of defaultCategories) {
      const key = `${category.kind}:${category.name.toLowerCase()}`
      if (byNameAndKind.has(key)) continue
      await ctx.db.insert("categories", {
        userId: args.userId,
        name: category.name,
        kind: category.kind,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
})

/** URL curta para POST do ficheiro; o cliente recebe { storageId } no JSON de resposta. */
export const generateAttachmentUploadUrl = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const registerTransactionAttachment = mutation({
  args: {
    userId: v.string(),
    transactionId: v.id("transactions"),
    storageId: v.string(),
    fileName: v.string(),
    byteSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId)
    if (!tx || tx.userId !== args.userId) {
      throw new Error("Lancamento nao encontrado.")
    }

    const dedupeKey = attachmentDedupeKey(
      args.userId,
      args.transactionId,
      args.fileName,
      args.byteSize,
    )

    const existing = await ctx.db
      .query("transactionAttachments")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
      .first()
    if (existing) {
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert("transactionAttachments", {
      userId: args.userId,
      transactionId: args.transactionId,
      storageId: args.storageId,
      fileName: args.fileName.trim(),
      byteSize: args.byteSize,
      mimeType: args.mimeType,
      dedupeKey,
      createdAt: now,
    })
  },
})

export const getAttachmentUrl = query({
  args: {
    userId: v.string(),
    attachmentId: v.id("transactionAttachments"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attachmentId)
    if (!row || row.userId !== args.userId) {
      return null
    }
    const url = await ctx.storage.getUrl(row.storageId as Id<"_storage">)
    return url
  },
})

export const deleteTransactionAttachment = mutation({
  args: {
    userId: v.string(),
    attachmentId: v.id("transactionAttachments"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attachmentId)
    if (!row || row.userId !== args.userId) {
      throw new Error("Anexo nao encontrado.")
    }
    await ctx.storage.delete(row.storageId as Id<"_storage">)
    await ctx.db.delete(args.attachmentId)
  },
})

/** Compra/despesa com Pix, Debito ou Credito (parcelas). Dedupe por plano+indice. */
export const addExpenseWithPayment = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    date: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
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
    paymentMethod: paymentMethodValidator,
    installmentCount: v.optional(v.number()),
    firstChargeDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId)
    if (!category || category.userId !== args.userId || category.kind !== "expense") {
      throw new Error("Categoria de despesa invalida.")
    }
    if (args.amount <= 0) {
      throw new Error("Valor deve ser maior que zero.")
    }

    const now = Date.now()

    if (args.paymentMethod === "credit") {
      const count = Math.min(24, Math.max(1, Math.floor(args.installmentCount ?? 1)))
      const first = firstDayOfIsoMonth(args.firstChargeDate ?? args.date)
      const desc = args.description.trim()
      const planId = `credit_${args.userId}_${args.categoryId}_${args.amount}_${first}_${count}_${desc}`
      const per = Math.round((args.amount / count) * 100) / 100
      const ids: Id<"transactions">[] = []

      for (let i = 1; i <= count; i += 1) {
        const existing = await ctx.db
          .query("transactions")
          .withIndex("by_user_plan_index", (q) =>
            q.eq("userId", args.userId).eq("installmentPlanId", planId).eq("installmentIndex", i),
          )
          .first()
        if (existing) {
          ids.push(existing._id)
          continue
        }

        const due = addMonthsIsoDate(first, i - 1)
        const id = await ctx.db.insert("transactions", {
          userId: args.userId,
          kind: "expense",
          amount: per,
          date: due,
          description: `${desc} — Parcela ${i} de ${count}`,
          categoryId: args.categoryId,
          expenseType: args.expenseType,
          periodicity: args.periodicity,
          createdAt: now,
          paymentMethod: "credit",
          installmentPlanId: planId,
          installmentIndex: i,
          installmentCount: count,
          payStatus: "pending",
        })
        ids.push(id)
      }
      return { kind: "installments" as const, planId, transactionIds: ids }
    }

    const pay =
      args.paymentMethod === "pix"
        ? ("none" as const)
        : args.paymentMethod === "debit"
          ? ("paid" as const)
          : ("none" as const)

    const id = await ctx.db.insert("transactions", {
      userId: args.userId,
      kind: "expense",
      amount: args.amount,
      date: args.date,
      description: args.description.trim(),
      categoryId: args.categoryId,
      expenseType: args.expenseType,
      periodicity: args.periodicity,
      createdAt: now,
      paymentMethod: args.paymentMethod,
      payStatus: pay,
    })
    return { kind: "single" as const, transactionIds: [id] }
  },
})

export const markInstallmentPaid = mutation({
  args: {
    userId: v.string(),
    transactionId: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId)
    if (!tx || tx.userId !== args.userId) {
      throw new Error("Lancamento nao encontrado.")
    }
    await ctx.db.patch(args.transactionId, {
      payStatus: "paid",
    })
  },
})

export const startReturnForTransaction = mutation({
  args: {
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
    productId: v.optional(v.id("stockProducts")),
    creditAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceTransactionId)
    if (!source || source.userId !== args.userId) {
      throw new Error("Lancamento origem nao encontrado.")
    }

    const dup = await ctx.db
      .query("transactionReturns")
      .withIndex("by_source_transaction", (q) =>
        q.eq("userId", args.userId).eq("sourceTransactionId", args.sourceTransactionId),
      )
      .first()
    if (dup) {
      throw new Error("Ja existe devolucao para este lancamento.")
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
    let devCat = categories.find(
      (c) => c.kind === "income" && c.name.toLowerCase() === "devolucoes e creditos",
    )?._id
    if (!devCat) {
      const now = Date.now()
      devCat = await ctx.db.insert("categories", {
        userId: args.userId,
        name: "Devolucoes e creditos",
        kind: "income",
        createdAt: now,
        updatedAt: now,
      })
    }

    const now = Date.now()
    const creditId = await ctx.db.insert("transactions", {
      userId: args.userId,
      kind: "income",
      amount: args.creditAmount,
      date: new Date().toISOString().slice(0, 10),
      description: `Estorno / devolucao — ref. ${args.sourceTransactionId}`,
      categoryId: devCat,
      createdAt: now,
      linkedSourceTransactionId: args.sourceTransactionId,
    })

    await ctx.db.insert("transactionReturns", {
      userId: args.userId,
      sourceTransactionId: args.sourceTransactionId,
      reason: args.reason,
      note: args.note.trim(),
      proofStorageId: args.proofStorageId,
      creditTransactionId: creditId,
      productId: args.productId,
      createdAt: now,
    })

    if (args.productId) {
      const product = await ctx.db.get(args.productId)
      if (product && product.userId === args.userId) {
        const prev = product.kanbanStatus ?? "purchased"
        await ctx.db.insert("productKanbanEvents", {
          userId: args.userId,
          productId: args.productId,
          fromStatus: prev,
          toStatus: "returned",
          note: "Devolucao iniciada",
          createdAt: now,
        })
        await ctx.db.patch(args.productId, {
          kanbanStatus: "returned",
          updatedAt: now,
        })
      }
    }

    return { creditTransactionId: creditId }
  },
})
