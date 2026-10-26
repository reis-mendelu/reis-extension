/**
 * The bulk "download the selected files as a zip" path, lifted out of
 * useFileActions so that hook stays inside the 200-line convention.
 *
 * Progress here is counted in FILES, not bytes — N parallel downloads share one
 * bar, so a byte total would be the sum of sizes nobody knows until each
 * response lands. `completed/total` is the honest unit, and it is the same unit
 * on every platform.
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { normalizeFileUrl } from '../../utils/fileUrl';
import { createLogger } from '../../utils/logger';
import { requestQueue } from '../../utils/requestQueue';
import { assertNotDemo } from './assertNotDemo';
import { fetchIsFile, type IsFile } from './fetchIsFile';
import { downloadName } from '../../utils/contentDisposition';

const log = createLogger('downloadZipFiles');

/**
 * IS's name for the file, made safe for a zip entry. The fallback is numbered,
 * not the link's tail: IS links are `slozka.pl?download=…`, and the zip path
 * has no row titles to fall back on.
 */
function safeEntryName(file: IsFile, index: number): string {
  const name = downloadName(
    { contentDisposition: file.contentDisposition, contentType: file.blob.type || null },
    undefined,
    `soubor-${index + 1}`
  );
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * `onFileSettled` fires once per link whether it succeeded or failed — the bar
 * must reach its total even when IS drops half the files, or it stalls at 3/5
 * forever with nothing to say why.
 */
export async function downloadZipFiles(
  fileLinks: string[],
  zipFileName: string,
  onFileSettled: () => void
): Promise<void> {
  const zip = new JSZip();

  const downloads = fileLinks.map((link, index) =>
    requestQueue.add(async () => {
      try {
        const fullUrl = normalizeFileUrl(link);
        assertNotDemo();

        // One retry, on an IS 5xx only. Through the proxy the status arrives
        // as text, so it is read from the message on both paths.
        const file = await fetchIsFile(fullUrl).catch((e: unknown) => {
          if (/HTTP 5\d\d/.test(String(e))) return fetchIsFile(fullUrl);
          throw e;
        });
        zip.file(safeEntryName(file, index), file.blob);
      } catch (e) {
        log.error(`Failed to add file ${link} to zip`, e);
      } finally {
        onFileSettled();
      }
    })
  );

  await Promise.all(downloads);

  if (Object.keys(zip.files).length === 0) return;
  saveAs(await zip.generateAsync({ type: 'blob' }), zipFileName);
}
