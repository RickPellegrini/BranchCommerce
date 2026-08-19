"use client"

import { SignIn, useSignIn } from "@clerk/nextjs"
import { LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"

const SIGN_IN_REDIRECT_URL = "/branch-hunter"
const SSO_CALLBACK_URL = "/sso-callback"

export function GoogleAccountPickerSignIn() {
  const searchParams = useSearchParams()
  const { signIn, fetchStatus, errors } = useSignIn()
  const [localError, setLocalError] = useState<string | null>(null)

  if (searchParams.get("legacy") === "1") {
    return (
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        oauthFlow="redirect"
        oidcPrompt="select_account"
        fallbackRedirectUrl={SIGN_IN_REDIRECT_URL}
      />
    )
  }

  async function chooseGoogleAccount() {
    setLocalError(null)

    try {
      await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: SIGN_IN_REDIRECT_URL,
        redirectCallbackUrl: SSO_CALLBACK_URL,
        oidcPrompt: "select_account",
      })
    } catch (caughtError) {
      setLocalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel abrir o login do Google.",
      )
    }
  }

  const errorMessage = localError ?? errors?.global?.[0]?.message ?? null
  const isLoading = fetchStatus === "fetching"

  return (
    <section className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-7 text-card-foreground shadow-xl shadow-black/5">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Branch Commerce
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar na plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Use o botao abaixo para forcar o Google a perguntar qual conta voce quer usar.
        </p>
      </div>

      <Button className="h-11 w-full gap-3" disabled={isLoading} onClick={chooseGoogleAccount}>
        {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <GoogleMark />}
        Escolher conta Google
      </Button>

      {errorMessage && <p className="text-center text-sm text-destructive">{errorMessage}</p>}

      <div className="space-y-3 border-t pt-5 text-center text-sm text-muted-foreground">
        <p>Se precisar de Microsoft, email ou outro metodo:</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in?legacy=1">Abrir login completo</Link>
        </Button>
      </div>
    </section>
  )
}

function GoogleMark() {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-white text-sm font-bold text-[#4285f4]">
      G
    </span>
  )
}
