import { fetchViaProxy } from './proxyClient';
import { BASE_URL } from './client';
import { logError } from '../utils/reportError';
import { getPlatform } from '../platform';

/**
 * Person photos live behind /auth/lide/foto.pl and require the IS session
 * cookie. The iframe runs on a chrome-extension:// (moz-extension://) origin,
 * so a direct cross-origin <img src> only loads where the browser attaches IS
 * cookies to the subresource request. Chrome does; Firefox's Total Cookie
 * Protection withholds them, so photos silently fall back there.
 *
 * Route the fetch through the content script (first-party, authenticated) like
 * every other IS request and return a self-contained data: URL that renders on
 * any browser. Cached per person for the session — rosters are static.
 */
const cache = new Map<string, Promise<string>>();

export function __resetPersonPhotoCache(): void {
  cache.clear();
}

/**
 * The app has no content script, so nothing answers the `REIS_FETCH` the proxy
 * posts — it times out after 30 s and every avatar keeps its fallback. Fetch
 * natively instead, the same branch `fetchAuthedBytes` makes.
 */
async function fetchDataUrl(url: string): Promise<string> {
  if (getPlatform().kind === 'capacitor') {
    const { fetchIsPhotoDataUrl } = await import('./capacitorPhoto');
    const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
    const { loadStoredToken } = await import('../platform/tokenStore');
    return fetchIsPhotoDataUrl(url, await loadStoredToken(), {
      platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
      setCookie: (o) => CapacitorCookies.setCookie(o),
      httpGet: (o) => CapacitorHttp.get(o),
    });
  }
  return fetchViaProxy(url, { responseType: 'image' });
}

export function fetchPersonPhoto(personId: string | number): Promise<string> {
  const id = String(personId);
  const existing = cache.get(id);
  if (existing) return existing;

  const url = `${BASE_URL}/auth/lide/foto.pl?id=${id};lang=cz`;
  const promise = fetchDataUrl(url).catch((e) => {
    cache.delete(id); // don't cache failures — let a later mount retry
    logError('Api.fetchPersonPhoto', e, { personId: id });
    throw e;
  });
  cache.set(id, promise);
  return promise;
}
