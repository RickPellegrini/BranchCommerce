"use client"

import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { appModuleNavItems, getActiveModuleFromPath } from "./module-nav"

export function AppSidebar() {
  const pathname = usePathname()
  const activeModule = getActiveModuleFromPath(pathname)

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-3 border-r bg-card/70 p-4 lg:flex">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image
            src="/branch_logo.jpeg"
            alt="BranchHub logo"
            width={28}
            height={28}
            className="rounded-none object-cover"
          />
          <h2 className="text-sm font-semibold">BranchHub</h2>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserButton />
        </div>
      </div>
      <Separator />
      <p className="text-xs text-muted-foreground">Modulos</p>
      <nav className="grid gap-2">
        {appModuleNavItems.map((item) => {
          const Icon = item.icon
          const active = activeModule === item.key
          return (
            <Button
              key={item.key}
              asChild={item.enabled}
              variant={active ? "default" : "ghost"}
              className={cn("justify-start", !item.enabled && "opacity-70")}
              title={item.enabled ? item.label : "Modulo ainda centralizado em /dashboard"}
            >
              {item.enabled ? (
                <Link href={item.href}>
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              ) : (
                <span>
                  <Icon className="size-4" />
                  {item.label}
                </span>
              )}
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
