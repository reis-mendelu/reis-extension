import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  // Return a Promise instead of sendResponse+return true — fixes Firefox cross-context `.then` access denial.
  browser.runtime.onMessage.addListener((message): Promise<unknown> | undefined => {
    if (message.type !== 'REIS_BG_FETCH') return;

    const opts: RequestInit = {};
    if (message.options?.method) opts.method = message.options.method;
    if (message.options?.headers) opts.headers = message.options.headers;
    if (message.options?.body) opts.body = message.options.body;

    return fetch(message.url, opts)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => ({ success: true, data: text }))
      .catch((e) => ({ success: false, error: String(e) }));
  });
});
