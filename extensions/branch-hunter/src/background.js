const STOCK_SCAN_TIMEOUT_MS = 25000
const STOCK_SCAN_SETTLE_MS = 2500
const STOCK_SCAN_CONCURRENCY = 3

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve(false)
    }, STOCK_SCAN_TIMEOUT_MS)

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return
      if (changeInfo.status !== "complete") return
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve(true)
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          status: "failed",
          error: chrome.runtime.lastError.message,
        })
        return
      }
      resolve(response)
    })
  })
}

async function scanStockItem(item) {
  const itemId = String(item?.itemId || "").trim()
  const url = String(item?.url || "").trim()
  if (!itemId || !url) {
    return {
      itemId,
      ok: false,
      status: "failed",
      error: "Item sem itemId ou URL.",
    }
  }

  let tabId = null
  try {
    const tab = await chrome.tabs.create({ url, active: false })
    tabId = tab.id
    if (!tabId) throw new Error("Aba de varredura nao foi criada.")

    await waitForTabComplete(tabId)
    await delay(STOCK_SCAN_SETTLE_MS)

    const response = await sendTabMessage(tabId, {
      type: "BRANCH_HUNTER_COLLECT_PUBLIC_STOCK",
      itemId,
    })

    return {
      itemId,
      url,
      finalUrl: response?.finalUrl || tab.url || url,
      ...response,
    }
  } catch (error) {
    return {
      itemId,
      url,
      ok: false,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (tabId) {
      chrome.tabs.remove(tabId, () => void chrome.runtime.lastError)
    }
  }
}

async function scanStockItems(items) {
  const sanitized = items.filter((item) => item && item.itemId && item.url).slice(0, 10)

  const results = new Array(sanitized.length)
  let cursor = 0

  async function worker() {
    while (cursor < sanitized.length) {
      const index = cursor
      cursor += 1
      results[index] = await scanStockItem(sanitized[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(STOCK_SCAN_CONCURRENCY, sanitized.length) }, () => worker()),
  )
  return results
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return

  if (message.type === "BRANCH_HUNTER_LISTING") {
    chrome.storage.local.set(
      {
        "branchHunter:lastListing": {
          ...message.payload,
          capturedAt: Date.now(),
        },
      },
      () => {
        sendResponse({ ok: true })
      },
    )
    return true
  }

  if (message.type === "BRANCH_HUNTER_STOCK_SCAN") {
    scanStockItems(Array.isArray(message.items) ? message.items : [])
      .then((results) => {
        sendResponse({
          ok: true,
          requestId: message.requestId,
          results,
        })
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          requestId: message.requestId,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    return true
  }
})
