import { MobileAuthCallback } from "@/components/mobile/mobile-auth-callback"

type MobileAuthCallbackPageProps = {
  searchParams: Promise<{ ticket?: string | string[] }>
}

export default async function MobileAuthCallbackPage({
  searchParams,
}: MobileAuthCallbackPageProps) {
  const params = await searchParams
  const ticket = typeof params.ticket === "string" ? params.ticket : null

  return <MobileAuthCallback ticket={ticket} />
}
