import type { Metadata } from "next"
import Link from "next/link"
import { ShoppingCart, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Loja Branch Commerce",
  description: "Loja oficial Branch Commerce.",
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6efe3] text-[#14251d]">
      <header className="sticky top-0 z-40 border-b border-[#14251d]/10 bg-[#f6efe3]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/loja"
            className="font-[var(--font-mobile-display)] text-xl font-black tracking-[-0.05em]"
          >
            Branch Store
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden rounded-full sm:inline-flex">
              <Link href="/loja/minha-conta">
                <UserRound className="mr-2 size-4" />
                Minha conta
              </Link>
            </Button>
            <Button asChild className="rounded-full bg-[#14251d] text-white hover:bg-[#223a2d]">
              <Link href="/loja/carrinho">
                <ShoppingCart className="mr-2 size-4" />
                Carrinho
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-[#14251d]/10 px-4 py-8 text-center text-xs text-[#5c6d61]">
        Branch Commerce Store - MVP conectado ao backoffice.
      </footer>
    </div>
  )
}
