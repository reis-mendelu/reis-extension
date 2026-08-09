import { assertIsOrigin, buildCookieDelivery } from './capacitorTransport';

export interface PhotoDeps {
  platform: 'ios' | 'android' | 'web';
  setCookie(o: { url: string; key: string; value: string }): Promise<void>;
  httpGet(o: {
    url: string;
    headers?: Record<string, string>;
    responseType?: 'blob';
  }): Promise<{ status: number; data?: unknown; headers?: Record<string, string> }>;
}

/**
 * Fetches an IS person photo natively and returns a `data:` URL.
 *
 * Why this exists at all: `fetchPersonPhoto` routed every photo through
 * `fetchViaProxy`, which posts a `REIS_FETCH` to `window.parent`. In the
 * extension the content script answers that. The app has no content script and
 * `installMobileActionHandler` answers only `REIS_ACTION`, so on Capacitor the
 * message went to nobody, the promise sat until the 30 s `REQUEST_TIMEOUT` and
 * rejected, and every avatar in the app rendered its fallback icon forever.
 * Measured on device: zero `<img>` in the DOM and no reply to a REIS_FETCH
 * probe, while this native GET returns `200 image/jpeg`.
 *
 * Deliberately NOT built on `fetchIsBinary`, which looks like the same job: it
 * treats a non-image response as a lapsed session and calls
 * `notifySessionExpired`. A photo is decorative and its absence is routine, so
 * borrowing those semantics would boot a student back to login because someone
 * on their seminar roster has no picture. Failures here are silent by design —
 * the caller keeps its own fallback, exactly as on Firefox.
 */
export async function fetchIsPhotoDataUrl(
  url: string,
  token: string,
  deps: PhotoDeps
): Promise<string> {
  // The id comes from IS HTML, so the same guard `fetchIsBinary` carries: the
  // session must not follow a URL onto another host.
  assertIsOrigin(url);

  const delivery = buildCookieDelivery(deps.platform, token);
  if (delivery.seedNativeJar) {
    await deps.setCookie({ url: 'https://is.mendelu.cz', key: 'UISAuth', value: token });
  }

  const res = await deps.httpGet({ url, headers: delivery.headers, responseType: 'blob' });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }

  const headers = res.headers ?? {};
  const contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Not an image (${contentType})`);
  }

  const body = String(res.data ?? '');
  // MEASURED: an unknown or photoless person is `200 image/jpeg` with a body of
  // ZERO bytes — not a 404, not HTML. `data:image/jpeg;base64,` renders as a
  // broken-image glyph, which is strictly worse than the caller's fallback.
  if (!body) throw new Error('Photo body was empty');

  // CapacitorHttp hands a blob back as base64 on native; some platforms wrap it
  // in a full data: URI already (the nuance `base64ToBlob` also handles).
  return body.startsWith('data:') ? body : `data:${contentType};base64,${body}`;
}
