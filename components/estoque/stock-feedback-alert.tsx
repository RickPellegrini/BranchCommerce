"use client"

import { AlertCircle, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { sanitizeConvexErrorMessage } from "@/lib/sanitize-convex-error"

type StockFeedbackAlertProps = {
  type: "success" | "error"
  message: string
  className?: string
}

export function StockFeedbackAlert({ type, message, className }: StockFeedbackAlertProps) {
  const text = type === "error" ? sanitizeConvexErrorMessage(message) : message.trim()
  if (!text) return null

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm leading-snug",
        type === "success"
          ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/35 dark:text-emerald-200"
          : "border-destructive/45 bg-destructive/[0.12] text-destructive dark:bg-destructive/15",
        className,
      )}
    >
      {type === "success" ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 opacity-90" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
      )}
      <p className="min-w-0 flex-1">{text}</p>
    </div>
  )
}
