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
})
