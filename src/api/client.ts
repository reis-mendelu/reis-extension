import { fetchViaProxy, isInIframe } from './proxyClient';
import { getPlatform } from '../platform';
import { fetchViaCapacitor } from './capacitorTransport';
import { buildCapacitorRequestOptions } from './capacitorRequest';
import { loadStoredToken } from '../platform/tokenStore';

export const BASE_URL = 'https://is.mendelu.cz';

export const DEFAULT_HEADERS: Record<string, string> = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7',
  'cache-control': 'max-age=0',
  'content-type': 'application/x-www-form-urlencoded',
  'sec-ch-ua': '"Microsoft Edge";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

/**
 * Fetch with authentication, automatically routes through proxy when in iframe.
 *
 * - Content Script context: Direct fetch with cookies
 * - Iframe context: Proxied through content script via postMessage
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = { ...DEFAULT_HEADERS, ...(options.headers as Record<string, string>) };

  // Capacitor: IS denies CORS to every origin, so a browser fetch from the
  // app's own origin cannot reach it. CapacitorHttp runs natively, where CORS
  // does not apply. Imported lazily so the extension bundle never pulls in
  // @capacitor/*.
  if (getPlatform().kind === 'capacitor') {
    const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
    const token = await loadStoredToken();
    return fetchViaCapacitor(
      url,
      token,
      {
        platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
        setCookie: (o) => CapacitorCookies.setCookie(o),
        httpGet: (o) => CapacitorHttp.get(o),
        httpPost: (o) => CapacitorHttp.post(o),
      },
      // Built by an exported pure function rather than inline, so the rules it
      // encodes are pinned by tests. This branch cannot be unit-tested directly
      // (it needs @capacitor/core mocked, which this repo does not do), so
      // inline the options and deleting `method`/`body` puts a POST back on the
      // wire as a bodyless GET with a fully green suite.
      buildCapacitorRequestOptions(options)
    );
  }

  // If we're in an iframe, use the proxy client
  if (isInIframe()) {
    const text = await fetchViaProxy(url, {
      method: options.method as string | undefined,
      headers,
      body: options.body as string | undefined,
    });

    // Create a Response-like object from the text
    return new Response(text, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'text/html' }),
    });
  }

  // Direct fetch in content script context
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
    mode: 'cors',
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.location.href = 'https://is.mendelu.cz/system/login.pl?lang=cz';
      throw new Error('Authentication required');
    }
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response;
}

/**
 * Fetch an authenticated IS resource as raw bytes.
 *
 * A sibling of fetchWithAuth rather than an option on it: fetchWithAuth imposes
 * DEFAULT_HEADERS (`accept: text/html…`, a form-urlencoded content-type), which
 * are wrong to send when asking for a `.p12` — and adding them would change what
 * the extension puts on the wire today. One function, two contracts.
 *
 * The `logout.pl` auth check is deliberately NOT applied here: binary cannot
 * carry that marker, so the check would report a fake expired session. Expiry is
 * detected the way fetchIsBinary detects it — 401/403, or HTML where a file was
 * expected.
 */
export async function fetchAuthedBytes(url: string): Promise<Uint8Array> {
  if (getPlatform().kind === 'capacitor') {
    const { fetchIsBinary, toBytes } = await import('./capacitorBinary');
    const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
    const token = await loadStoredToken();
    return toBytes(
      await fetchIsBinary(url, token, {
        platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
        setCookie: (o) => CapacitorCookies.setCookie(o),
        httpGet: (o) => CapacitorHttp.get(o),
      })
    );
  }

  // Extension / iframe / dev webapp: unchanged from what eduroam did before —
  // a direct credentialed fetch, no DEFAULT_HEADERS, no proxy hop.
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error('Expected file bytes, got HTML (session expired?)');
  }
  return new Uint8Array(await res.arrayBuffer());
}
