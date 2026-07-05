/**
 * Downloads an IS document as a real file. MUST run in the content script
 * (first-party on is.mendelu.cz), which holds the SameSite session cookie —
 * a cross-site fetch from the iframe app would get a login page instead.
 * Resolves only once the blob is saved, giving the UI a true completion signal.
 */
export async function downloadDocumentInPage(url: string, filename: string): Promise<void> {
  if (!url.startsWith('https://is.mendelu.cz')) throw new Error('Refusing non-IS document URL');
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401 || res.status === 403) {
    // Genuine session-expiry — the caller redirects to login on this signal only.
    const err = new Error(`HTTP ${res.status}`);
    (err as Error & { sessionExpired?: boolean }).sessionExpired = true;
    throw err;
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    // A non-PDF 200 means the session lapsed and IS served a login/HTML page.
    const err = new Error(`Not a PDF (${contentType || 'unknown'})`);
    (err as Error & { sessionExpired?: boolean }).sessionExpired = true;
    throw err;
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
