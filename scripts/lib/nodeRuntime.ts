import { Window } from 'happy-dom';
import { setPlatform } from '@/platform';
import { createWebPlatform } from '@/platform/webPlatform';

const IS_HOST = 'is.mendelu.cz';

/** Returns a fetch that injects the Cookie header for is.mendelu.cz requests. */
export function createCookieFetch(
  cookieHeader: string,
  baseFetch: typeof fetch = fetch
): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      host = '';
    }
    if (host !== IS_HOST) return baseFetch(input, init);
    const headers = new Headers(init.headers);
    headers.set('Cookie', cookieHeader);
    return baseFetch(input, { ...init, headers });
  }) as typeof fetch;
}

/** Install DOM + IndexedDB + cookie-fetch globals so src/api/* runs in Node.
 *  MUST run before importing any @/api/* module. */
export async function installNodeRuntime(cookieHeader: string): Promise<void> {
  await import('fake-indexeddb/auto');
  const nativeFetch = globalThis.fetch;
  const win = new Window({ url: 'https://is.mendelu.cz/' });
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.document = win.document;
  g.DOMParser = win.DOMParser;
  // The parsers narrow with `instanceof` — `Element`, `Text`, `Node`,
  // `HTMLAnchorElement`, `HTMLTableElement`, `HTMLElement` — and an absent
  // global is a ReferenceError, not a false test. `Api.fetchSyllabus: Node is
  // not defined` cost every syllabus in the snapshot while the scrape still
  // reported success. Taken off the same happy-dom window as `document`, so
  // nodes built by that DOM actually satisfy the checks.
  for (const name of [
    'Node',
    'Element',
    'HTMLElement',
    'HTMLAnchorElement',
    'HTMLTableElement',
    'Text',
    'NodeFilter',
  ] as const) {
    g[name] = (win as unknown as Record<string, unknown>)[name];
  }
  g.fetch = createCookieFetch(cookieHeader, nativeFetch);

  // Node is a FOURTH host, and `getPlatform()` throws for anything it cannot
  // auto-detect: it installs the extension host only when `chrome.runtime.id`
  // exists, and there is no `chrome` here. Without this every `fetchWithAuth`
  // threw "no platform installed" — which `collectRealData` catches per section
  // via allSettled, so the scrape "succeeded" and wrote an all-zero snapshot.
  //
  // The web host is the right one: `fetchWithAuth` consults the platform only to
  // special-case `kind === 'capacitor'`, so every other kind falls through to the
  // global `fetch` installed above — the cookie-injecting one. Its in-memory
  // storage also suits a process that should start from a known state.
  setPlatform(createWebPlatform());
}
