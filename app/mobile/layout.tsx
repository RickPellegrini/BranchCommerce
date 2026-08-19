import { MobileAppShell } from "@/components/mobile/mobile-app-shell"
import { requireAdminAppUserOrRedirect } from "@/lib/auth/server"

export const dynamic = "force-dynamic"

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAppUserOrRedirect("/sign-in?redirect_url=/mobile")
  return <MobileAppShell>{children}</MobileAppShell>
}
