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

const log = createLogger('downloadZipFiles');

/** Strips the characters a zip entry name cannot carry across platforms. */
function safeEntryName(contentDisposition: string | null, link: string): string {
  let filename = 'file';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) filename = match[1];
  }
  if (filename === 'file') {
    filename = link.split('/').pop() || `file_${Math.random().toString(36).substr(2, 9)}`;
  }
  return filename.replace(/[\\/:*?"<>|]/g, '_');
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

  const downloads = fileLinks.map((link) =>
    requestQueue.add(async () => {
      try {
        const fullUrl = normalizeFileUrl(link);
        assertNotDemo();

        // Basic retry logic (1 retry)
        let response = await fetch(fullUrl, { credentials: 'include' });
        if (!response.ok && response.status >= 500) {
          response = await fetch(fullUrl, { credentials: 'include' });
        }
        if (!response.ok) return;

        const blob = await response.blob();
        zip.file(safeEntryName(response.headers.get('content-disposition'), link), blob);
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
