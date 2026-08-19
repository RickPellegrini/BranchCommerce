import type { LucideIcon } from "lucide-react"
import { ArrowRight, LoaderCircle } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function MobilePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6 px-4 pb-8 pt-3", className)}>{children}</div>
}

export function MobileHero({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[var(--mobile-ink)] p-5 text-[var(--mobile-surface)] shadow-[0_18px_50px_rgb(23_53_42/18%)]">
      <div className="absolute -right-9 -top-12 size-32 rounded-full bg-[var(--mobile-accent)]/25 blur-sm" />
      <div className="absolute -bottom-16 left-10 size-28 rounded-full border border-white/10" />
      <div className="relative space-y-3">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[var(--mobile-accent)]">
          {eyebrow}
        </p>
        <h1 className="mobile-display max-w-[18rem] text-[1.7rem] font-semibold leading-[1.12] tracking-[-0.04em]">
          {title}
        </h1>
        {description && (
          <p className="max-w-sm text-sm leading-relaxed text-white/65">{description}</p>
        )}
        {action}
      </div>
    </section>
  )
}

export function MobileSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="mobile-display text-base font-semibold tracking-[-0.02em]">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-current/55">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function MobileMetric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string
  value: string
  detail?: string
  tone?: "neutral" | "positive" | "warning" | "danger"
}) {
  return (
    <article
      className={cn(
        "min-w-[9.5rem] rounded-[1.4rem] border border-black/5 bg-[var(--mobile-card)] p-4 shadow-[0_8px_24px_rgb(23_53_42/6%)] dark:border-white/8",
        tone === "positive" && "border-emerald-600/15",
        tone === "warning" && "border-amber-500/25",
        tone === "danger" && "border-red-500/20",
      )}
    >
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-current/45">
        {label}
      </p>
      <p className="mobile-display mt-2 text-lg font-semibold tracking-[-0.04em]">{value}</p>
      {detail && <p className="mt-1 text-xs leading-snug text-current/50">{detail}</p>}
    </article>
  )
}

export function MobileActionLink({
  href,
  icon: Icon,
  label,
  detail,
  accent = false,
}: {
  href: string
  icon: LucideIcon
  label: string
  detail: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mobile-tap group flex items-center gap-3 rounded-[1.35rem] border border-black/5 bg-[var(--mobile-card)] p-3.5 shadow-[0_7px_22px_rgb(23_53_42/5%)] transition active:scale-[0.985] dark:border-white/8",
        accent && "bg-[var(--mobile-accent)] text-[#17352a]",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-current/8">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block truncate text-xs text-current/50">{detail}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-current/35 transition group-active:translate-x-0.5" />
    </Link>
  )
}

export function MobileEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-current/15 bg-[var(--mobile-card)] px-5 py-8 text-center">
      <Icon className="mx-auto size-8 text-current/30" />
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-current/50">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function MobileLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-current/50">
      <LoaderCircle className="size-7 animate-spin" />
      <p className="text-xs font-semibold">{label}</p>
    </div>
  )
}
