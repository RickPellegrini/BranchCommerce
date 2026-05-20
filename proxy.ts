import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextFetchEvent, NextResponse, type NextRequest } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/ml/notifications(.*)",
  "/api/mp/notifications(.*)",
  "/api/mp/connect(.*)",
  "/api/mp/callback(.*)",
  "/api/mp/test-payment(.*)",
  "/mp-test-payment(.*)",
  "/api/branch-hunter/(.*)",
])

const protectedRoutesMiddleware = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  return protectedRoutesMiddleware(req, event)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
