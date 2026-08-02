import { ChromeAsyncStorage } from '../services/storage/ChromeAsyncStorage';
import type { ReisPlatform } from './types';

/**
 * Chrome-extension host.
 *
 * Storage delegates to ChromeAsyncStorage rather than touching chrome.storage
 * directly: that module already owns the unwrapping and error handling, and the
 * project lints against a second implementation of it.
 *
 * ChromeAsyncStorage returns `null` for a missing key; the platform interface
 * uses `undefined` so all three hosts answer alike.
 */
export function createExtensionPlatform(): ReisPlatform {
  return {
    kind: 'extension',
    storage: {
      async get(key) {
        return (await ChromeAsyncStorage.get(key)) ?? undefined;
      },
      async set(key, value) {
        await ChromeAsyncStorage.set(key, value);
      },
      async remove(key) {
        await ChromeAsyncStorage.remove(key);
      },
    },
    getAssetUrl: (path) => chrome.runtime.getURL(path),
  };
}
