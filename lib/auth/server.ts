import { auth, currentUser } from "@clerk/nextjs/server"

import { isAdminEmail } from "@/lib/auth/admin"

export async function requireAuthenticatedAppUserId() {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Usuario nao autenticado.")
  }
  return userId
}

export async function getCurrentUserEmail() {
  const user = await currentUser()
  return (
    user?.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null
  )
}

export async function requireAdminAppUser() {
  const user = await currentUser()
  if (!user) {
    throw new Error("Usuario nao autenticado.")
  }

  const email =
    user.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null
  if (!isAdminEmail(email)) {
    throw new Error("Usuario sem acesso administrativo.")
  }

  return { userId: user.id, email }
}
