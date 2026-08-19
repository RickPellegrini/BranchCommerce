import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacidade(.*)",
  "/excluir-conta(.*)",
  "/loja(.*)",
  "/mobile-auth(.*)",
  "/api/mobile/auth(.*)",
  "/.well-known/assetlinks.json",
  "/.well-known/apple-app-site-association",
  "/api/ml/notifications(.*)",
  "/api/mp/notifications(.*)",
  "/api/mp/connect(.*)",
  "/api/mp/callback(.*)",
  "/api/store/(.*)",
  "/api/branch-hunter/(.*)",
])

function getStoreHosts() {
  return (process.env.STORE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase()
  const isStoreHost = Boolean(host && getStoreHosts().includes(host))

  if (isStoreHost && !req.nextUrl.pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone()
    if (!url.pathname.startsWith("/loja")) {
      url.pathname = url.pathname === "/" ? "/loja" : `/loja${url.pathname}`
    }
    return NextResponse.rewrite(url)
  }

  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|apk|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
