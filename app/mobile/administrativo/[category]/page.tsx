import { notFound } from "next/navigation"

import { AdministrativePage } from "@/components/administrativo/administrative-page"
import { MobileHero, MobilePage } from "@/components/mobile/mobile-ui"
import { adminDocumentSlugToCategory } from "@/lib/administrativo/documents"

export default async function MobileAdministrativeCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: slug } = await params
  const category = adminDocumentSlugToCategory(slug)
  if (!category) notFound()

  return (
    <MobilePage className="mobile-administrative">
      <MobileHero
        eyebrow="Pasta"
        title={category}
        description="Arquivos desta categoria, prontos para consultar ou compartilhar."
      />
      <AdministrativePage
        initialCategory={category}
        basePath="/mobile/administrativo"
        compactHeader
      />
    </MobilePage>
  )
}
