import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"

const MAX_ADMIN_DOCUMENT_BYTES = 10 * 1024 * 1024

const categoryValidator = v.union(
  v.literal("Contratos"),
  v.literal("Sociedade"),
  v.literal("CCMEI"),
  v.literal("Certificados"),
  v.literal("Compliance"),
  v.literal("Financeiro"),
  v.literal("Fornecedores"),
  v.literal("Políticas"),
  v.literal("Outros"),
)

const statusValidator = v.union(v.literal("active"), v.literal("archived"))

function cleanTags(tags?: string[]) {
  const normalized = [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))]
  return normalized.length ? normalized : undefined
}

async function getOwnedDocument(
  ctx: QueryCtx,
  documentId: Id<"administrativeDocuments">,
  userId: string,
) {
  const document = await ctx.db.get(documentId)
  if (!document || document.userId !== userId) {
    throw new Error("Documento nao encontrado.")
  }
  return document
}

export const generateUploadUrl = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (_ctx, args) => {
    if (!args.userId.trim()) {
      throw new Error("Usuario nao autenticado.")
    }
    return await _ctx.storage.generateUploadUrl()
  },
})

export const listDocuments = query({
  args: {
    userId: v.string(),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    if (!args.userId.trim()) return []
    const status = args.status ?? "active"
    const documents = await ctx.db
      .query("administrativeDocuments")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", status))
      .collect()

    return documents.sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const getDocumentUrl = query({
  args: {
    userId: v.string(),
    documentId: v.id("administrativeDocuments"),
  },
  handler: async (ctx, args) => {
    const document = await getOwnedDocument(ctx, args.documentId, args.userId)
    return await ctx.storage.getUrl(document.storageId)
  },
})

export const registerDocument = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    category: categoryValidator,
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    uploadedBy: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim()
    const fileName = args.fileName.trim()

    if (!args.userId.trim()) throw new Error("Usuario nao autenticado.")
    if (!title) throw new Error("Informe um titulo para o documento.")
    if (!fileName) throw new Error("Nome do arquivo invalido.")
    if (args.fileSize <= 0 || args.fileSize > MAX_ADMIN_DOCUMENT_BYTES) {
      throw new Error("Arquivo acima do limite de 10 MB.")
    }

    const now = Date.now()
    return await ctx.db.insert("administrativeDocuments", {
      userId: args.userId,
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      fileName,
      fileType: args.fileType || "application/octet-stream",
      fileSize: args.fileSize,
      storageId: args.storageId,
      uploadedBy: args.uploadedBy?.trim() || undefined,
      tags: cleanTags(args.tags),
      createdAt: now,
      updatedAt: now,
      status: "active",
    })
  },
})

export const updateDocumentMetadata = mutation({
  args: {
    userId: v.string(),
    documentId: v.id("administrativeDocuments"),
    title: v.string(),
    description: v.optional(v.string()),
    category: categoryValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await getOwnedDocument(ctx, args.documentId, args.userId)
    const title = args.title.trim()
    if (!title) throw new Error("Informe um titulo para o documento.")

    await ctx.db.patch(args.documentId, {
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      tags: cleanTags(args.tags),
      updatedAt: Date.now(),
    })
  },
})

export const archiveDocument = mutation({
  args: {
    userId: v.string(),
    documentId: v.id("administrativeDocuments"),
  },
  handler: async (ctx, args) => {
    await getOwnedDocument(ctx, args.documentId, args.userId)
    await ctx.db.patch(args.documentId, {
      status: "archived",
      updatedAt: Date.now(),
    })
  },
})

export const deleteDocument = mutation({
  args: {
    userId: v.string(),
    documentId: v.id("administrativeDocuments"),
  },
  handler: async (ctx, args) => {
    const document = await getOwnedDocument(ctx, args.documentId, args.userId)
    await ctx.storage.delete(document.storageId)
    await ctx.db.delete(args.documentId)
  },
})
