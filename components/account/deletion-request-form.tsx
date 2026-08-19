"use client"

import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type RequestStatus = "requested" | "cancelled" | null

export function DeletionRequestForm({ initialStatus }: { initialStatus: RequestStatus }) {
  const [status, setStatus] = useState(initialStatus)
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitRequest = async (method: "POST" | "DELETE") => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/account/deletion-request", { method })
      const result = (await response.json()) as {
        error?: string
        deletionRequest?: { status?: RequestStatus }
      }

      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a solicitação.")

      setStatus(result.deletionRequest?.status ?? (method === "POST" ? "requested" : "cancelled"))
      setConfirmed(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível registrar a solicitação.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "requested") {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-500/35 bg-amber-500/8 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="font-semibold">Solicitação recebida</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A conta e os dados associados serão excluídos em até 30 dias. Você pode cancelar a
              solicitação enquanto ela ainda estiver em análise.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => void submitRequest("DELETE")}
        >
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          Cancelar solicitação
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <p className="text-sm text-muted-foreground">
          A exclusão removerá o acesso, dados financeiros, estoque, documentos e conexões com
          serviços externos. Dados que precisem ser mantidos por obrigação legal serão retidos
          somente pelo prazo necessário.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 size-4 accent-destructive"
        />
        <span>Entendo que a exclusão é permanente e quero solicitar a remoção da conta.</span>
      </label>

      <Button
        type="button"
        variant="destructive"
        disabled={!confirmed || isSubmitting}
        onClick={() => void submitRequest("POST")}
      >
        {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
        Solicitar exclusão da conta
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
