/**
 * Downloads an IS document as a real file. MUST run in the content script
 * (first-party on is.mendelu.cz), which holds the SameSite session cookie —
 * a cross-site fetch from the iframe app would get a login page instead.
 * Resolves only once the blob is saved, giving the UI a true completion signal.
 */
import { isIsMendeluUrl } from './isMendeluUrl';
import { saveBlob } from '../mobile/saveDocument';
import { buildSaveDeps } from '../mobile/saveDeps';

export interface DocumentDownloadResult {
  /** True when the sealed document failed and the unsealed one was saved
   *  instead. The UI MUST surface this — an unsealed copy can be refused by
   *  the office the student takes it to, and a silent downgrade is the one way
   *  this fallback can do harm. */
  usedFallback: boolean;
}

/**
 * Tries `url` first and falls back to `fallbackUrl` only when IS answers with a
 * page instead of a file. Sealed documents are preferred — the seal is why
 * offices accept them — but an unsealed document beats no document, which is
 * the state IS's sealing outage would otherwise leave students in.
 *
 * The fallback deliberately does NOT fire on a lapsed session: there the right
 * answer is to re-authenticate, and a second request would fail identically.
 */
export async function downloadDocumentInPage(
  url: string,
  filename: string,
  fallbackUrl?: string
): Promise<DocumentDownloadResult> {
  try {
    await fetchAndSave(url, filename);
    return { usedFallback: false };
  } catch (e) {
    const notADocument = (e as { notADocument?: boolean } | null)?.notADocument;
    if (!fallbackUrl || !notADocument) throw e;
    await fetchAndSave(fallbackUrl, filename);
    return { usedFallback: true };
  }
}

async function fetchAndSave(url: string, filename: string): Promise<void> {
  if (!isIsMendeluUrl(url)) throw new Error('Refusing non-IS document URL');
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401 || res.status === 403) {
    // Genuine session-expiry — the caller redirects to login on this signal only.
    const err = new Error(`HTTP ${res.status}`);
    (err as Error & { sessionExpired?: boolean }).sessionExpired = true;
    throw err;
  }
  if (!res.ok) {
    // Non-2xx that isn't 401/403 (e.g. an IS 5xx error page) is a transient
    // failure, NOT a session problem — throw un-tagged so the caller shows a
    // row error instead of force-navigating a still-logged-in user to login.
    throw new Error(`HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    // HTML here is ambiguous and the two cases must not be conflated:
    //   - the LOGIN page → the session really has lapsed, redirect to login.
    //   - an AUTHENTICATED page → IS served a real page instead of the file,
    //     which is what its sealed print endpoints do while broken. Treating
    //     that as an expired session logged the student out over an IS bug,
    //     and left no opportunity to fall back.
    // `logout.pl` only appears once authenticated — the same marker the mobile
    // transport uses (see api/capacitorBinary).
    const body = await res.text().catch(() => '');
    const err = new Error(`Not a PDF (${contentType || 'unknown'})`);
    if (/logout\.pl/.test(body)) {
      (err as Error & { notADocument?: boolean }).notADocument = true;
    } else {
      (err as Error & { sessionExpired?: boolean }).sessionExpired = true;
    }
    throw err;
  }
  const blob = await res.blob();
  // The save step is platform-dependent: blob + a[download] is a SILENT no-op
  // in both mobile WebViews (measured), so Capacitor writes via Filesystem and
  // asserts the file landed. The extension path is unchanged.
  await saveBlob(blob, filename, buildSaveDeps());
}
