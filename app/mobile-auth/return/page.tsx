import { auth } from "@clerk/nextjs/server"
import { ShieldCheck } from "lucide-react"
import { redirect } from "next/navigation"

import { MobileAuthReturnActions } from "@/components/mobile/mobile-auth-return-actions"

export const dynamic = "force-dynamic"

export default async function MobileAuthReturnPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/mobile-auth/return")

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-sm space-y-6 rounded-3xl border bg-card p-7 text-center shadow-xl shadow-black/5">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Clerk seguro
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Login confirmado</h1>
          <p className="text-sm text-muted-foreground">
            Sua identidade foi validada. Estamos concluindo o acesso no Branch Commerce.
          </p>
        </div>

        <MobileAuthReturnActions />
      </section>
    </main>
  )
}
