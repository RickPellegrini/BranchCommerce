import { Suspense } from "react"

import { ClerkSignIn } from "@/components/auth/clerk-sign-in"

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={null}>
        <ClerkSignIn />
      </Suspense>
    </main>
  )
}
