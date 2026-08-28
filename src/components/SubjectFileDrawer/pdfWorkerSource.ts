// Dynamic import() of ES modules fails under the chrome-extension:// protocol,
// so pdf.js's worker is fetched as text and re-served from a blob URL.
//
// Resolving the asset used to be a bare `chrome.runtime.getURL(...)`. That is
// an extension-only global: on Capacitor it is undefined, so the call threw
// before pdf.js could start and the inline viewer never opened on the iPad app.
// `getAssetUrl` is the platform seam built for this — the extension maps it to
// chrome.runtime.getURL, Capacitor and the dev webapp to a WebView-root path.
import workerPath from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getPlatform } from '../../platform';

export interface PdfWorkerDeps {
  getAssetUrl(path: string): string;
  fetchFn(url: string): Promise<{ text(): Promise<string> }>;
}

// The blob URL is minted once per app session and shared: every viewer needs
// the same worker, and re-fetching it per open is pure waste.
let cached: Promise<string> | null = null;

export function resolvePdfWorkerSource(deps?: Partial<PdfWorkerDeps>): Promise<string> {
  if (cached) return cached;
  const getAssetUrl = deps?.getAssetUrl ?? ((p: string) => getPlatform().getAssetUrl(p));
  const fetchFn = deps?.fetchFn ?? ((url: string) => fetch(url));

  const pending = Promise.resolve()
    .then(() => fetchFn(getAssetUrl(workerPath)))
    .then((r) => r.text())
    .then((text) =>
      URL.createObjectURL(new Blob([text], { type: 'application/javascript' }))
    );

  // A rejection is NOT cached: a failed fetch (offline, a cold WebView) would
  // otherwise poison every later attempt to open a PDF for the whole session.
  cached = pending.catch((e) => {
    cached = null;
    throw e;
  });
  return cached;
}

/** Test-only: drop the memoised worker URL between cases. */
export function __resetPdfWorkerForTests(): void {
  cached = null;
}
