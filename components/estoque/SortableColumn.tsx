"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

interface SortableColumnProps {
  id: string
  children: React.ReactNode
}

export function SortableColumn({ id, children }: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative shrink-0", isDragging && "z-10 opacity-70")}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-0.5 left-1/2 z-10 -translate-x-1/2 cursor-grab rounded-b-md bg-muted/80 px-2 py-0.5 opacity-0 transition-opacity hover:opacity-100 group-hover/col:opacity-100 active:cursor-grabbing"
        style={{ opacity: isDragging ? 1 : undefined }}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      {children}
    </div>
  )
}
