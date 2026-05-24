import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { AdministrativePage } from "@/components/administrativo/administrative-page"
import { AppShell } from "@/components/layout/app-shell"
import { isAdminEmail } from "@/lib/auth/admin"

export default async function AdministrativoPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const user = await currentUser()
  const primaryEmail = user?.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  )?.emailAddress

  if (!isAdminEmail(primaryEmail)) {
    redirect("/unauthorized")
  }

  return (
    <AppShell title="Administrativo">
      <AdministrativePage />
    </AppShell>
  )
}
