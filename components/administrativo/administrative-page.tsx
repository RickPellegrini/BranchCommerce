"use client"

import { Dialog } from "radix-ui"
import { useUser } from "@clerk/nextjs"
import { useConvex, useMutation, useQuery } from "convex/react"
import { ArrowLeft, Briefcase, FileText, FolderArchive, HardDrive, Upload, X } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CategoryFilter } from "./category-filter"
import { DocumentPreviewModal } from "./document-preview-modal"
import { DocumentUploadDialog, type DocumentUploadPayload } from "./document-upload-dialog"
import { DocumentsTable } from "./documents-table"
import type { AdministrativeDocument } from "./types"
import {
  ADMIN_DOCUMENT_CATEGORIES,
  adminDocumentCategoryToSlug,
  formatDocumentDate,
  formatDocumentFileSize,
  type AdminDocumentCategory,
} from "@/lib/administrativo/documents"

type FileTypeFilter = "all" | "pdf" | "image" | "docx" | "xlsx" | "other"

function downloadUrl(url: string, fileName: string) {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener noreferrer"
  anchor.click()
}

function matchesFileType(document: AdministrativeDocument, filter: FileTypeFilter): boolean {
  if (filter === "all") return true
  const fileName = document.fileName.toLowerCase()
  if (filter === "pdf") return document.fileType === "application/pdf" || fileName.endsWith(".pdf")
  if (filter === "image") return document.fileType.startsWith("image/")
  if (filter === "docx") return fileName.endsWith(".docx")
  if (filter === "xlsx") return fileName.endsWith(".xlsx")
  const knownType =
    document.fileType === "application/pdf" ||
    document.fileType.startsWith("image/") ||
    fileName.endsWith(".pdf") ||
    fileName.endsWith(".docx") ||
    fileName.endsWith(".xlsx")
  return !knownType
}

