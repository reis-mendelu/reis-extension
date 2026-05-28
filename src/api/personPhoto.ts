import { fetchViaProxy } from './proxyClient';
import { BASE_URL } from './client';
import { logError } from '../utils/reportError';

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

export function fetchPersonPhoto(personId: string | number): Promise<string> {
    const id = String(personId);
    const existing = cache.get(id);
    if (existing) return existing;

    const url = `${BASE_URL}/auth/lide/foto.pl?id=${id};lang=cz`;
    const promise = fetchViaProxy(url, { responseType: 'image' }).catch((e) => {
        cache.delete(id); // don't cache failures — let a later mount retry
        logError('Api.fetchPersonPhoto', e, { personId: id });
        throw e;
    });
    cache.set(id, promise);
    return promise;
}
