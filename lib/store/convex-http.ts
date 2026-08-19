import { ConvexHttpClient } from "convex/browser"

export function getStoreConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
  }
  return new ConvexHttpClient(convexUrl)
}