export function AdministrativePage({
  initialCategory = null,
}: {
  initialCategory?: AdminDocumentCategory | null
}) {
  const { user, isLoaded } = useUser()
  const userId = user?.id
  const convex = useConvex()
  const documents = useQuery(
    api.administrativeDocuments.listDocuments,
    userId ? { userId, status: "active" } : "skip",
  ) as AdministrativeDocument[] | undefined
  const generateUploadUrl = useMutation(api.administrativeDocuments.generateUploadUrl)
  const registerDocument = useMutation(api.administrativeDocuments.registerDocument)
  const updateDocumentMetadata = useMutation(api.administrativeDocuments.updateDocumentMetadata)
  const archiveDocument = useMutation(api.administrativeDocuments.archiveDocument)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState(initialCategory ?? "all")
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [previewDocument, setPreviewDocument] = useState<AdministrativeDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [editingDocument, setEditingDocument] = useState<AdministrativeDocument | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCategory, setEditCategory] = useState<AdminDocumentCategory>("Contratos")
  const [editTags, setEditTags] = useState("")

  const visibleDocuments = useMemo(() => {
    const rows = documents ?? []
    const normalizedSearch = search.trim().toLowerCase()
    return rows.filter((document) => {
      if (categoryFilter !== "all" && document.category !== categoryFilter) return false
      if (!matchesFileType(document, fileTypeFilter)) return false
      if (!normalizedSearch) return true
      return (
        document.title.toLowerCase().includes(normalizedSearch) ||
        document.fileName.toLowerCase().includes(normalizedSearch) ||
        (document.description ?? "").toLowerCase().includes(normalizedSearch)
      )
    })
  }, [categoryFilter, documents, fileTypeFilter, search])

  const folderSummaries = useMemo(
    () =>
      ADMIN_DOCUMENT_CATEGORIES.map((category) => {
        const rows = (documents ?? []).filter((document) => document.category === category)
        const bytes = rows.reduce((total, document) => total + document.fileSize, 0)
        const last = rows.reduce<number | undefined>(
          (latest, document) =>
            latest === undefined || document.createdAt > latest ? document.createdAt : latest,
          undefined,
        )
        return {
          category,
          count: rows.length,
          bytes,
          last,
        }
      }),
    [documents],
  )

  const categoryCount = useMemo(
    () => new Set((documents ?? []).map((document) => document.category)).size,
    [documents],
  )
  const totalBytes = useMemo(
    () => (documents ?? []).reduce((total, document) => total + document.fileSize, 0),
    [documents],
  )
  const lastUpload = documents?.[0]?.createdAt
  const loading = !isLoaded || documents === undefined

  async function handleUpload(payload: DocumentUploadPayload) {
    if (!userId) throw new Error("Usuario nao autenticado.")
    const postUrl = await generateUploadUrl({ userId })
    const response = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": payload.file.type || "application/octet-stream" },
      body: payload.file,
    })
    if (!response.ok) throw new Error("Falha ao enviar arquivo ao Convex Storage.")
    const body = (await response.json()) as { storageId?: string }
    if (!body.storageId) throw new Error("Convex nao retornou storageId.")

    await registerDocument({
      userId,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      fileName: payload.file.name,
      fileType: payload.file.type || "application/octet-stream",
      fileSize: payload.file.size,
      storageId: body.storageId as Id<"_storage">,
      uploadedBy: user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? userId,
      tags: payload.tags,
    })
    setFeedback("Documento enviado com sucesso.")
  }

  async function loadDocumentUrl(document: AdministrativeDocument) {
    if (!userId) throw new Error("Usuario nao autenticado.")
    if (document.source === "payment_proof") {
      if (!document.attachmentId) throw new Error("Comprovante sem referencia de anexo.")
      const url = await convex.query(api.finance.getAttachmentUrl, {
        userId,
        attachmentId: document.attachmentId,
      })
      if (!url) throw new Error("URL do comprovante indisponivel.")
      return url
    }

    const url = await convex.query(api.administrativeDocuments.getDocumentUrl, {
      userId,
      documentId: document._id as Id<"administrativeDocuments">,
    })
    if (!url) throw new Error("URL do arquivo indisponivel.")
    return url
  }

  async function handlePreview(document: AdministrativeDocument) {
    setPreviewDocument(document)
    setPreviewUrl(null)
    setPreviewLoading(true)
    try {
      setPreviewUrl(await loadDocumentUrl(document))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao abrir documento.")
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDownload(document: AdministrativeDocument) {
    try {
      const url = await loadDocumentUrl(document)
      downloadUrl(url, document.fileName)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao baixar documento.")
    }
  }

  function startEdit(document: AdministrativeDocument) {
    if (document.source === "payment_proof") {
      setFeedback("Comprovantes de pagamento sao gerenciados pelo Financeiro.")
      return
    }
    setEditingDocument(document)
    setEditTitle(document.title)
    setEditDescription(document.description ?? "")
    setEditCategory(document.category)
    setEditTags((document.tags ?? []).join(", "))
  }

  async function saveEdit() {
    if (!userId || !editingDocument) return
    if (editingDocument.source === "payment_proof") return
    await updateDocumentMetadata({
      userId,
      documentId: editingDocument._id as Id<"administrativeDocuments">,
      title: editTitle,
      description: editDescription.trim() || undefined,
      category: editCategory,
      tags: editTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
    setEditingDocument(null)
    setFeedback("Metadata atualizada.")
  }

  async function handleArchive(document: AdministrativeDocument) {
    if (!userId) return
    if (document.source === "payment_proof") {
      setFeedback("Comprovantes de pagamento devem ser removidos pelo Financeiro.")
      return
    }
    if (!window.confirm(`Arquivar "${document.title}"?`)) return
    await archiveDocument({ userId, documentId: document._id as Id<"administrativeDocuments"> })
    setFeedback("Documento arquivado.")
  }

  const isFolderRoute = Boolean(initialCategory)

  return (
    <section className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {initialCategory ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Button type="button" asChild variant="ghost" size="sm" className="h-8 px-2">
                <Link href="/administrativo">
                  <ArrowLeft className="mr-1 size-4" />
                  Administrativo
                </Link>
              </Button>
              <span>/</span>
              <span className="font-medium text-foreground">{initialCategory}</span>
            </div>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            {initialCategory ?? "Administrativo"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {initialCategory
              ? "Documentos filtrados por pasta, salvos no Convex Storage."
              : "Centralize contratos, documentos da empresa, certificados e políticas internas."}
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 size-4" />
          Enviar documento
        </Button>
      </div>

      {feedback && (
        <div className="flex items-center justify-between gap-3 border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span>{feedback}</span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => setFeedback(null)}>
            <X className="size-3" />
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={FileText} label="Total de documentos" value={documents?.length ?? 0} />
        <SummaryCard
          icon={Briefcase}
          label="Ultimo upload"
          value={lastUpload ? formatDocumentDate(lastUpload) : "-"}
        />
        <SummaryCard icon={FolderArchive} label="Categorias" value={categoryCount} />
        <SummaryCard
          icon={HardDrive}
          label="Espaco usado"
          value={formatDocumentFileSize(totalBytes)}
        />
      </div>

      {!isFolderRoute && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {folderSummaries.map((folder) => (
            <Link
              key={folder.category}
              href={`/administrativo/${adminDocumentCategoryToSlug(folder.category)}`}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition hover:border-primary/50 hover:bg-muted/25">
                <CardHeader className="pb-2">
                  <CardDescription className="inline-flex items-center gap-2">
                    <FolderArchive className="size-4 text-primary" />
                    Pasta
                  </CardDescription>
                  <CardTitle className="truncate text-base">{folder.category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>{folder.count} documento(s)</p>
                  <p>{formatDocumentFileSize(folder.bytes)}</p>
                  <p className="text-xs">Último upload: {formatDocumentDate(folder.last)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>Arquivos salvos no Convex Storage.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome..."
                className="h-9 sm:w-64"
              />
              {!isFolderRoute && (
                <CategoryFilter value={categoryFilter} onValueChange={setCategoryFilter} />
              )}
              <Select
                value={fileTypeFilter}
                onValueChange={(value) => setFileTypeFilter(value as FileTypeFilter)}
              >
                <SelectTrigger className="h-9 w-full sm:w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Todos tipos</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                  <SelectItem value="docx">DOCX</SelectItem>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DocumentsTable
            documents={visibleDocuments}
            loading={loading}
            onPreview={handlePreview}
            onDownload={(document) => void handleDownload(document)}
            onEdit={startEdit}
            onArchive={(document) => void handleArchive(document)}
          />
        </CardContent>
      </Card>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={handleUpload}
        defaultCategory={initialCategory ?? undefined}
      />
      <DocumentPreviewModal
        open={Boolean(previewDocument)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDocument(null)
            setPreviewUrl(null)
          }
        }}
        document={previewDocument}
        url={previewUrl}
        loading={previewLoading}
      />
      <EditDocumentDialog
        document={editingDocument}
        title={editTitle}
        description={editDescription}
        category={editCategory}
        tags={editTags}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onCategoryChange={setEditCategory}
        onTagsChange={setEditTags}
        onClose={() => setEditingDocument(null)}
        onSave={() => void saveEdit()}
      />
    </section>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="inline-flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function EditDocumentDialog({
  document,
  title,
  description,
  category,
  tags,
  onTitleChange,
  onDescriptionChange,
  onCategoryChange,
  onTagsChange,
  onClose,
  onSave,
}: {
  document: AdministrativeDocument | null
  title: string
  description: string
  category: AdminDocumentCategory
  tags: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCategoryChange: (value: AdminDocumentCategory) => void
  onTagsChange: (value: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog.Root open={Boolean(document)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 border bg-card p-5 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">Editar documento</Dialog.Title>
              <p className="text-sm text-muted-foreground">{document?.fileName}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3">
            <Input value={title} onChange={(event) => onTitleChange(event.target.value)} />
            <Select
              value={category}
              onValueChange={(value) => onCategoryChange(value as AdminDocumentCategory)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {ADMIN_DOCUMENT_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
            <Input value={tags} onChange={(event) => onTagsChange(event.target.value)} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={onSave}>
              Salvar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
