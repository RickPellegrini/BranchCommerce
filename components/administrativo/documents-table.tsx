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
    <>
      <div className="grid min-w-0 gap-3 md:hidden">
        {documents.map((document) => {
          const isPaymentProof = document.source === "payment_proof"

          return (
            <article
              key={document._id}
              className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{document.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{document.fileName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge className="max-w-full truncate" variant="secondary">
                      {document.category}
                    </Badge>
                    <span>{formatDocumentFileSize(document.fileSize)}</span>
                    <span>{formatDocumentDate(document.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 px-2"
                  onClick={() => onPreview(document)}
                >
                  <Eye className="size-4" /> Visualizar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 px-2"
                  onClick={() => onDownload(document)}
                >
                  <Download className="size-4" /> Baixar
                </Button>
                {!isPaymentProof && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-w-0 px-2"
                      onClick={() => onEdit(document)}
                    >
                      <Edit3 className="size-4" /> Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-w-0 px-2 text-destructive"
                      onClick={() => onArchive(document)}
                    >
                      <Archive className="size-4" /> Arquivar
                    </Button>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <div className="hidden md:block">
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
            {documents.map((document) => {
              const isPaymentProof = document.source === "payment_proof"

              return (
                <TableRow key={document._id}>
                  <TableCell className="max-w-[24rem] whitespace-normal">
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={document.title}>
                        {document.title}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={document.fileName}
                      >
                        {document.fileName}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{document.category}</Badge>
                    {isPaymentProof && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Financeiro</p>
                    )}
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
                      {!isPaymentProof && (
                        <>
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
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
