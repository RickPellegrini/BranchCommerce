export const ADMIN_DOCUMENT_CATEGORIES = [
  "Contratos",
  "Sociedade",
  "CCMEI",
  "Certificados",
  "Compliance",
  "Financeiro",
  "Comprovantes",
  "Fornecedores",
  "Políticas",
  "Outros",
] as const

export type AdminDocumentCategory = (typeof ADMIN_DOCUMENT_CATEGORIES)[number]

const ADMIN_DOCUMENT_CATEGORY_SLUGS: Record<AdminDocumentCategory, string> = {
  Contratos: "contratos",
  Sociedade: "sociedade",
  CCMEI: "ccmei",
  Certificados: "certificados",
  Compliance: "compliance",
  Financeiro: "financeiro",
  Comprovantes: "comprovantes",
  Fornecedores: "fornecedores",
  Políticas: "politicas",
  Outros: "outros",
}

export function adminDocumentCategoryToSlug(category: AdminDocumentCategory): string {
  return ADMIN_DOCUMENT_CATEGORY_SLUGS[category]
}

export function adminDocumentSlugToCategory(slug?: string): AdminDocumentCategory | null {
  if (!slug) return null
  const normalized = slug.trim().toLowerCase()
  return (
    ADMIN_DOCUMENT_CATEGORIES.find(
      (category) => ADMIN_DOCUMENT_CATEGORY_SLUGS[category] === normalized,
    ) ?? null
  )
}

export const MAX_ADMIN_DOCUMENT_BYTES = 10 * 1024 * 1024

export const ADMIN_DOCUMENT_ACCEPT_ATTR =
  ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export function isAcceptedAdminDocument(file: File): boolean {
  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf")) return !file.type || file.type === "application/pdf"
  if (name.endsWith(".png")) return !file.type || file.type === "image/png"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return !file.type || file.type === "image/jpeg"
  }
  if (name.endsWith(".docx")) {
    return (
      !file.type ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  }
  if (name.endsWith(".xlsx")) {
    return (
      !file.type ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
  }
  return false
}

export function formatDocumentFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDocumentDate(ts?: number): string {
  if (!ts) return "-"
  return new Date(ts).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function inferDocumentTitle(fileName: string): string {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || fileName
  )
}

export function isPreviewableFile(fileType: string, fileName: string): "pdf" | "image" | null {
  const lower = fileName.toLowerCase()
  if (fileType === "application/pdf" || lower.endsWith(".pdf")) return "pdf"
  if (fileType.startsWith("image/") || /\.(jpe?g|png)$/i.test(fileName)) return "image"
  return null
}
