"use client"

import { useAuth, useClerk, useSignIn } from "@clerk/nextjs"
import { AlertCircle, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

export function MobileAuthCallback({ ticket }: { ticket: string | null }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { client, setActive } = useClerk()
  const { signIn } = useSignIn()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(
    ticket ? null : "O ticket de acesso não foi informado.",
  )

  useEffect(() => {
    if (!ticket || !isLoaded || started.current) return

    if (isSignedIn) {
      window.location.replace("/mobile")
      return
    }

    started.current = true

    const completeSignIn = async () => {
      try {
        const ticketResult = await signIn.ticket({ ticket })
        let sessionId = signIn.createdSessionId ?? signIn.existingSession?.sessionId

        if (!sessionId) {
          const refreshedClient = await client.reload()
          sessionId = refreshedClient.sessions.find((session) => session.status === "active")?.id
        }

        if (!sessionId) throw ticketResult.error ?? new Error("A sessão não foi criada.")

        await setActive({ session: sessionId })
        window.location.replace("/mobile")
      } catch {
        setError("O acesso expirou ou já foi utilizado. Inicie o login novamente.")
      }
    }

    void completeSignIn()
  }, [client, isLoaded, isSignedIn, setActive, signIn, ticket])

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-sm space-y-5 rounded-3xl border bg-card p-7 text-center shadow-xl shadow-black/5">
        {error ? (
          <>
            <AlertCircle className="mx-auto size-9 text-destructive" />
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Não foi possível concluir o login</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/sign-in">Tentar novamente</Link>
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto size-9 animate-spin text-primary" />
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Concluindo acesso</h1>
              <p className="text-sm text-muted-foreground">Validando sua sessão com segurança.</p>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
