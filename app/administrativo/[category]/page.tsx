import { notFound } from "next/navigation"

import { AuthenticatedModulePage } from "@/components/layout/authenticated-module-page"
import { adminDocumentSlugToCategory } from "@/lib/administrativo/documents"

export default async function AdministrativoCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: slug } = await params
  const category = adminDocumentSlugToCategory(slug)
  if (!category) notFound()

  return <AuthenticatedModulePage module="administrative" administrativeCategory={category} />
}
