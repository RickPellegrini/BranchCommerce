"use client"

import { Browser } from "@capacitor/browser"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

import { GoogleAccountPickerSignIn } from "@/components/auth/google-account-picker-sign-in"
import { Button } from "@/components/ui/button"

interface ExternalBrowserPlugin {
  open(options: { url: string }): Promise<void>
}

interface NativeClerkAuthPlugin {
  signIn(): Promise<{ sessionToken: string }>
}

const ExternalBrowser = registerPlugin<ExternalBrowserPlugin>("ExternalBrowser")
const NativeClerkAuth = registerPlugin<NativeClerkAuthPlugin>("NativeClerkAuth")

export function NativeAwareSignIn() {
  const [isNative, setIsNative] = useState<boolean | null>(null)
  const [supportsNativeClerk, setSupportsNativeClerk] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const native = Capacitor.isNativePlatform()
    setIsNative(native)
    setSupportsNativeClerk(
      native &&
        Capacitor.getPlatform() === "android" &&
        Capacitor.isPluginAvailable("NativeClerkAuth"),
    )
  }, [])

  async function startSignIn() {
    setIsOpening(true)
    setError(null)

    try {
      if (supportsNativeClerk) {
        const { sessionToken } = await NativeClerkAuth.signIn()
        const response = await fetch("/api/mobile/auth/native-exchange", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        })
        const body = (await response.json()) as { ticket?: string; error?: string }
        if (!response.ok || !body.ticket) {
          throw new Error(body.error ?? "Nao foi possivel criar a sessao do aplicativo.")
        }

        window.location.replace(`/mobile-auth/callback?ticket=${encodeURIComponent(body.ticket)}`)
        return
      }

      const url = new URL("/api/mobile/auth/start", window.location.origin).toString()
      if (Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("ExternalBrowser")) {
        await ExternalBrowser.open({ url })
      } else {
        await Browser.open({ url })
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel abrir o login seguro. Tente novamente.",
      )
    } finally {
      setIsOpening(false)
    }
  }

  if (isNative === null) {
    return (
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
    )
  }

  if (isNative) {
    return (
      <section className="w-full max-w-sm space-y-6 rounded-3xl border bg-card p-7 shadow-xl shadow-black/5">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Branch Commerce
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar no aplicativo</h1>
          <p className="text-sm text-muted-foreground">
            {supportsNativeClerk
              ? "A tela segura do Clerk sera aberta dentro do aplicativo."
              : "O Clerk abrira o Google com seguranca e retornara ao aplicativo."}
          </p>
        </div>

        <Button className="w-full" size="lg" disabled={isOpening} onClick={startSignIn}>
          {isOpening ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : supportsNativeClerk ? (
            <ShieldCheck className="size-4" />
          ) : (
            <ExternalLink className="size-4" />
          )}
          Continuar com Clerk
        </Button>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          Autenticacao protegida pelo Clerk.
        </p>
      </section>
    )
  }

  return <GoogleAccountPickerSignIn />
}
