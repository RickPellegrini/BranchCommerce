import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { isAdminEmail } from "@/lib/auth/admin"

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>

export function getPrimaryEmailFromUser(user: ClerkUser | null) {
  return (
    user?.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null
  )
}

export async function requireAuthenticatedAppUserId() {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Usuario nao autenticado.")
  }
  return userId
}

export async function getCurrentUserEmail() {
  const user = await currentUser()
  return getPrimaryEmailFromUser(user)
}

export async function requireAdminAppUser() {
  const user = await currentUser()
  if (!user) {
    throw new Error("Usuario nao autenticado.")
  }

  const email = getPrimaryEmailFromUser(user)
  if (!isAdminEmail(email)) {
    throw new Error("Usuario sem acesso administrativo.")
  }

  return { userId: user.id, email }
}

export async function requireAdminAppUserOrRedirect(signInUrl = "/sign-in") {
  const { userId } = await auth()
  if (!userId) {
    redirect(signInUrl)
  }

  const user = await currentUser()
  const email = getPrimaryEmailFromUser(user)
  if (!user || !isAdminEmail(email)) {
    redirect(signInUrl)
  }

  return { userId, email }
}
