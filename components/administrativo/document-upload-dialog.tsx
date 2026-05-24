"use client"

import { Dialog } from "radix-ui"
import { Loader2, Upload, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  ADMIN_DOCUMENT_ACCEPT_ATTR,
  ADMIN_DOCUMENT_CATEGORIES,
  formatDocumentFileSize,
  inferDocumentTitle,
  isAcceptedAdminDocument,
  MAX_ADMIN_DOCUMENT_BYTES,
  type AdminDocumentCategory,
} from "@/lib/administrativo/documents"
import { cn } from "@/lib/utils"

export type DocumentUploadPayload = {
  file: File
  title: string
  description?: string
  category: AdminDocumentCategory
  tags?: string[]
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: DocumentUploadPayload) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<AdminDocumentCategory>("Contratos")
  const [tagsText, setTagsText] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tags = useMemo(
    () =>
      tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsText],
  )

  function resetForm() {
    setFile(null)
    setTitle("")
    setDescription("")
    setCategory("Contratos")
    setTagsText("")
    setError(null)
  }

  function selectFile(nextFile: File) {
    setError(null)
    if (nextFile.size > MAX_ADMIN_DOCUMENT_BYTES) {
      setError(`Arquivo muito grande. Limite: ${formatDocumentFileSize(MAX_ADMIN_DOCUMENT_BYTES)}.`)
      return
    }
    if (!isAcceptedAdminDocument(nextFile)) {
      setError("Tipo nao permitido. Use PDF, PNG, JPG, JPEG, DOCX ou XLSX.")
      return
    }
    setFile(nextFile)
    setTitle((current) => current || inferDocumentTitle(nextFile.name))
  }

  async function submit() {
    if (!file) {
      setError("Selecione um arquivo.")
      return
    }
    if (!title.trim()) {
      setError("Informe um titulo.")
      return
    }

    setIsUploading(true)
    setError(null)
    try {
      await onSubmit({
        file,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        tags,
      })
      resetForm()
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao enviar documento.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isUploading) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2",
            "overflow-y-auto rounded-none border border-border bg-card p-5 shadow-xl",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">Enviar documento</Dialog.Title>
              <p className="mt-1 text-sm text-muted-foreground">
                Salve contratos, certificados e documentos internos no Convex Storage.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar"
              disabled={isUploading}
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {error && (
            <p className="mb-3 rounded-none border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click()
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setIsDragging(false)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = "copy"
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              const dropped = event.dataTransfer.files?.[0]
              if (dropped) selectFile(dropped)
            }}
            className={cn(
              "mb-4 flex flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-7 text-center",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20",
              isUploading && "pointer-events-none opacity-70",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={ADMIN_DOCUMENT_ACCEPT_ATTR}
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) selectFile(selected)
                event.target.value = ""
              }}
            />
            {isUploading ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : (
              <Upload className="size-8 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">
              Arraste um arquivo aqui ou{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                selecione
              </button>
            </p>
            <p className="text-xs text-muted-foreground">PDF, PNG, JPG, JPEG, DOCX ou XLSX</p>
            {file && (
              <p className="mt-1 text-xs font-medium">
                {file.name} · {formatDocumentFileSize(file.size)}
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium">Titulo</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">Categoria</label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as AdminDocumentCategory)}
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
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">Descricao</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">Tags</label>
              <Input
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="Separadas por virgula"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={isUploading} onClick={() => void submit()}>
              {isUploading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enviar documento
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
