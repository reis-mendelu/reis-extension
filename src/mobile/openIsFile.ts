import { registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import { loadStoredToken } from '../platform/tokenStore';
import { fetchIsBinary, blobToBase64 } from '../api/capacitorBinary';
import { toDirectDownloadUrl } from '../api/isDocumentUrl';
import { deliverFile, type DeliveryKind } from './deliverFile';

interface DownloadsPlugin {
  save(o: {
    filename: string;
    base64: string;
    mime: string;
  }): Promise<{ uri: string; bytes: number }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
}

/** Android-only native plugin: writes into Downloads and posts a notification.
 *  Capacitor's Filesystem cannot do this — its Directory enum has no Downloads. */
const Downloads = registerPlugin<DownloadsPlugin>('Downloads');

/**
 * Precedence for the saved filename. A caller-chosen name wins; an empty one is
 * treated as absent so a blank override can never produce a nameless file.
 */
export function chooseFilename(override: string | undefined, fromResponse: string): string {
  return override || fromResponse;
}

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
 *
 * `filenameOverride` exists for the study documents: `tisk_dokumentu.pl`
 * returns IS's own Content-Disposition name, but STUDY_DOCUMENTS defines what
 * the student should actually see (`Potvrzeni_o_studiu.pdf`). Subject files
 * pass nothing and keep the server's name.
 */
export async function openIsFileNatively(
  url: string,
  filenameOverride?: string,
  fallbackUrl?: string
): Promise<{ usedFallback: boolean; delivered: DeliveryKind }> {
  const token = await loadStoredToken();
  const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
  const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  const deps = {
    platform,
    setCookie: (o: { url: string; key: string; value: string }) => CapacitorCookies.setCookie(o),
    httpGet: (o: { url: string; headers?: Record<string, string>; responseType?: 'blob' }) =>
      CapacitorHttp.get(o),
  };

  const fetchOne = (target: string) =>
    fetchIsBinary(toDirectDownloadUrl(target) ?? target, token, deps);

  let result = await fetchOne(url);
  let usedFallback = false;

  // `kind: 'page'` means IS served an authenticated PAGE rather than a file —
  // exactly what its sealed print endpoints do while broken. Retry the unsealed
  // variant rather than failing. A lapsed session never reaches here:
  // fetchIsBinary throws sessionExpired for that, and re-auth is the right
  // answer there, not a second doomed request.
  if (result.kind !== 'binary' && fallbackUrl) {
    result = await fetchOne(fallbackUrl);
    usedFallback = true;
  }

  // Still not a file: failing loudly beats silently saving a web page as a .pdf.
  if (result.kind !== 'binary') {
    throw new Error(`IS did not return a file for ${url}`);
  }

  const base64 = await blobToBase64(result.blob);
  // The delivery kind is returned rather than discarded: it is what tells the
  // caller whether the student has already SEEN confirmation (iOS share sheet)
  // or needs to be told (Android, where the file lands silently in Downloads).
  const delivered = await deliverFile(
    chooseFilename(filenameOverride, result.filename),
    base64,
    result.blob.type || 'application/pdf',
    {
      platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
      saveToDownloads: async (o) => {
        // Asked for here, at the moment the student requested a file, and never
        // awaited: the notification is a convenience (tap to open), so a denied
        // or slow permission dialog must not delay or fail the save. The toast
        // in openNativeFile is what actually tells them it worked.
        void Downloads.requestNotificationPermission().catch(() => {});
        return Downloads.save(o);
      },
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
    }
  );

  return { usedFallback, delivered };
}
