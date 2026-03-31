import { randomUUID } from "crypto"

import { NextResponse } from "next/server"

import { requireAuthenticatedAppUserId } from "@/lib/auth/server"
import { buildMlAuthorizationUrl } from "@/lib/mercadolivre/oauth"

const STATE_COOKIE = "ml_oauth_state"

export async function GET(request: Request) {
  try {
    await requireAuthenticatedAppUserId()

    const state = randomUUID()
    const authorizationUrl = buildMlAuthorizationUrl(state)

    const response = NextResponse.redirect(authorizationUrl)
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    })
    return response
  } catch {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }
}
