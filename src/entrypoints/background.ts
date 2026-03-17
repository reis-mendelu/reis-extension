import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'REIS_BG_FETCH') return false;

    fetch(message.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => sendResponse({ success: true, data: text }))
      .catch((e) => sendResponse({ success: false, error: String(e) }));

    return true; // keep channel open for async response
  });
});
