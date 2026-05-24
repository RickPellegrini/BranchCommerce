"use client"

import type { LucideIcon } from "lucide-react"
import { Briefcase, Boxes, Home, Search, Settings, Store, Wallet } from "lucide-react"

export type AppModuleKey =
  | "dashboard"
  | "financeiro"
  | "estoque"
  | "mercado-livre"
  | "branch-hunter"
  | "ti"
  | "administrativo"

export type AppModuleNavItem = {
  key: AppModuleKey
  label: string
  href: string
  icon: LucideIcon
  enabled: boolean
}

export const appModuleNavItems: AppModuleNavItem[] = [
  { key: "dashboard", label: "Home", href: "/dashboard", icon: Home, enabled: true },
  { key: "financeiro", label: "Financeiro", href: "/dashboard", icon: Wallet, enabled: false },
  { key: "estoque", label: "Estoque", href: "/dashboard", icon: Boxes, enabled: false },
  {
    key: "mercado-livre",
    label: "Mercado Livre",
    href: "/dashboard",
    icon: Store,
    enabled: false,
  },
  {
    key: "branch-hunter",
    label: "Branch Hunter",
    href: "/dashboard",
    icon: Search,
    enabled: false,
  },
  { key: "ti", label: "TI", href: "/dashboard", icon: Settings, enabled: false },
  {
    key: "administrativo",
    label: "Administrativo",
    href: "/administrativo",
    icon: Briefcase,
    enabled: true,
  },
]

export function getActiveModuleFromPath(pathname: string): AppModuleKey {
  if (pathname.startsWith("/administrativo")) return "administrativo"
  if (pathname.startsWith("/financeiro")) return "financeiro"
  if (pathname.startsWith("/estoque")) return "estoque"
  if (pathname.startsWith("/mercado-livre")) return "mercado-livre"
  if (pathname.startsWith("/branch-hunter")) return "branch-hunter"
  if (pathname.startsWith("/ti")) return "ti"
  return "dashboard"
}
