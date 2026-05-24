"use client"

import { UserButton } from "@clerk/nextjs"
import Image from "next/image"

import { ThemeToggle } from "@/components/theme-toggle"

export function Topbar({ subtitle }: { subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 px-3 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/branch_logo.jpeg"
            alt="BranchHub logo"
            width={28}
            height={28}
            className="rounded-none object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">BranchHub</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <UserButton />
        </div>
      </div>
    </header>
  )
}
