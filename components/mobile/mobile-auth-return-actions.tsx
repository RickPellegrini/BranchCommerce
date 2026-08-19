"use client"

import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

type MobileAuthTicket = {
  intentUrl: string
}

async function createMobileAuthTicket(): Promise<MobileAuthTicket> {
  const response = await fetch("/api/mobile/auth/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) throw new Error("Falha ao criar acesso do aplicativo.")
  return (await response.json()) as MobileAuthTicket
}

export function MobileAuthReturnActions() {
  const [isOpening, setIsOpening] = useState(true)
  const [message, setMessage] = useState("Abrindo o aplicativo automaticamente...")

  useEffect(() => {
    let active = true

    async function openAutomatically() {
      try {
        const ticket = await createMobileAuthTicket()
        if (!active) return
        window.location.assign(ticket.intentUrl)
        window.setTimeout(() => {
          if (!active) return
          setIsOpening(false)
          setMessage("Se o aplicativo nao abriu, toque no botao abaixo.")
        }, 1400)
      } catch {
        if (!active) return
        setIsOpening(false)
        setMessage("Nao foi possivel voltar automaticamente. Tente novamente.")
      }
    }

    void openAutomatically()
    return () => {
      active = false
    }
  }, [])

  async function openManually() {
    setIsOpening(true)
    setMessage("Criando um novo acesso seguro...")

    try {
      const ticket = await createMobileAuthTicket()
      window.location.assign(ticket.intentUrl)
    } catch {
      setIsOpening(false)
      setMessage("Nao foi possivel abrir o aplicativo. Recarregue esta pagina.")
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button className="w-full" size="lg" disabled={isOpening} onClick={openManually}>
        {isOpening ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        Abrir aplicativo
      </Button>
      <Button asChild className="w-full" variant="ghost">
        <a href="/api/mobile/auth/start">
          <RotateCcw className="size-4" />
          Refazer login
        </a>
      </Button>
    </div>
  )
}
