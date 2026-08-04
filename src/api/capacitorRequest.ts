/**
 * Request/response shaping for the native Capacitor transport.
 *
 * Split out of capacitorTransport.ts, which is the transport itself and was at
 * the repo's 200-line ceiling. Everything here is pure and independently
 * testable; nothing here touches the network.
 */

/** The request shape fetchWithAuth forwards. `headers` are the CALLER's own —
 *  see buildCapacitorRequestOptions, which deliberately does not forward
 *  DEFAULT_HEADERS. `body` is the real RequestInit type, not narrowed to
 *  `string`: callers (e.g. schedule.ts) build POST bodies with
 *  `new URLSearchParams(...)`, and normalizeCapacitorBody is what turns that
 *  into wire-safe text. */
export interface CapacitorRequestOptions {
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}

/**
 * HTTP header names are case-insensitive, and the native layers disagree about
 * casing: iOS lowercases every header key (`lowerCaseHeaderDictionary` in
 * HttpRequestHandler.swift), while Android passes `connection.getHeaderFields()`
 * through as the server sent it — so which spelling shows up depends on IS's
 * own response, not just the platform. Reading one exact spelling meant a
 * differently-cased response looked like it had no content-type at all —
 * which the transport then treated as HTML.
 */
export function readHeader(
  headers: Record<string, string> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/**
 * CapacitorHttp.post JSON.stringify's a non-string `data` before it goes over
 * the native bridge. `URLSearchParams` has no enumerable own properties, so
 * that stringify silently produces `"{}"` — the schedule POST (calendar sync)
 * hit exactly this and sent an empty body while looking like it succeeded.
 *
 * `String(params)` is what actually reproduces the urlencoded form a browser
 * `fetch` would have sent. Anything else (FormData, Blob, a stream) has no
 * safe equivalent here, so it throws rather than shipping a silently wrong
 * request — the same failure mode this function exists to close off.
 */
export function normalizeCapacitorBody(body: BodyInit | null | undefined): string {
  if (body === null || body === undefined) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof URLSearchParams) {
    return String(body);
  }
  const kind = typeof body === 'object' && body !== null ? body.constructor?.name : typeof body;
  throw new Error(`reIS: unsupported Capacitor POST body type: ${kind}`);
}

/**
 * `HeadersInit` is a union, and only one of its three members survives an
 * object spread. Spreading a `Headers` instance yields `{}` — every caller
 * header silently dropped, which on this path means a POST losing its
 * Content-Type and IS refusing to parse the body. No caller passes `Headers`
 * today; this exists so that the day one does, it does not fail silently.
 *
 * The key casing a `Headers` iteration yields is implementation-dependent (the
 * spec lowercases). That is fine: every header lookup on this path goes through
 * readHeader, which is case-insensitive.
 */
export function normalizeHeadersInit(init: HeadersInit | undefined): Record<string, string> {
  if (!init) return {};
  if (init instanceof Headers) {
    const out: Record<string, string> = {};
    init.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(init)) {
    return Object.fromEntries(init);
  }
  return { ...init };
}

/**
 * Builds what fetchWithAuth hands the Capacitor transport.
 *
 * Extracted from client.ts so the load-bearing rules below are pinned by tests:
 * reverting them inside an untested `if` branch would put a POST back on the
 * wire as a bodyless GET with a green suite.
 *
 * The rule that matters most: `headers` comes from the caller's OWN
 * `options.headers`, never from client.ts's DEFAULT_HEADERS-merged local. The
 * app's sync makes ~236 GETs through this path, all device-verified with no
 * caller headers; merging DEFAULT_HEADERS in would change every one of them on
 * the wire for no benefit. `undefined` when the caller sent none, so the
 * transport's "a GET gains no headers at all" invariant stays observable.
 */
export function buildCapacitorRequestOptions(options: RequestInit): CapacitorRequestOptions {
  const headers = normalizeHeadersInit(options.headers);
  return {
    method: options.method,
    body: options.body,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };
}
