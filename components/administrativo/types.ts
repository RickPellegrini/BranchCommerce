import type { Id } from "@/convex/_generated/dataModel"
import type { AdminDocumentCategory } from "@/lib/administrativo/documents"

export type AdministrativeDocument = {
  _id: Id<"administrativeDocuments"> | Id<"transactionAttachments">
  _creationTime: number
  userId: string
  title: string
  description?: string
  category: AdminDocumentCategory
  fileName: string
  fileType: string
  fileSize: number
  storageId: Id<"_storage">
  storagePath?: string
  uploadedBy?: string
  tags?: string[]
  createdAt: number
  updatedAt?: number
  status?: "active" | "archived"
  source?: "administrative" | "payment_proof"
  attachmentId?: Id<"transactionAttachments">
  transactionId?: Id<"transactions">
  transactionDate?: string
}
