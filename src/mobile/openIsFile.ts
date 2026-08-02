import { registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import { loadStoredToken } from '../platform/tokenStore';
import { fetchIsBinary, blobToBase64 } from '../api/capacitorBinary';
import { toDirectDownloadUrl } from '../api/isDocumentUrl';
import { deliverFile } from './deliverFile';

interface DownloadsPlugin {
  save(o: { filename: string; base64: string; mime: string }): Promise<{ uri: string; bytes: number }>;
}

/** Android-only native plugin: writes into Downloads and posts a notification.
 *  Capacitor's Filesystem cannot do this — its Directory enum has no Downloads. */
const Downloads = registerPlugin<DownloadsPlugin>('Downloads');

/** True when the app must NOT fall back to window.open for IS URLs. */
export function isNativeHost(): boolean {
  return getPlatform().kind === 'capacitor';
}

/**
 * Downloads an IS document on Capacitor.
 *
 * Three deliberate behaviours:
 *
 * 1. **It never opens the old IS UI.** IS serves each document both as a
 *    `dokumenty_cteni.pl` VIEWER page and as a direct file, and the parser
 *    collects both anchors — so a file link may be either. A viewer link is
 *    rewritten to its direct download rather than shown; putting the student
 *    back into IS defeats the point of reIS.
 * 2. **It never calls `window.open`.** Capacitor hands that to the SYSTEM
 *    BROWSER, which has no IS session.
 * 3. **On Android it lands in Downloads with a notification**, like any
 *    browser — not a share sheet. See deliverFile for the iOS asymmetry.
 */
export async function openIsFileNatively(url: string): Promise<void> {
  const downloadUrl = toDirectDownloadUrl(url) ?? url;
  const token = await loadStoredToken();
  const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');

  const result = await fetchIsBinary(downloadUrl, token, {
    platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
    setCookie: (o) => CapacitorCookies.setCookie(o),
    httpGet: (o) => CapacitorHttp.get(o),
  });

  // Still HTML after the rewrite means IS did not serve a file for this link.
  // Failing loudly beats silently saving a web page as a .pdf.
  if (result.kind !== 'binary') {
    throw new Error(`IS did not return a file for ${downloadUrl}`);
  }

  const base64 = await blobToBase64(result.blob);
  await deliverFile(result.filename, base64, result.blob.type || 'application/pdf', {
    platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
    saveToDownloads: (o) => Downloads.save(o),
    shareFile: async (o) => {
      // iOS has no Downloads folder: write to Documents, then offer the file to
      // the Files/share sheet, which is that platform's native save flow.
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path: o.filename,
        data: o.base64,
        directory: Directory.Documents,
        recursive: true,
      });
      const { uri } = await Filesystem.getUri({
        directory: Directory.Documents,
        path: o.filename,
      });
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: o.filename, url: uri });
    },
  });
}
