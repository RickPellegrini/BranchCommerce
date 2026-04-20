import type { LucideProps } from "lucide-react"
import {
  ClipboardList,
  ListTodo,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Truck,
} from "lucide-react"

import { cn } from "@/lib/utils"

/** Ícones por coluna do Kanban — alinhados ao restante do app (lucide, traço fino). */
export const KANBAN_STAGE_ICONS = {
  em_falta: PackageX,
  planned: ListTodo,
  buying: ShoppingCart,
  in_transit: Truck,
  in_stock: PackageCheck,
} as const

export type KanbanStageId = keyof typeof KANBAN_STAGE_ICONS

export function KanbanStageIcon({
  stageId,
  className,
  ...props
}: { stageId: string } & LucideProps) {
  const Icon =
    KANBAN_STAGE_ICONS[stageId as KanbanStageId] ?? ClipboardList
  return <Icon className={cn("h-4 w-4 shrink-0", className)} {...props} />
}

/** Borda esquerda + tom do ícone + badge de contagem (estilo dashboard, sem fundo “neon”). */
export const KANBAN_STAGE_STYLE: Record<
  string,
  { border: string; icon: string; badge: string }
> = {
  em_falta: {
    border: "border-l-red-500",
    icon: "text-red-600 dark:text-red-400",
    badge:
      "bg-red-500/10 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
  planned: {
    border: "border-l-sky-500",
    icon: "text-sky-600 dark:text-sky-400",
    badge:
      "bg-sky-500/10 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  },
  buying: {
    border: "border-l-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
    badge:
      "bg-amber-500/10 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  },
  in_transit: {
    border: "border-l-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
    badge:
      "bg-orange-500/10 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200",
  },
  in_stock: {
    border: "border-l-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
    badge:
      "bg-emerald-500/10 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
}

export function kanbanStageStyle(stageId: string) {
  return (
    KANBAN_STAGE_STYLE[stageId] ?? {
      border: "border-l-border",
      icon: "text-muted-foreground",
      badge: "bg-muted text-muted-foreground",
    }
  )
}
