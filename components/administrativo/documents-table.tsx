"use client"

import { Archive, Download, Edit3, Eye, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDocumentDate, formatDocumentFileSize } from "@/lib/administrativo/documents"
import type { AdministrativeDocument } from "./types"

export function DocumentsTable({
  documents,
  loading,
  onPreview,
  onDownload,
  onEdit,
  onArchive,
}: {
  documents: AdministrativeDocument[]
  loading: boolean
  onPreview: (document: AdministrativeDocument) => void
  onDownload: (document: AdministrativeDocument) => void
  onEdit: (document: AdministrativeDocument) => void
  onArchive: (document: AdministrativeDocument) => void
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse border bg-muted/30" />
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 border border-dashed bg-muted/20 px-4 text-center">
        <FileText className="size-10 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Nenhum documento encontrado.</p>
          <p className="text-xs text-muted-foreground">
            Envie o primeiro contrato, CCMEI, certificado ou política interna.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Tamanho</TableHead>
          <TableHead>Upload</TableHead>
          <TableHead className="w-[12rem] text-right">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document._id}>
            <TableCell className="max-w-[24rem] whitespace-normal">
              <div className="min-w-0">
                <p className="truncate font-medium" title={document.title}>
                  {document.title}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={document.fileName}>
                  {document.fileName}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{document.category}</Badge>
            </TableCell>
            <TableCell className="max-w-[10rem] truncate text-muted-foreground">
              {document.fileType || "Arquivo"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatDocumentFileSize(document.fileSize)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDocumentDate(document.createdAt)}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Visualizar"
                  onClick={() => onPreview(document)}
                >
                  <Eye className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Baixar"
                  onClick={() => onDownload(document)}
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Editar metadata"
                  onClick={() => onEdit(document)}
                >
                  <Edit3 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Arquivar"
                  onClick={() => onArchive(document)}
                >
                  <Archive className="size-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
