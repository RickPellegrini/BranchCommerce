;(() => {
  const PAGE_SOURCE = "branchcommerce"
  const EXT_SOURCE = "branch-hunter-extension"

  window.postMessage(
    {
      source: EXT_SOURCE,
      type: "BRANCH_HUNTER_EXTENSION_READY",
    },
    window.location.origin,
  )

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    const message = event.data
    if (!message || message.source !== PAGE_SOURCE) return
    if (message.type !== "BRANCH_HUNTER_STOCK_SCAN") return

    chrome.runtime.sendMessage(
      {
        type: "BRANCH_HUNTER_STOCK_SCAN",
        requestId: message.requestId,
        items: Array.isArray(message.items) ? message.items : [],
      },
      (response) => {
        window.postMessage(
          {
            source: EXT_SOURCE,
            type: "BRANCH_HUNTER_STOCK_SCAN_RESULT",
            requestId: message.requestId,
            response: response || {
              ok: false,
              error: chrome.runtime.lastError?.message || "Extensao indisponivel.",
            },
          },
          window.location.origin,
        )
      },
    )
  })
})()
