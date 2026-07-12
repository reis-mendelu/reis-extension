import { Window } from 'happy-dom';

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
  g.fetch = createCookieFetch(cookieHeader, nativeFetch);
}
