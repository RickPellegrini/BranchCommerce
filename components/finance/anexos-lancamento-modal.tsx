"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Dialog } from "radix-ui"
import { Download, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { AnexoLancamento } from "@/lib/finance/types"
import {
  ANEXO_ACCEPT_ATTR,
  buildAnexosFromFiles,
  formatAnexoDateTime,
  formatAnexoFileSize,
} from "@/lib/finance/anexo-helpers"
import { cn } from "@/lib/utils"

function downloadBlob(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  a.rel = "noopener"
  a.click()
  URL.revokeObjectURL(url)
}

export type AnexosLancamentoModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lancamentoDescription: string
  anexos: AnexoLancamento[]
  /** Substitui a lista inteira de anexos do lançamento (estado controlado no pai). */
  onAnexosChange: (next: AnexoLancamento[]) => void
}

/**
 * Modal para gerenciar comprovantes anexados a um lançamento.
 *
 * Persistência: hoje usa apenas estado em memória no componente pai.
 * Para integrar com backend, substituir `onAnexosChange` por chamadas a
 * `POST /lancamentos/:id/anexos`, `GET /lanchamentos/:id/anexos`, `DELETE ...`
 * e armazenar URLs/ids retornados em vez de `File` puro.
 */
export function AnexosLancamentoModal({
  open,
  onOpenChange,
  lancamentoDescription,
  anexos,
  onAnexosChange,
}: AnexosLancamentoModalProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!success) return
    const t = window.setTimeout(() => setSuccess(null), 3500)
    return () => window.clearTimeout(t)
  }, [success])

  const runValidatedAdd = useCallback(
    async (fileList: File[]) => {
      setError(null)
      const { ok, error: err } = buildAnexosFromFiles(fileList)
      if (err) {
        setError(err)
        return
      }
      if (ok.length === 0) return

      setIsUploading(true)
      try {
        // Simula latência de rede; remover quando houver upload real ao servidor.
        await new Promise((r) => setTimeout(r, 400))
        onAnexosChange([...anexos, ...ok])
        setSuccess(
          ok.length === 1
            ? "Arquivo anexado com sucesso."
            : `${ok.length} arquivos anexados com sucesso.`,
        )
      } finally {
        setIsUploading(false)
      }
    },
    [anexos, onAnexosChange],
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.length) void runValidatedAdd(Array.from(files))
    e.target.value = ""
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) void runValidatedAdd(Array.from(e.dataTransfer.files))
  }

  const onRemove = (id: string) => {
    if (!window.confirm("Excluir este anexo?")) return
    onAnexosChange(anexos.filter((a) => a.id !== id))
    setSuccess("Anexo removido.")
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
            "overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold">Anexos do lançamento</Dialog.Title>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                {lancamentoDescription || "Sem descrição"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="size-4" />
            </Button>
          </div>

          {success && (
            <p className="mb-3 rounded-none border border-emerald-300/80 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {success}
            </p>
          )}
          {error && (
            <p className="mb-3 rounded-none border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "copy"
            }}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20",
              isUploading && "pointer-events-none opacity-70",
            )}
          >
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              className="sr-only"
              accept={ANEXO_ACCEPT_ATTR}
              multiple
              onChange={onInputChange}
            />
            {isUploading ? (
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            ) : (
              <Upload className="size-8 text-muted-foreground" aria-hidden />
            )}
            <p className="text-sm text-muted-foreground">
              Arraste arquivos aqui ou{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                selecione
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG, JPEG ou WebP · máx. 10 MB por arquivo
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1 gap-2"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Paperclip className="size-4" />
              )}
              Selecionar arquivo
            </Button>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium">Arquivos ({anexos.length})</p>
            {anexos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum anexo ainda. Envie comprovantes ou notas fiscais acima.
              </p>
            ) : (
              <ul className="space-y-2">
                {anexos.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 rounded-none border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium" title={a.file.name}>
                      {a.file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatAnexoFileSize(a.file.size)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatAnexoDateTime(a.uploadedAt)}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Download"
                        onClick={() => downloadBlob(a.file)}
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={() => onRemove(a.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export type LancamentoFormAnexosProps = {
  anexos: AnexoLancamento[]
  onAnexosChange: (next: AnexoLancamento[]) => void
  disabled?: boolean
}

/** Área de comprovantes no formulário da aba Lançamentos (antes de salvar). */
export function LancamentoFormAnexos({
  anexos,
  onAnexosChange,
  disabled,
}: LancamentoFormAnexosProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addFiles(fileList: File[]) {
    setError(null)
    const { ok, error: err } = buildAnexosFromFiles(fileList)
    if (err) {
      setError(err)
      return
    }
    if (ok.length === 0) return
    onAnexosChange([...anexos, ...ok])
  }

  function remove(id: string) {
    if (!window.confirm("Remover este arquivo da lista?")) return
    onAnexosChange(anexos.filter((a) => a.id !== id))
  }

  return (
    <div className="md:col-span-2 space-y-3 rounded-none border border-dashed border-primary/25 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Paperclip className="size-4 text-primary" />
        <p className="text-sm font-medium">Comprovantes (opcional)</p>
        {anexos.length > 0 ? <AnexosCountBadge count={anexos.length} /> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Anexe antes de salvar; os arquivos ficam ligados ao lançamento criado. PDF, JPG, PNG ou WebP
        · máx. 10 MB cada.
      </p>

      {error && (
        <p className="rounded-none border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div
        className={cn(
          "rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 bg-background/80",
          disabled && "pointer-events-none opacity-50",
        )}
        onDragEnter={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files))
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={ANEXO_ACCEPT_ATTR}
          multiple
          disabled={disabled}
          onChange={(e) => {
            const files = e.target.files
            if (files?.length) addFiles(Array.from(files))
            e.target.value = ""
          }}
        />
        <p className="text-sm text-muted-foreground">
          Arraste aqui ou{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            selecionar arquivos
          </button>
        </p>
      </div>

      {anexos.length > 0 && (
        <ul className="space-y-2">
          {anexos.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-none border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium" title={a.file.name}>
                {a.file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatAnexoFileSize(a.file.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => remove(a.id)}
                disabled={disabled}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Contagem ao lado do ícone de clipe na tabela (evita ícone duplicado). */
export function AnexosCountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <Badge
      variant="secondary"
      className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-semibold tabular-nums"
    >
      {count}
    </Badge>
  )
}
