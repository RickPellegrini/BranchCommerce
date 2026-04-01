import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

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
      .collect();

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect();

    const bills = await ctx.db
      .query("bills")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect();

    const filteredTransactions = transactions.filter((transaction) => {
      if (args.kind && args.kind !== "all" && transaction.kind !== args.kind) return false;
      if (args.categoryId && transaction.categoryId !== args.categoryId) return false;
      if (args.startDate && transaction.date < args.startDate) return false;
      if (args.endDate && transaction.date > args.endDate) return false;
      return true;
    });

    return {
      categories,
      transactions: filteredTransactions,
      bills,
    };
  },
});

export const addCategory = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    kind: v.union(v.literal("income"), v.literal("expense")),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    return ctx.db.insert("categories", {
      userId: args.userId,
      name: args.name,
      kind: args.kind,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const updateCategory = mutation({
  args: {
    userId: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria nao encontrada.");
    }

    await ctx.db.patch(args.categoryId, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});

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
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria invalida para esta operacao.");
    }

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
      createdAt: Date.now(),
    });
  },
});

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
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction || transaction.userId !== args.userId) {
      throw new Error("Lancamento nao encontrado.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria invalida para o lancamento.");
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
    });
  },
});

export const deleteTransaction = mutation({
  args: {
    userId: v.string(),
    transactionId: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction || transaction.userId !== args.userId) {
      throw new Error("Lancamento nao encontrado.");
    }

    // Sales linked to stock movement must be managed in estoque module.
    if (transaction.origin === "Venda online") {
      throw new Error("Lancamentos de venda devem ser alterados no estoque.");
    }

    await ctx.db.delete(args.transactionId);
  },
});

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
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== args.userId) {
      throw new Error("Categoria invalida para esta conta.");
    }

    const timestamp = Date.now();
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
    });
  },
});

export const updateBillStatus = mutation({
  args: {
    userId: v.string(),
    billId: v.id("bills"),
    status: v.union(v.literal("paid"), v.literal("pending"), v.literal("overdue")),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.billId);
    if (!bill || bill.userId !== args.userId) {
      throw new Error("Conta nao encontrada.");
    }

    await ctx.db.patch(args.billId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const ensureEcommerceSetup = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId))
      .collect();

    const byNameAndKind = new Set(
      existingCategories.map((category) => `${category.kind}:${category.name.toLowerCase()}`),
    );

    const defaultCategories: Array<{
      name: string;
      kind: "income" | "expense";
    }> = [
      { name: "Vendas de produtos", kind: "income" },
      { name: "Ferramentas", kind: "expense" },
      { name: "Investimentos", kind: "expense" },
      { name: "Saques", kind: "expense" },
      { name: "Operacional", kind: "expense" },
    ];

    const now = Date.now();
    for (const category of defaultCategories) {
      const key = `${category.kind}:${category.name.toLowerCase()}`;
      if (byNameAndKind.has(key)) continue;
      await ctx.db.insert("categories", {
        userId: args.userId,
        name: category.name,
        kind: category.kind,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
