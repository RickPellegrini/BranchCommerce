import type { AnexoLancamento } from "@/lib/finance/types"

export const MAX_ANEXO_BYTES = 10 * 1024 * 1024
export const ANEXO_ACCEPT_ATTR =
  ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"

export function newAnexoId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function isAcceptedAnexoFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  if (lower.endsWith(".pdf")) {
    if (!file.type) return true
    return file.type === "application/pdf"
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    if (!file.type) return true
    return file.type === "image/jpeg"
  }
  if (lower.endsWith(".png")) {
    if (!file.type) return true
    return file.type === "image/png"
  }
  if (lower.endsWith(".webp")) {
    if (!file.type) return true
    return file.type === "image/webp"
  }
  return false
}

/** Valida uma lista de ficheiros e devolve itens `AnexoLancamento` ou a primeira mensagem de erro. */
export function buildAnexosFromFiles(files: File[]): { ok: AnexoLancamento[]; error?: string } {
  const ok: AnexoLancamento[] = []
  for (const file of files) {
    if (file.size > MAX_ANEXO_BYTES) {
      return {
        ok: [],
        error: `Arquivo muito grande: "${file.name}" (máx. 10 MB).`,
      }
    }
    if (!isAcceptedAnexoFile(file)) {
      return {
        ok: [],
        error: `Tipo não permitido: "${file.name}". Use PDF, JPG, PNG ou WebP.`,
      }
    }
    ok.push({
      id: newAnexoId(),
      file,
      uploadedAt: Date.now(),
    })
  }
  return { ok }
}

export function formatAnexoFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatAnexoDateTime(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}
