import { verifyToken } from "@clerk/backend"
import { clerkClient } from "@clerk/nextjs/server"

import { isAdminEmail } from "@/lib/auth/admin"

function getTokenSubject(data: unknown) {
  if (!data || typeof data !== "object" || !("sub" in data)) {
    return null
  }

  const subject = data.sub
  return typeof subject === "string" && subject.length > 0 ? subject : null
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin")
  const expectedOrigin = new URL(request.url).origin
  if (requestOrigin && requestOrigin !== expectedOrigin) {
    return Response.json({ error: "Origem nao autorizada." }, { status: 403 })
  }

  const authorization = request.headers.get("authorization")
  const nativeSessionToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null
  if (!nativeSessionToken) {
    return Response.json({ error: "Token nativo nao informado." }, { status: 401 })
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    return Response.json({ error: "Clerk nao configurado." }, { status: 500 })
  }

  let userId: string | null = null
  try {
    const verification = await verifyToken(nativeSessionToken, { secretKey })
    userId = getTokenSubject(verification)
  } catch {
    return Response.json({ error: "Token nativo invalido." }, { status: 401 })
  }

  if (!userId) {
    return Response.json({ error: "Token nativo invalido." }, { status: 401 })
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const primaryEmail = user.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  )?.emailAddress
  if (!isAdminEmail(primaryEmail)) {
    return Response.json({ error: "Usuario sem acesso ao aplicativo." }, { status: 403 })
  }

  const signInToken = await client.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 120,
  })

  return Response.json({ ticket: signInToken.token })
}
