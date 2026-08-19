import { currentUser } from "@clerk/nextjs/server"
import { ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { DeletionRequestForm } from "@/components/account/deletion-request-form"
import { MobileHero, MobilePage, MobileSection } from "@/components/mobile/mobile-ui"

type DeletionRequestMetadata = { status?: "requested" | "cancelled" }

export default async function MobileAccountPage() {
  const user = await currentUser()
  if (!user) redirect("/sign-in?redirect_url=/mobile/conta")

  const request = user.privateMetadata.accountDeletionRequest as DeletionRequestMetadata | undefined

  return (
    <MobilePage>
      <MobileHero
        eyebrow="Conta"
        title="Seus dados sob seu controle."
        description="Gerencie privacidade e segurança sem sair do aplicativo."
      />

      <MobileSection title="Seus dados">
        <div className="rounded-[1.5rem] border border-black/5 bg-[var(--mobile-card)] p-4 shadow-sm dark:border-white/8">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-600/10 text-emerald-700">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.fullName || "Sua conta"}</p>
              <p className="truncate text-xs text-current/50">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
          <Link
            href="/privacidade"
            className="mobile-tap mt-4 flex items-center justify-center gap-2 rounded-2xl border border-current/10 text-sm font-bold"
          >
            Política de privacidade
            <ExternalLink className="size-4" />
          </Link>
        </div>
      </MobileSection>

      <MobileSection
        title="Excluir conta"
        description="Uma ação protegida e reversível antes do prazo final."
      >
        <div className="rounded-[1.5rem] border border-red-500/20 bg-[var(--mobile-card)] p-4 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600">
              <LockKeyhole className="size-5" />
            </span>
            <p className="text-xs leading-relaxed text-current/55">
              A solicitação remove sua conta e os dados vinculados ao Branch Commerce.
            </p>
          </div>
          <DeletionRequestForm initialStatus={request?.status ?? null} />
        </div>
      </MobileSection>
    </MobilePage>
  )
}
