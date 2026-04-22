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

/** Background scrapes em lotes (delay 1.5s entre lotes); 15s estoura com muitos anuncios. */
function extensionScrapeTimeoutMs(itemCount: number): number {
  if (itemCount <= 0) return 15_000
  return Math.min(180_000, 18_000 + itemCount * 5_500)
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

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return
      if (event.data?.type === "BH_BRIDGE_READY") {
        console.log("[extension-scraping] bridge detected via postMessage")
        setExtensionAvailable(true)
      }
    }

    window.addEventListener("message", onMessage)

    // Ping the bridge in case it loaded before this listener was set up
    window.postMessage({ type: "BH_BRIDGE_PING" })

    return () => {
      mountedRef.current = false
      window.removeEventListener("message", onMessage)
    }
  }, [])

  const scrape = useCallback(async (itemIds: string[], catalogProductId: string | null) => {
    if (itemIds.length === 0) return
    console.log(
      `[extension-scraping] scraping ${itemIds.length} items, catalog=${catalogProductId}`,
    )
    setScraping(true)
    setResult(null)
    try {
      const data = await requestViaBridge(
        itemIds,
        catalogProductId,
        extensionScrapeTimeoutMs(itemIds.length),
      )
      console.log("[extension-scraping] result:", data)
      if (mountedRef.current) setResult(data)
    } catch (err) {
      console.warn("[extension-scraping]", err)
    } finally {
      if (mountedRef.current) setScraping(false)
    }
  }, [])

  return { extensionAvailable, scraping, result, scrape }
}
