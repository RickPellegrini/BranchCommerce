import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { MobileAppShell } from "@/components/mobile/mobile-app-shell"
import { isAdminEmail } from "@/lib/auth/admin"

export const dynamic = "force-dynamic"

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/mobile")

  const user = await currentUser()
  const primaryEmail = user?.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  )?.emailAddress
  if (!isAdminEmail(primaryEmail)) redirect("/unauthorized")

  return <MobileAppShell>{children}</MobileAppShell>
}
