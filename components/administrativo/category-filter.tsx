"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ADMIN_DOCUMENT_CATEGORIES } from "@/lib/administrativo/documents"

export function CategoryFilter({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-full min-w-40 sm:w-48">
        <SelectValue placeholder="Categoria" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value="all">Todas categorias</SelectItem>
        {ADMIN_DOCUMENT_CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
