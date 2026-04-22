"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Package } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  getProductNameSuggestions,
  type ProductSuggestionCandidate,
} from "@/lib/stock/product-name-suggestions"

type ProductNameInputWithSuggestionsProps = {
  value: string
  onChange: (value: string) => void
  /** Catálogo atual (ex.: produtos Convex) para sugerir nomes/fotos alinhados ao ML. */
  suggestionCandidates: ProductSuggestionCandidate[]
  /** Ao escolher uma sugestão: nome + opcionalmente foto/preço do item de origem. */
  onPickSuggestion?: (picked: ProductSuggestionCandidate) => void
  placeholder?: string
  id?: string
  className?: string
}

export function ProductNameInputWithSuggestions({
  value,
  onChange,
  suggestionCandidates,
  onPickSuggestion,
  placeholder,
  id,
  className,
}: ProductNameInputWithSuggestionsProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(
    () => getProductNameSuggestions(value, suggestionCandidates),
    [value, suggestionCandidates],
  )

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
          role="listbox"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPickSuggestion?.(s)
                  onChange(s.name)
                  setOpen(false)
                }}
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted">
                  {s.imageUrl ? (
                    <img
                      src={s.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="min-w-0 flex-1 line-clamp-2">{s.name}</span>
                {s.mlItemId ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">ML</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
