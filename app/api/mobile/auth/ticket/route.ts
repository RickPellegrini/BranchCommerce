import { auth, clerkClient } from "@clerk/nextjs/server"

const ANDROID_PACKAGE = "com.branchcommercehub.app"

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin")
  const expectedOrigin = new URL(request.url).origin
  if (requestOrigin && requestOrigin !== expectedOrigin) {
    return Response.json({ error: "Origem nao autorizada." }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: "Usuario nao autenticado." }, { status: 401 })
  }

  const client = await clerkClient()
  const signInToken = await client.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 120,
  })
  const encodedTicket = encodeURIComponent(signInToken.token)

  return Response.json({
    intentUrl: `intent://mobile-auth/callback?ticket=${encodedTicket}#Intent;scheme=branchcommerce;package=${ANDROID_PACKAGE};end`,
  })
}
