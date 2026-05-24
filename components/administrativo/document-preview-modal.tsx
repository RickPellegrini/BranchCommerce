"use client"

import { Dialog } from "radix-ui"
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isPreviewableFile } from "@/lib/administrativo/documents"
import type { AdministrativeDocument } from "./types"

function openDownload(url: string, fileName: string) {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener noreferrer"
  anchor.click()
}

export function DocumentPreviewModal({
  document,
  url,
  loading,
  open,
  onOpenChange,
}: {
  document: AdministrativeDocument | null
  url: string | null
  loading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const previewKind = document ? isPreviewableFile(document.fileType, document.fileName) : null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[min(96vw,980px)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-none border border-border bg-card shadow-xl",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold">
                {document?.title ?? "Documento"}
              </Dialog.Title>
              <p className="truncate text-xs text-muted-foreground">
                {document?.fileName ?? "Carregando arquivo"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {url && document && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Baixar"
                    onClick={() => openDownload(url, document.fileName)}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    asChild
                    variant="ghost"
                    size="icon"
                    title="Abrir em nova aba"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-[55vh] overflow-hidden bg-muted/20">
            {loading ? (
              <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando visualizacao...
              </div>
            ) : !url || !document ? (
              <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
                Nao foi possivel gerar a URL do arquivo.
              </div>
            ) : previewKind === "image" ? (
              <div className="flex max-h-[76vh] items-center justify-center overflow-auto p-4">
                <img
                  src={url}
                  alt={document.title}
                  className="max-h-[72vh] max-w-full border bg-background object-contain"
                />
              </div>
            ) : previewKind === "pdf" ? (
              <iframe title={document.title} src={url} className="h-[76vh] w-full bg-background" />
            ) : (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
                <FileText className="size-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Preview indisponivel para este tipo.</p>
                  <p className="text-xs text-muted-foreground">
                    Baixe o arquivo para abrir no aplicativo adequado.
                  </p>
                </div>
                <Button type="button" onClick={() => openDownload(url, document.fileName)}>
                  <Download className="mr-2 size-4" />
                  Baixar arquivo
                </Button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
