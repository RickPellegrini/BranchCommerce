"use client"

import { ConvexReactClient } from "convex/react"
import { ConvexProvider } from "convex/react"
import { useMemo } from "react"

/** URL só para compilar/prerender no GitHub Actions (sem chamadas reais ao Convex). */
const GITHUB_ACTIONS_BUILD_URL = "https://github-actions-build.convex.cloud"

function resolveConvexUrl(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_CONVEX_URL
  if (fromEnv) return fromEnv
  // Evitar usar CI genérico: a Vercel também define CI e poderíamos embutir URL errada no bundle.
  if (process.env.GITHUB_ACTIONS === "true") return GITHUB_ACTIONS_BUILD_URL
  return undefined
}

type Props = {
  children: React.ReactNode
}

export function ConvexClientProvider({ children }: Props) {
  const convexUrl = resolveConvexUrl()

  const client = useMemo(() => {
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.")
    }
    return new ConvexReactClient(convexUrl)
  }, [convexUrl])

  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
