/**
 * Handing fetched IS bytes to the browser, for the extension and the dev
 * webapp. Capacitor never gets here: its callers take the native branch first.
 */
import { downloadName, type FileRowHint } from '../../utils/contentDisposition';
import type { IsFile } from './fetchIsFile';

/**
 * What a new tab can show. Anything else — a .pptx, a .docx, a zip — would be
 * downloaded by the browser itself, under the blob URL's GUID, because a blob
 * URL has no name of its own. That is the bug this check exists to stop.
 */
export function opensInTab(blob: Blob): boolean {
  const type = blob.type.split(';')[0]?.trim().toLowerCase() ?? '';
  return type === 'application/pdf' || type.startsWith('image/') || type === 'text/plain';
}

/** Saves the file under IS's name, or the row's title when IS sent none. */
export function saveIsFile(file: IsFile, row?: FileRowHint): void {
  const { blob, contentDisposition } = file;
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = downloadName({ contentDisposition, contentType: blob.type || null }, row);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
