import { getPlatform } from '../platform';
import { loadStoredToken } from '../platform/tokenStore';
import { fetchIsBinary } from '../api/capacitorBinary';
import { toDirectDownloadUrl } from '../api/isDocumentUrl';
import { saveBlob } from './saveDocument';
import { buildSaveDeps } from './saveDeps';

/** True when the app must NOT fall back to window.open for IS URLs. */
export function isNativeHost(): boolean {
  return getPlatform().kind === 'capacitor';
}

/**
 * Downloads an IS document to the device on Capacitor, then offers it to the OS
 * so the student can open or keep it.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It never opens the old IS UI. IS serves each document both as a
 *    `dokumenty_cteni.pl` VIEWER page and as a direct file, and the parser
 *    collects both anchors — so a file link may be either. A viewer link is
 *    rewritten to its direct download (toDirectDownloadUrl) rather than shown.
 *    Putting the student back into IS defeats the point of reIS.
 * 2. It never calls `window.open`. Capacitor hands that to the SYSTEM BROWSER,
 *    which has no IS session — the bug that made a tap open Chrome.
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

  // saveBlob asserts the file actually landed — a zero-byte write is the silent
  // failure this whole path exists to avoid.
  await saveBlob(result.blob, result.filename, buildSaveDeps());

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { uri } = await Filesystem.getUri({
    directory: Directory.Documents,
    path: result.filename,
  });
  const { Share } = await import('@capacitor/share');
  await Share.share({ title: result.filename, url: uri });
}
