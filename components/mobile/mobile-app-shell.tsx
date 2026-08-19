"use client"

import { UserButton } from "@clerk/nextjs"
import { Boxes, Grid2X2, House, Menu, Store, WalletCards } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const primaryItems = [
  { href: "/mobile", label: "Início", icon: House },
  { href: "/mobile/financeiro", label: "Financeiro", icon: WalletCards },
  { href: "/mobile/estoque", label: "Estoque", icon: Boxes },
  { href: "/mobile/vendas", label: "Vendas", icon: Store },
  { href: "/mobile/mais", label: "Mais", icon: Grid2X2 },
] as const

const titles: Record<string, string> = {
  "/mobile": "Visão de hoje",
  "/mobile/financeiro": "Financeiro",
  "/mobile/estoque": "Estoque",
  "/mobile/vendas": "Vendas",
  "/mobile/mais": "Mais recursos",
  "/mobile/hunter": "Branch Hunter",
  "/mobile/administrativo": "Administrativo",
  "/mobile/integracoes": "Integrações",
  "/mobile/conta": "Conta",
}

function isItemActive(pathname: string, href: string) {
  if (href === "/mobile") return pathname === href
  if (href === "/mobile/mais") {
    return !primaryItems
      .slice(0, 4)
      .some((item) =>
        item.href === "/mobile" ? pathname === item.href : pathname.startsWith(item.href),
      )
  }
  return pathname.startsWith(href)
}

export function MobileAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const title = titles[pathname] ?? "Branch Commerce"

  return (
    <div className="mobile-app">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[var(--mobile-surface)]/88 px-4 py-3 backdrop-blur-xl dark:border-white/8">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link href="/mobile" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--mobile-ink)] text-[var(--mobile-accent)] shadow-sm">
              <Menu className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.18em] text-current/40">
                Branch Commerce
              </span>
              <span className="mobile-display block truncate text-sm font-semibold">{title}</span>
            </span>
          </Link>
          <div className="rounded-2xl bg-[var(--mobile-card)] p-1 shadow-sm">
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100dvh-8rem)] w-full max-w-lg pb-24">{children}</main>

      <nav className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-black/6 bg-[var(--mobile-card)]/94 px-2 pt-2 shadow-[0_-14px_40px_rgb(23_53_42/10%)] backdrop-blur-xl dark:border-white/8">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {primaryItems.map((item) => {
            const active = isItemActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mobile-tap relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[0.62rem] font-bold text-current/42 transition active:scale-95",
                  active && "text-[var(--mobile-ink)]",
                )}
              >
                {active && (
                  <span className="absolute inset-x-2 inset-y-0 rounded-2xl bg-[var(--mobile-accent)]" />
                )}
                <Icon className="relative size-5" strokeWidth={active ? 2.5 : 2} />
                <span className="relative truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
