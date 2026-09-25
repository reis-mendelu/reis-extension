/**
 * The content-script half of `fetchIsFile` for the extension iframe: an IS
 * file (lecture PDF, zip entry) fetched first-party, so UISAuth rides along in
 * browsers that block third-party cookies, and handed back as a JSON-encoded
 * FileFetchPayload — the REIS_FETCH_RESULT reply carries a string.
 *
 * Unlike the generic proxy fetch, a 401/403 does NOT navigate the host page to
 * login. With first-party cookies a 403 on one file can be a real per-file
 * denial, and redirecting would tear down the iframe mid-zip; the iframe's
 * caller falls back to opening the URL top-level, where IS answers for itself.
 *
 * An HTML body is returned, not refused: IS serves viewer pages under the same
 * anchors as files, and the callers (fetchPdfBlob's %PDF check, openFile) are
 * the ones that know what to do with one.
 */
import { isIsMendeluUrl } from './isMendeluUrl';
import { readBlobWithProgress, type DownloadTick } from '../hooks/ui/readBlobWithProgress';
import type { FileFetchPayload } from '../types/messages/base';

/**
 * Base64 of a blob via FileReader, which encodes natively. A JS loop
 * concatenating four characters at a time (bytesToBase64) builds millions of
 * rope nodes on a tens-of-MB file.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchFileForIframe(
  url: string,
  onTick: (tick: DownloadTick) => void
): Promise<string> {
  if (!isIsMendeluUrl(url)) throw new Error('Refusing non-IS file URL');
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await readBlobWithProgress(res, onTick);
  const payload: FileFetchPayload = {
    contentType: res.headers.get('content-type'),
    contentDisposition: res.headers.get('content-disposition'),
    base64: await blobToBase64(blob),
  };
  return JSON.stringify(payload);
}
