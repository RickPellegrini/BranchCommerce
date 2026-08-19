"use client"

import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import type { ReactNode } from "react"

export function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[#07120d]/55 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="mobile-sheet-content mobile-safe-bottom fixed bottom-0 left-1/2 z-[71] max-h-[88dvh] w-full max-w-lg -translate-x-1/2 overscroll-contain rounded-t-[2rem] border-x border-t border-black/5 bg-[#fffdf8] px-5 pb-5 pt-3 text-[#17352a] shadow-[0_-24px_80px_rgb(0_0_0/22%)] outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom dark:border-white/10 dark:bg-[#182a21] dark:text-[#eff6ec]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-current/15" />
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="mobile-display text-xl font-semibold tracking-[-0.04em]">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-current/50">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="mobile-tap grid size-12 shrink-0 place-items-center rounded-2xl bg-current/6">
              <X className="size-5" />
              <span className="sr-only">Fechar</span>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
