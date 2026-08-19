import { Building2, FileSearch, Globe2, PlugZap, ShieldCheck, Sparkles } from "lucide-react"
import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import {
  MobileActionLink,
  MobileHero,
  MobilePage,
  MobileSection,
} from "@/components/mobile/mobile-ui"

export function MobileMoreScreen() {
  return (
    <MobilePage>
      <MobileHero
        eyebrow="Ferramentas"
        title="Tudo o que complementa sua operação."
        description="Recursos menos frequentes ficam aqui, sem disputar espaço com suas tarefas diárias."
      />

      <MobileSection title="Recursos" description="Escolha o que você quer resolver agora.">
        <div className="grid gap-3">
          <MobileActionLink
            href="/mobile/hunter"
            icon={FileSearch}
            label="Branch Hunter"
            detail="Analise anúncios e fornecedores"
            accent
          />
          <MobileActionLink
            href="/mobile/administrativo"
            icon={Building2}
            label="Administrativo"
            detail="Documentos, contratos e certificados"
          />
          <MobileActionLink
            href="/mobile/integracoes"
            icon={PlugZap}
            label="Integrações"
            detail="Mercado Livre, Mercado Pago e sincronização"
          />
          <MobileActionLink
            href="/mobile/conta"
            icon={ShieldCheck}
            label="Conta e privacidade"
            detail="Dados pessoais e segurança"
          />
        </div>
      </MobileSection>

      <section className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-black/5 bg-[var(--mobile-card)] p-4 shadow-[0_8px_24px_rgb(23_53_42/5%)] dark:border-white/8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-current/6">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold">Aparência</p>
            <p className="text-xs text-current/50">Claro ou escuro</p>
          </div>
        </div>
        <ThemeToggle />
      </section>

      <Link
        href="/dashboard?view=desktop"
        className="mobile-tap flex items-center justify-center gap-2 rounded-2xl border border-current/10 text-sm font-bold text-current/60"
      >
        <Globe2 className="size-4" />
        Abrir versão completa do webapp
      </Link>
    </MobilePage>
  )
}
