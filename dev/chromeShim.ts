/**
 * Dev-only `chrome.*` shim so the reIS React app can run as a plain Vite webapp
 * (no extension, no iframe). In-memory, promise-style — mirrors the subset of the
 * Chrome extension APIs the app touches at mount: storage (settings) + runtime.getURL
 * (asset paths). Everything else is a safe no-op. NOT bundled into the extension.
 */
type Bag = Record<string, unknown>;

function area(store: Bag) {
  return {
    async get(keys?: string | string[] | Bag | null) {
      if (keys == null) return { ...store };
      if (typeof keys === 'string') return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        const out: Bag = {};
        keys.forEach((k) => (out[k] = store[k]));
        return out;
      }
      // object of defaults: override with stored values where present
      const out: Bag = { ...keys };
      Object.keys(keys).forEach((k) => {
        if (store[k] !== undefined) out[k] = store[k];
      });
      return out;
    },
    async set(obj: Bag) {
      Object.assign(store, obj);
    },
    async remove(keys: string | string[]) {
      (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
    },
    async clear() {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
}

// Real Chrome exposes a partial `window.chrome` (chrome.csi/loadTimes) WITHOUT
// chrome.storage, so we can't gate on `chrome === undefined` — we merge our
// stubs into whatever is already there, only filling the pieces that are missing.
{
  const g = globalThis as { chrome?: Record<string, unknown> };
  const chrome = (g.chrome ??= {});
  const local: Bag = {};
  const sync: Bag = {};

  if (!(chrome.storage as { local?: unknown } | undefined)?.local) {
    chrome.storage = {
      local: area(local),
      sync: area(sync),
      onChanged: { addListener() {}, removeListener() {} },
    };
  }

  if (!(chrome.runtime as { getURL?: unknown } | undefined)?.getURL) {
    chrome.runtime = {
      ...(chrome.runtime as Record<string, unknown> | undefined),
      id: 'reis-dev-webapp',
      getURL: (p: string) => '/' + String(p).replace(/^\//, ''),
      getManifest: () => ({ version: 'dev' }),
      sendMessage: async () => undefined,
      onMessage: { addListener() {}, removeListener() {} },
    };
  }

  if (!chrome.identity) {
    chrome.identity = {
      launchWebAuthFlow: () => {
        throw new Error('chrome.identity is unavailable in the webapp dev harness');
      },
    };
  }
}
