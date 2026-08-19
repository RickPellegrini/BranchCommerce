"use client"

import { SignIn, useAuth, useClerk } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"

export function ClerkSignIn() {
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldSwitchAccount = searchParams.get("switch_account") === "1"
  const signOutStarted = useRef(false)

  useEffect(() => {
    if (!shouldSwitchAccount || !isLoaded || !isSignedIn || signOutStarted.current) {
      return
    }

    signOutStarted.current = true
    void clerk.signOut({ redirectUrl: "/sign-in" }).catch(() => {
      signOutStarted.current = false
      router.replace("/sign-in")
    })
  }, [clerk, isLoaded, isSignedIn, router, shouldSwitchAccount])

  if (shouldSwitchAccount && (!isLoaded || isSignedIn)) {
    return (
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        <p className="font-medium">Trocando conta...</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Estamos encerrando a sessão atual do Clerk para você escolher o e-mail correto.
        </p>
      </div>
    )
  }

  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      oauthFlow="redirect"
      oidcPrompt="select_account"
      fallbackRedirectUrl="/dashboard"
    />
  )
}
