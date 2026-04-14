"use client"

import { useState, useCallback, useEffect, useRef } from "react"

export type ScrapedItemData = {
  itemId: string
  availableQuantity: number | null
  stockIsMinimum: boolean
  soldLabel: string | null
  soldQuantity: number | null
  startTime: string | null
}

export type ScrapeResult = {
  stockData: Record<string, ScrapedItemData>
  buyBoxWinner: string | null
}

function hasBridge(): boolean {
  if (typeof window === "undefined") return false
  return !!(window as unknown as Record<string, unknown>).__BH_BRIDGE__
}

function requestViaBridge(
  itemIds: string[],
  catalogProductId: string | null,
  timeoutMs: number,
): Promise<ScrapeResult> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error("Extension scraping timeout"))
    }, timeoutMs)

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return
      if (!event.data || event.data.type !== "BH_SCRAPE_RESPONSE") return
      if (event.data.requestId !== requestId) return
      cleanup()
      if (event.data.error) {
        reject(new Error(event.data.error))
      } else {
        resolve(event.data.data as ScrapeResult)
      }
    }

    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener("message", onMessage)
    }

    window.addEventListener("message", onMessage)
    window.postMessage({
      type: "BH_SCRAPE_REQUEST",
      requestId,
      itemIds,
      catalogProductId,
    })
  })
}

export function useExtensionScraping() {
  const [scraping, setScraping] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [extensionAvailable, setExtensionAvailable] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let attempts = 0
    const maxAttempts = 10

    const check = () => {
      if (!mountedRef.current) return
      if (hasBridge()) {
        console.log("[extension-scraping] bridge detected")
        setExtensionAvailable(true)
        return
      }
      attempts++
      if (attempts < maxAttempts) {
        setTimeout(check, 500)
      }
    }
    check()

    return () => {
      mountedRef.current = false
    }
  }, [])

  const scrape = useCallback(
    async (itemIds: string[], catalogProductId: string | null) => {
      if (!hasBridge() || itemIds.length === 0) return
      console.log(`[extension-scraping] scraping ${itemIds.length} items, catalog=${catalogProductId}`)
      setScraping(true)
      setResult(null)
      try {
        const data = await requestViaBridge(itemIds, catalogProductId, 45_000)
        console.log("[extension-scraping] result:", data)
        if (mountedRef.current) setResult(data)
      } catch (err) {
        console.warn("[extension-scraping]", err)
      } finally {
        if (mountedRef.current) setScraping(false)
      }
    },
    [],
  )

  return { extensionAvailable, scraping, result, scrape }
}
