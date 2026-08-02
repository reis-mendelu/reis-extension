import { getPlatform } from '../platform';
import { loadStoredToken } from '../platform/tokenStore';
import { fetchIsBinary } from '../api/capacitorBinary';
import { saveBlob } from './saveDocument';
import { buildSaveDeps } from './saveDeps';
import { buildRestoreHeaders, buildRestoreScript } from '../platform/sessionToken';

/** True when the app must NOT fall back to window.open for IS URLs. */
export function isNativeHost(): boolean {
  return getPlatform().kind === 'capacitor';
}

/**
 * Opens an IS document on Capacitor: fetch natively (CORS-exempt), write it to
 * disk, then hand it to the OS viewer via the share sheet.
 *
 * Why this exists: on Capacitor the previous path did a browser `fetch`, which
 * IS blocks by CORS, and then fell back to `window.open(url)` — which Capacitor
 * hands to the SYSTEM BROWSER. The student saw Chrome open instead of the file,
 * and Chrome has no IS session, so it could not have loaded it either.
 */
export async function openIsFileNatively(url: string): Promise<void> {
  const token = await loadStoredToken();
  const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');

  const result = await fetchIsBinary(url, token, {
    platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
    setCookie: (o) => CapacitorCookies.setCookie(o),
    httpGet: (o) => CapacitorHttp.get(o),
  });

  // Not every "file" link is a file. IS's dokumenty_cteni.pl is a document
  // VIEWER page; it must be shown, not downloaded. Present it in the in-app
  // browser with the session restored, so it renders authenticated in-app
  // rather than escaping to the system browser (which has no IS session).
  if (result.kind === 'page') {
    await openIsPageInApp(url, token);
    return;
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

/**
 * Opens an authenticated IS page inside the app. Uses the same proven hybrid
 * restore as login: the Cookie header authenticates request #1 (it leaves
 * before any script can run) and the documentStart script seeds the jar so
 * later navigations stay authenticated.
 */
async function openIsPageInApp(url: string, token: string): Promise<void> {
  const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
  await InAppBrowser.openWebView({
    url,
    title: 'IS MENDELU',
    headers: buildRestoreHeaders(token),
    isPresentAfterPageLoad: true,
    preShowScript: buildRestoreScript(token),
    preShowScriptInjectionTime: 'documentStart',
  });
}
