/**
 * An IS file as a Blob, for the extension and the dev webapp. Capacitor never
 * gets here: every caller takes its native branch first.
 *
 * Inside the extension iframe (chrome-extension://, cross-site to IS) a direct
 * fetch carries UISAuth only where the browser allows third-party cookies —
 * Brave by default, Chrome with the setting on and Firefox's Total Cookie
 * Protection all send it without one, and IS answers 403. So the bytes come
 * through the content script instead, base64 over postMessage.
 *
 * What that costs: base64 is 1.33× the file on the wire, and the file exists in
 * several copies at once across the two contexts (bytes, base64, JSON, the
 * decoded copy) — roughly 5–6× its size in transient memory. The hard ceiling is
 * the engine's maximum string length (V8: 2^29−24 characters, so a file of
 * ~400 MB); IS files are far below it. Progress still counts real bytes: the
 * content script sends a tick per chunk, and each tick re-arms the proxy
 * timeout, so a slow download is not cut off at 30 s.
 */
import { fetchViaProxy, isInIframe } from '../../api/proxyClient';
import { base64ToBytes } from '../../services/eduroam/base64';
import { readBlobWithProgress, type DownloadTick } from './readBlobWithProgress';
import type { FileFetchPayload } from '../../types/messages/base';

export interface IsFile {
  blob: Blob;
  contentDisposition: string | null;
}

/**
 * A viewer page (IS serves them under file anchors) or the login page of an
 * expired session: 200 HTML either way, and not the file. The native path
 * (capacitorBinary) and the eduroam proxy (readBytesBody) draw the same line.
 */
function assertNotPage(contentType: string | null): void {
  if (contentType?.toLowerCase().includes('text/html')) {
    throw new Error('Expected an IS file, got an HTML page');
  }
}

/**
 * Rejects on any failure — a non-ok status reads `HTTP <code>` either way, and
 * an HTML page rejects too, so every caller takes its fallback (open the URL
 * top-level, leave it out of the zip, no inline preview).
 */
export async function fetchIsFile(
  url: string,
  onTick?: (tick: DownloadTick) => void
): Promise<IsFile> {
  if (isInIframe()) {
    const raw = await fetchViaProxy(url, { responseType: 'file' }, onTick);
    const { contentType, contentDisposition, base64 } = JSON.parse(raw) as FileFetchPayload;
    assertNotPage(contentType);
    const blob = new Blob(
      [base64ToBytes(base64) as BlobPart],
      contentType ? { type: contentType } : undefined
    );
    return { blob, contentDisposition };
  }

  // The dev webapp: top-level on its own origin, nothing to proxy through.
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  assertNotPage(res.headers.get('content-type'));
  const blob = onTick ? await readBlobWithProgress(res, onTick) : await res.blob();
  return { blob, contentDisposition: res.headers.get('content-disposition') };
}
