import { assertIsOrigin, buildCookieDelivery } from './capacitorTransport';

export interface BinaryDeps {
  platform: 'ios' | 'android' | 'web';
  setCookie(o: { url: string; key: string; value: string }): Promise<void>;
  httpGet(o: {
    url: string;
    headers?: Record<string, string>;
    responseType?: 'blob';
  }): Promise<{ status: number; data?: unknown; headers?: Record<string, string> }>;
}

/**
 * CapacitorHttp returns a `blob` response as base64 on native. Converting it
 * here (rather than trusting a string round-trip) is the whole point: a 1.6 MB
 * PDF does NOT survive being handled as text.
 */
export function base64ToBlob(base64: string, type: string): Blob {
  // Some platforms hand back a full data: URI rather than bare base64.
  const comma = base64.indexOf(',');
  const raw = base64.startsWith('data:') && comma !== -1 ? base64.slice(comma + 1) : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * IS serves documents from query-string URLs (`slozka.pl?download=354316`), so
 * the URL has no usable basename — the Content-Disposition filename is the only
 * real source, and a generic fallback beats naming a file "slozka.pl".
 */
export function filenameFromResponse(headers: Record<string, string>): string {
  const cd = headers['Content-Disposition'] ?? headers['content-disposition'] ?? '';
  const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1]?.trim() || 'dokument.pdf';
}

function sessionExpired(message: string): Error {
  const err = new Error(message) as Error & { sessionExpired?: boolean };
  err.sessionExpired = true;
  return err;
}

/**
 * Fetches an IS document natively. Needed because IS denies CORS to every
 * origin, so a browser fetch from the app's own origin cannot reach it — the
 * failure that made file links fall through to `window.open` and open the
 * system browser.
 */
export type IsResourceResult =
  | { kind: 'binary'; blob: Blob; filename: string }
  /** An authenticated IS *page* (e.g. dokumenty_cteni.pl), not a file. The
   *  caller should present it in the in-app browser, NOT save it. */
  | { kind: 'page' };

export async function fetchIsBinary(
  url: string,
  token: string,
  deps: BinaryDeps
): Promise<IsResourceResult> {
  // File links are parsed out of IS HTML, so this is the call that most needs
  // the guard: an IS page can link to any host, and the session must not follow.
  assertIsOrigin(url);
  const delivery = buildCookieDelivery(deps.platform, token);
  if (delivery.seedNativeJar) {
    await deps.setCookie({ url: 'https://is.mendelu.cz', key: 'UISAuth', value: token });
  }

  const res = await deps.httpGet({
    url,
    headers: delivery.headers,
    responseType: 'blob',
  });

  if (res.status === 401 || res.status === 403) {
    throw sessionExpired(`HTTP ${res.status}`);
  }
  // Anything else non-2xx is IS being broken, not the student being logged out
  // — the same separation fetchViaCapacitor makes. It has to happen BEFORE the
  // content-type branch below: Android returns an error body as a raw string
  // whatever responseType asked for, so a 503 HTML maintenance page would
  // otherwise reach atob(), throw on markup that was never base64, and get
  // swallowed into a fake expired session.
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }

  const headers = res.headers ?? {};
  const contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
  const body = String(res.data ?? '');

  // HTML is ambiguous and the two cases must not be conflated:
  //   - a LOGIN page  -> the session lapsed; saving it as a .pdf is the silent
  //     corruption this guard exists to prevent
  //   - a real IS page (dokumenty_cteni.pl is a document *viewer*) -> perfectly
  //     valid, just not a file. It must be shown, not downloaded.
  // `logout.pl` is the same authentication signal the HTML transport uses.
  if (contentType.includes('text/html')) {
    if (isAuthenticatedBase64Html(body)) return { kind: 'page' };
    throw sessionExpired(`Expected a document, got ${contentType}`);
  }

  const blob = base64ToBlob(body, contentType || 'application/octet-stream');
  return { kind: 'binary', blob, filename: filenameFromResponse(headers) };
}

/** The body arrives base64-encoded, so decode before looking for the marker. */
function isAuthenticatedBase64Html(body: string): boolean {
  try {
    return /logout\.pl/.test(base64ToText(body));
  } catch {
    return false;
  }
}

export function base64ToText(base64: string): string {
  const comma = base64.indexOf(',');
  const raw = base64.startsWith('data:') && comma !== -1 ? base64.slice(comma + 1) : base64;
  return atob(raw);
}

/** Filesystem.writeFile and the Downloads plugin both take base64, not a Blob. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the "data:<mime>;base64," prefix that readAsDataURL adds.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Narrows an IsResourceResult to raw bytes.
 *
 * The `page` case is the one that matters: `fetchIsBinary` returns it for an
 * authenticated HTML response, which for a certificate request means IS did not
 * serve the file. Writing those bytes would produce a `.p12` that is really a
 * web page — a corruption that only surfaces when the student tries to install
 * it, long after the download "succeeded".
 *
 * It is deliberately NOT tagged sessionExpired. `fetchIsBinary` returns
 * `kind: 'page'` only when the HTML CONTAINED `logout.pl` — positive proof the
 * session is alive. That flag means "the session lapsed, send the student back
 * through login" (the reading `src/injector/messageHandler.ts:202` acts on), so
 * setting it here would assert the opposite of what was just measured. IS
 * served the wrong thing; the session is fine.
 */
export async function toBytes(result: IsResourceResult): Promise<Uint8Array> {
  if (result.kind !== 'binary') {
    throw new Error('Expected file bytes, but IS served an authenticated page instead');
  }
  return new Uint8Array(await result.blob.arrayBuffer());
}
