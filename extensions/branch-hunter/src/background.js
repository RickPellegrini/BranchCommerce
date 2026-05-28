const STOCK_SCAN_TIMEOUT_MS = 15000
const STOCK_SCAN_POLL_MS = 350
const STOCK_SCAN_POLL_MAX_MS = 9000
const STOCK_SCAN_CONCURRENCY = 4

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

async function sendTabMessageWithRetry(tabId, message, attempts = 5, intervalMs = 250) {
  let lastResponse = {
    ok: false,
    status: "failed",
    error: "Content script indisponivel.",
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await sendTabMessage(tabId, message)
    lastResponse = response
    if (response?.ok || !isContentScriptUnavailable(response?.error)) {
      return response
    }
    await delay(intervalMs)
  }

  return lastResponse
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

    const message = {
      type: "BRANCH_HUNTER_COLLECT_PUBLIC_STOCK",
      itemId,
    }

    let response = {
      ok: false,
      status: "unavailable",
      error: "Estoque nao encontrado na pagina.",
    }
    const pollUntil = Date.now() + STOCK_SCAN_POLL_MAX_MS

    while (Date.now() < pollUntil) {
      response = await sendTabMessageWithRetry(tabId, message)
      if (response?.status === "blocked") break
      if (response?.ok && typeof response.stockMin === "number") break
      if (response?.ok && response.stockText && response.stockMin == null) {
        // Keep polling while ML still shows only "+N disponiveis".
        await delay(STOCK_SCAN_POLL_MS)
        continue
      }
      if (response?.ok) break
      await delay(STOCK_SCAN_POLL_MS)
    }

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
