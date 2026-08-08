import type { ReisPlatform } from './types';

/**
 * Dev-webapp host. In-memory only: the harness is meant to start from a known
 * state on every reload, and the iron rules forbid localStorage anyway.
 * Supersedes the storage half of dev/chromeShim.ts.
 */
export function createWebPlatform(): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind: 'web',
    storage: {
      async get(key) {
        return bag.get(key);
      },
      async set(key, value) {
        bag.set(key, value);
      },
      async remove(key) {
        bag.delete(key);
      },
    },
    // Same bag: the dev webapp has no secure store and needs none — it never
    // holds a real IS session.
    secureStorage: {
      async get(key) {
        return bag.get(key);
      },
      async set(key, value) {
        bag.set(key, value);
      },
      async remove(key) {
        bag.delete(key);
      },
    },
    getAssetUrl: (path) => '/' + path.replace(/^\//, ''),
  };
}
