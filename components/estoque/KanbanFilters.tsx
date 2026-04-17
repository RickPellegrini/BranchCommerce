"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UrgencyLevel } from "./types"

interface KanbanFiltersProps {
  search: string
  onSearch: (value: string) => void
  urgency: "all" | UrgencyLevel
  onUrgency: (value: "all" | UrgencyLevel) => void
  category: string
  onCategory: (value: string) => void
  categories: string[]
}

export function KanbanFilters({
  search,
  onSearch,
  urgency,
  onUrgency,
  category,
  onCategory,
  categories,
}: KanbanFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou SKU..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={urgency} onValueChange={(v) => onUrgency(v as "all" | UrgencyLevel)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Urgência" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas urgências</SelectItem>
          <SelectItem value="critical">🔴 Crítico</SelectItem>
          <SelectItem value="low">🟡 Baixo</SelectItem>
          <SelectItem value="ok">🟢 OK</SelectItem>
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={onCategory}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas categorias</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
