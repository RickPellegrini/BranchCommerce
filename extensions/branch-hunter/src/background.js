chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "BRANCH_HUNTER_LISTING") return;

  chrome.storage.local.set(
    {
      "branchHunter:lastListing": {
        ...message.payload,
        capturedAt: Date.now(),
      },
    },
    () => {
      sendResponse({ ok: true });
    },
  );

  return true;
});
