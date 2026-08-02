import type { ReisPlatform } from './types';

/**
 * Chrome-extension host. chrome.storage.local returns an object keyed by the
 * requested key, so a single-key read has to be unwrapped.
 */
export function createExtensionPlatform(): ReisPlatform {
  return {
    kind: 'extension',
    storage: {
      async get(key) {
        const out = await chrome.storage.local.get(key);
        return (out as Record<string, unknown>)[key];
      },
      async set(key, value) {
        await chrome.storage.local.set({ [key]: value });
      },
      async remove(key) {
        await chrome.storage.local.remove(key);
      },
    },
    getAssetUrl: (path) => chrome.runtime.getURL(path),
  };
}
