import { BASE_URL } from './client';

/**
 * Builds the "Potvrzeni o studiu" print URL -- the *sealed* (elektronicky
 * pecetena) variant (potvrzeni_tisk_el=1), not the plain/unsealed one
 * (potvrzeni_tisk=1). Measured directly: IS's backend responds to the
 * unsealed variant in ~7-8s but to this sealed variant in under a second,
 * with a real synchronous PDF response (not the queued/~1hr-later flow that
 * applies to some other document types on this same print page). It's also
 * arguably the better document to hand out anyway, since it carries the
 * official electronic seal.
 * `lang` is IS's own interface-chrome language ('cz'|'en'); `jazyk=eng` is a
 * *separate* param controlling the document's own content language, added
 * only for English so the printed confirmation itself is in English
 * (omitted => Czech content).
 */
export function buildConfirmationUrl(sid: string, lang: string): string {
  const jazyk = lang === 'en' ? ';jazyk=eng' : '';
  return `${BASE_URL}/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1${jazyk};studium=${sid};lang=${lang}`;
}

let hiddenDownloadFrame: HTMLIFrameElement | null = null;
let lastDownloadUrl: string | null = null;
let lastDownloadAt = 0;
// Guards against a duplicate trigger for the exact same URL in quick
// succession -- e.g. a touch "ghost click" firing the handler twice for a
// single tap. Two near-simultaneous navigations to the same host serialize
// behind each other (one stalls on "Initial connection" waiting for the
// other's connection slot), which looked like the download itself being
// slow but was actually connection contention from a duplicate request.
const DEDUPE_WINDOW_MS = 1500;

/**
 * Triggers the confirmation PDF download via a hidden iframe navigation
 * rather than fetch(). IS Mendelu's backend responds far faster to a real
 * navigation (Sec-Fetch-Mode: navigate) than to a fetch()-style request
 * (Sec-Fetch-Mode: cors) -- confirmed by comparing request timing/headers
 * for the same URL. A real (even invisible) navigation is the only way to
 * get that header, since fetch() can never send Sec-Fetch-Mode: navigate.
 * The response is a real file download (confirmed separately), so the
 * browser's own download manager takes over once the iframe navigates.
 */
export function downloadConfirmation(url: string): void {
  const now = Date.now();
  if (url === lastDownloadUrl && now - lastDownloadAt < DEDUPE_WINDOW_MS) return;
  lastDownloadUrl = url;
  lastDownloadAt = now;

  if (!hiddenDownloadFrame || !document.body.contains(hiddenDownloadFrame)) {
    hiddenDownloadFrame = document.createElement('iframe');
    hiddenDownloadFrame.style.display = 'none';
    document.body.appendChild(hiddenDownloadFrame);
  }
  hiddenDownloadFrame.src = url;
}
