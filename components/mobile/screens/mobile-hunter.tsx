"use client"

import { PackageSearch, ScanSearch } from "lucide-react"
import { useState } from "react"

import { MobileHero, MobilePage } from "@/components/mobile/mobile-ui"
import { BranchHunterSupplierPage } from "@/features/product-analysis/components/BranchHunterSupplierPage"
import { HunterAnalysisPage } from "@/features/product-analysis/components/HunterAnalysisPage"
import { cn } from "@/lib/utils"

type HunterMode = "listing" | "supplier"

export function MobileHunterScreen() {
  const [mode, setMode] = useState<HunterMode>("listing")

  return (
    <MobilePage className="mobile-hunter">
      <MobileHero
        eyebrow="Branch Hunter"
        title="Encontre oportunidades antes de comprar."
        description="Analise concorrência ou compare uma lista completa de fornecedor."
      />

      <div className="grid grid-cols-2 gap-2 rounded-[1.35rem] bg-current/5 p-1.5" role="tablist">
        <ModeButton
          active={mode === "listing"}
          onClick={() => setMode("listing")}
          icon={ScanSearch}
          label="Anúncio"
        />
        <ModeButton
          active={mode === "supplier"}
          onClick={() => setMode("supplier")}
          icon={PackageSearch}
          label="Fornecedor"
        />
      </div>

      <div role="tabpanel" className="min-w-0">
        {mode === "listing" ? <HunterAnalysisPage /> : <BranchHunterSupplierPage />}
      </div>
    </MobilePage>
  )
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof ScanSearch
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "mobile-tap inline-flex items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold transition",
        active ? "bg-[var(--mobile-card)] shadow-sm" : "text-current/45",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}
