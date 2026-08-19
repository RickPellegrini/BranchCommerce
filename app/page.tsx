import { redirect } from "next/navigation"

import { requireAdminAppUserOrRedirect } from "@/lib/auth/server"

export default async function Home() {
  await requireAdminAppUserOrRedirect()
  redirect("/dashboard")
}
