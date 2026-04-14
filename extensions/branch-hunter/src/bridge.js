/**
 * Bridge between the BranchCommerce web app and the extension's background
 * service worker. Injected ONLY on the web app domain (branchcommercehub.com
 * and localhost:3000).
 *
 * Communication flow:
 *   React page  ──postMessage──▶  bridge.js  ──chrome.runtime──▶  background.js
 *   React page  ◀──postMessage──  bridge.js  ◀──sendResponse───  background.js
 */
;(function () {
  "use strict"

  window.__BH_BRIDGE__ = true

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.type !== "BH_SCRAPE_REQUEST") return

    const { requestId, itemIds, catalogProductId } = event.data

    if (!chrome?.runtime?.id) {
      window.postMessage({
        type: "BH_SCRAPE_RESPONSE",
        requestId,
        error: "Extension context invalidated",
      })
      return
    }

    chrome.runtime.sendMessage(
      {
        type: "SCRAPE_COMPETITORS",
        payload: { itemIds, catalogProductId },
      },
      (response) => {
        if (chrome.runtime.lastError) {
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
  })
})()
