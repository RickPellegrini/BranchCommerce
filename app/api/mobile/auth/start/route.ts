import { auth } from "@clerk/nextjs/server"

export async function GET(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url)
    signInUrl.searchParams.set(
      "redirect_url",
      new URL("/api/mobile/auth/start", request.url).toString(),
    )
    return Response.redirect(signInUrl)
  }

  return Response.redirect(new URL("/mobile-auth/return", request.url))
}
