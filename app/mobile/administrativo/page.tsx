import { AdministrativePage } from "@/components/administrativo/administrative-page"
import { MobileHero, MobilePage } from "@/components/mobile/mobile-ui"

export default function MobileAdministrativePage() {
  return (
    <MobilePage className="mobile-administrative">
      <MobileHero
        eyebrow="Documentos"
        title="Sua empresa organizada e sempre à mão."
        description="Consulte, envie e compartilhe arquivos importantes pelo celular."
      />
      <AdministrativePage basePath="/mobile/administrativo" compactHeader />
    </MobilePage>
  )
}
