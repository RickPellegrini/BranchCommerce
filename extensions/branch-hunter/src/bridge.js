/**
 * Bridge between the BranchCommerce web app and the extension's background
 * service worker. Injected ONLY on the web app domain.
 *
 * Content scripts run in Chrome's "isolated world" — they share the DOM but
 * NOT JavaScript globals with the page. All communication uses postMessage.
 *
 *   React page  ──postMessage──▶  bridge.js  ──chrome.runtime──▶  background.js
 *   React page  ◀──postMessage──  bridge.js  ◀──sendResponse───  background.js
 */
;(function () {
  "use strict"

  console.log("[BH-bridge] injected on", location.href)

  window.postMessage({ type: "BH_BRIDGE_READY" })

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (!event.data) return

    if (event.data.type === "BH_BRIDGE_PING") {
      window.postMessage({ type: "BH_BRIDGE_READY" })
      return
    }

    if (event.data.type !== "BH_SCRAPE_REQUEST") return

    const { requestId, itemIds, catalogProductId } = event.data

    if (!chrome?.runtime?.id) {
      console.warn("[BH-bridge] extension context lost, requesting page reload")
      window.postMessage({
        type: "BH_SCRAPE_RESPONSE",
        requestId,
        error: "Extension context invalidated – recarregue a pagina",
      })
      return
    }

    try {
      chrome.runtime.sendMessage(
        {
          type: "SCRAPE_COMPETITORS",
          payload: { itemIds, catalogProductId },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("[BH-bridge] sendMessage error:", chrome.runtime.lastError.message)
            window.postMessage({
              type: "BH_SCRAPE_RESPONSE",
              requestId,
              error: chrome.runtime.lastError.message,
            })
            return
          }
          window.postMessage({
            type: "BH_SCRAPE_RESPONSE",
            requestId,
            data: response,
          })
        },
      )
    } catch (err) {
      console.warn("[BH-bridge] runtime error:", err.message)
      window.postMessage({
        type: "BH_SCRAPE_RESPONSE",
        requestId,
        error: err.message || "Extension context invalidated",
      })
    }
  })
})()
