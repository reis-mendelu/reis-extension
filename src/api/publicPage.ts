import { getPlatform } from '../platform';
import { fetchViaProxy } from './proxyClient';

/**
 * Fetch a PUBLIC page — no session, no cookies — from a third-party origin.
 *
 * This exists because the two hosts disagree about what "cannot reach a
 * cross-origin page" means:
 *
 *   Extension — the app runs in an iframe whose origin cannot read
 *               skm.mendelu.cz, so the CONTENT SCRIPT fetches it and posts the
 *               body back. That is `fetchViaProxy`.
 *   Capacitor — there IS no content script. `fetchViaProxy` posts REIS_FETCH to
 *               `window.parent`, which in a top-level WebView is the app
 *               itself, and nothing answers: the request sat for the full 30s
 *               REQUEST_TIMEOUT and then failed. `runMobileAction` covers
 *               REIS_ACTION on the app side; the fetch half was never built,
 *               because until the jídelníček every proxy fetch belonged to IS
 *               and IS goes through `fetchWithAuth`, which already has its own
 *               native branch.
 *
 * So the app fetches natively, exactly as `fetchWithAuth` does and for the same
 * reason: CapacitorHttp runs outside the WebView, where CORS does not apply.
 * Imported lazily so the extension bundle never pulls in @capacitor/*.
 *
 * This was invisible in every browser check. The dev webapp has no content
 * script either, so the harness seeds the menu into the store (dev/menuSeed.ts)
 * — which stubbed the very transport that was broken. The device was the only
 * place it could show, and it showed as the card silently not rendering.
 */
export interface PublicPageResponse {
  status: number;
  data?: unknown;
}

/** CapacitorHttp parses `data` by content-type, so an HTML page is USUALLY a
 *  string — but a mislabelled response yields an object, and `String(obj)` is
 *  "[object Object]", which the menu parser turns into an empty menu. An empty
 *  menu renders as no card at all, which looks exactly like a canteen that
 *  posted nothing. Fail loudly instead. */
export function readPublicPageBody(res: PublicPageResponse): string {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`publicPage: HTTP ${res.status}`);
  }
  if (typeof res.data !== 'string') {
    throw new Error(`publicPage: body is not text (${typeof res.data})`);
  }
  return res.data;
}

export interface PublicPageDeps {
  kind: string;
  httpGet(o: { url: string }): Promise<PublicPageResponse>;
  viaProxy(url: string): Promise<string>;
}

/** Injectable core, so the platform branch is testable without mocking
 *  @capacitor/core — which this repo deliberately does not do. */
export async function fetchPublicPage(url: string, deps: PublicPageDeps): Promise<string> {
  if (deps.kind === 'capacitor') return readPublicPageBody(await deps.httpGet({ url }));
  return deps.viaProxy(url);
}

/** What callers use. */
export async function fetchPublic(url: string): Promise<string> {
  const kind = getPlatform().kind;
  if (kind !== 'capacitor') return fetchViaProxy(url);
  const { CapacitorHttp } = await import('@capacitor/core');
  return fetchPublicPage(url, {
    kind,
    httpGet: (o) => CapacitorHttp.get(o),
    viaProxy: fetchViaProxy,
  });
}
