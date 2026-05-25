import { defineBackground } from 'wxt/utils/define-background';

const POKE_ALARM = 'reis-bg-poke';
const POKE_PERIOD_MINUTES = 15;

export default defineBackground(() => {
  // Use sendResponse+return true (not Promise-return) — WXT's browser polyfill does not
  // reliably relay async Promise returns to chrome.runtime.sendMessage callers in Chrome.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'REIS_BG_FETCH') return false;

    const opts: RequestInit = {};
    if (message.options?.method) opts.method = message.options.method;
    if (message.options?.headers) opts.headers = message.options.headers;
    if (message.options?.body) opts.body = message.options.body;

    fetch(message.url, opts)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => sendResponse({ success: true, data: text }))
      .catch((e) => sendResponse({ success: false, error: String(e) }));

    return true; // keep the message channel open for async sendResponse
  });

  // Google OAuth identity must run here: chrome.identity is NOT exposed to the
  // extension iframe embedded in is.mendelu.cz, but the SW has full access.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GOOGLE_IDENTITY_DIAG') {
      sendResponse({
        hasIdentity: !!chrome.identity,
        hasLaunch: !!chrome.identity?.launchWebAuthFlow,
      });
      return false;
    }

    if (message?.type === 'GOOGLE_GET_REDIRECT_URL') {
      try {
        sendResponse({ success: true, url: chrome.identity.getRedirectURL() });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      return false;
    }

    if (message?.type === 'GOOGLE_LAUNCH_WEB_AUTH_FLOW') {
      if (!chrome.identity?.launchWebAuthFlow) {
        sendResponse({ success: false, error: 'chrome.identity.launchWebAuthFlow is unavailable in this browser' });
        return false;
      }
      chrome.identity
        .launchWebAuthFlow({ url: message.url, interactive: true })
        .then((redirect) => sendResponse({ success: true, redirect }))
        .catch((e) => sendResponse({ success: false, error: String(e) }));
      return true; // async
    }

    return false;
  });

  // Register a periodic alarm to poke any open IS Mendelu tab to re-sync.
  // Cannot fetch IS Mendelu from the SW directly (no session cookies), so the
  // alarm only nudges a tab that already has them.
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(POKE_ALARM, { periodInMinutes: POKE_PERIOD_MINUTES });
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== POKE_ALARM) return;
    chrome.tabs.query({ url: '*://is.mendelu.cz/*' }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id === undefined) continue;
        chrome.tabs.sendMessage(tab.id, { type: 'REIS_BG_POKE' }).catch(() => {});
      }
    });
  });
});
