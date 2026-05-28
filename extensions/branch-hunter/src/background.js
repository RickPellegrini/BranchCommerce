const STOCK_SCAN_TIMEOUT_MS = 15000
const STOCK_SCAN_CONCURRENCY = 5
const STOCK_POLL_INTERVAL_MS = 220
const STOCK_POLL_MAX_MS = 4500

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve(value)
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return
      if (tab?.status === "complete") {
        finish(true)
      }
    })

    const timeout = setTimeout(() => {
      finish(false)
    }, STOCK_SCAN_TIMEOUT_MS)

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return
      if (changeInfo.status !== "complete") return
      finish(true)
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

function isContentScriptUnavailable(error) {
  const text = String(error || "").toLowerCase()
  return (
    text.includes("could not establish connection") || text.includes("receiving end does not exist")
  )
}

function shouldStopStockPolling(response) {
  if (!response) return false
  if (response.ok) return true
  if (response.status === "blocked") return true
  if (response.status === "failed" && !isContentScriptUnavailable(response.error)) return true
  return false
}

async function collectStockFromTab(tabId, itemId) {
  const message = {
    type: "BRANCH_HUNTER_COLLECT_PUBLIC_STOCK",
    itemId,
  }
  const deadline = Date.now() + STOCK_POLL_MAX_MS
  let lastResponse = {
    ok: false,
    status: "unavailable",
    error: "Estoque nao encontrado na pagina.",
  }

  while (Date.now() < deadline) {
    const response = await sendTabMessage(tabId, message)
    lastResponse = response || lastResponse

    if (shouldStopStockPolling(response)) {
      return response
    }

    await delay(STOCK_POLL_INTERVAL_MS)
  }

  return lastResponse
}

function notifyStockScanPartial(callerTabId, requestId, result) {
  if (!callerTabId || !requestId || !result?.itemId) return
  chrome.tabs.sendMessage(
    callerTabId,
    {
      type: "BRANCH_HUNTER_STOCK_SCAN_PARTIAL",
      requestId,
      result,
    },
    () => void chrome.runtime.lastError,
  )
}

async function scanStockItem(item, requestId, callerTabId) {
  const itemId = String(item?.itemId || "").trim()
  const url = String(item?.url || "").trim()
  if (!itemId || !url) {
    const failed = {
      itemId,
      ok: false,
      status: "failed",
      error: "Item sem itemId ou URL.",
    }
    notifyStockScanPartial(callerTabId, requestId, failed)
    return failed
  }

  let tabId = null
  try {
    const tab = await chrome.tabs.create({ url, active: false })
    tabId = tab.id
    if (!tabId) throw new Error("Aba de varredura nao foi criada.")

    await waitForTabComplete(tabId)

    const response = await collectStockFromTab(tabId, itemId)
    const result = {
      itemId,
      url,
      finalUrl: response?.finalUrl || tab.url || url,
      ...response,
    }
    notifyStockScanPartial(callerTabId, requestId, result)
    return result
  } catch (error) {
    const failed = {
      itemId,
      url,
      ok: false,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
    notifyStockScanPartial(callerTabId, requestId, failed)
    return failed
  } finally {
    if (tabId) {
      chrome.tabs.remove(tabId, () => void chrome.runtime.lastError)
    }
  }
}

async function scanStockItems(items, requestId, callerTabId) {
  const sanitized = items.filter((item) => item && item.itemId && item.url).slice(0, 10)

  const results = new Array(sanitized.length)
  let cursor = 0

  async function worker() {
    while (cursor < sanitized.length) {
      const index = cursor
      cursor += 1
      results[index] = await scanStockItem(sanitized[index], requestId, callerTabId)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(STOCK_SCAN_CONCURRENCY, sanitized.length) }, () => worker()),
  )
  return results
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    const callerTabId = sender.tab?.id
    scanStockItems(
      Array.isArray(message.items) ? message.items : [],
      message.requestId,
      callerTabId,
    )
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
