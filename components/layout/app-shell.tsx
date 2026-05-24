"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AppSidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { appModuleNavItems, getActiveModuleFromPath } from "./module-nav"

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname()
  const activeModule = getActiveModuleFromPath(pathname)

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <section className="min-w-0 flex-1">
        <Topbar subtitle={title} />
        <nav className="flex gap-2 overflow-x-auto border-b px-3 py-2 lg:hidden">
          {appModuleNavItems.map((item) => {
            const Icon = item.icon
            const active = activeModule === item.key
            return item.enabled ? (
              <Button
                key={item.key}
                asChild
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-9 shrink-0 px-3"
              >
                <Link href={item.href}>
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ) : (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant="outline"
                className={cn("h-9 shrink-0 px-3 opacity-70", active && "opacity-100")}
                title="Modulo ainda centralizado em /dashboard"
              >
                <Icon className="size-4" />
                {item.label}
              </Button>
            )
          })}
        </nav>
        <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 lg:px-6">{children}</div>
      </section>
    </main>
  )
}
