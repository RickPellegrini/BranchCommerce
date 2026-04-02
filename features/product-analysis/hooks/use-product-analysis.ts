"use client"

import { useState, useCallback, useEffect } from "react"
import type { FullAnalysis } from "@/features/product-analysis/domain/types"

export type AnalysisPhase = "idle" | "loading" | "success" | "partial" | "error"

export function useProductAnalysis(itemId: string | null) {
  const [phase, setPhase] = useState<AnalysisPhase>("idle")
  const [data, setData] = useState<FullAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async (id: string) => {
    setPhase("loading")
    setError(null)
    setData(null)
    try {
      const res = await fetch(`/api/ml/analysis/${id}?ts=${Date.now()}`, {
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        setPhase("error")
        return
      }
      const analysis = json.data as FullAnalysis
      if (analysis.competitors.competitors.length === 0 && analysis.catalog) {
        setData(analysis)
        setPhase("partial")
      } else {
        setData(analysis)
        setPhase("success")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase("error")
    }
  }, [])

  useEffect(() => {
    if (itemId) fetch_(itemId)
    else {
      setPhase("idle")
      setData(null)
      setError(null)
    }
  }, [itemId, fetch_])

  const refresh = useCallback(() => {
    if (itemId) fetch_(itemId)
  }, [itemId, fetch_])

  return { phase, data, error, refresh }
}
