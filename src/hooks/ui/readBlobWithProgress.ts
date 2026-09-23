/**
 * Reads a response body into a Blob, reporting bytes as they arrive.
 *
 * This is the only place in the app that can produce a REAL percentage. The
 * Capacitor transport cannot: `CapacitorHttp.get({ responseType: 'blob' })`
 * hands back the whole body base64-encoded in one call, with no intermediate
 * callback (see api/capacitorBinary.ts). So the phone and the tablet stay
 * indeterminate by necessity, and `total: null` is how that travels — the
 * caller renders a spinner rather than inventing a denominator.
 */

export interface DownloadTick {
  /** Bytes received so far. */
  loaded: number;
  /** Total bytes, or null when the server declared none. */
  total: number | null;
}

/** Content-Length, or null when absent, zero or unparseable. */
function declaredTotal(headers: Response['headers'] | undefined): number | null {
  const raw = headers?.get?.('content-length');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function readBlobWithProgress(
  response: Response,
  onTick: (tick: DownloadTick) => void
): Promise<Blob> {
  const total = declaredTotal(response.headers);
  const type = response.headers?.get?.('content-type') ?? '';

  const reader = response.body?.getReader?.();
  if (!reader) {
    // No readable body: jsdom, and any WebView shim that fills `blob()` without
    // a stream. A download that works today must not start failing for the sake
    // of a progress bar, so this degrades to one indeterminate tick — the
    // student still sees that something is happening — and the whole blob.
    onTick({ loaded: 0, total });
    return response.blob();
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  // Emitted before the first chunk so the row goes busy the instant the
  // response headers land, not only once bytes start arriving.
  onTick({ loaded: 0, total });

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loaded += value.byteLength;
    onTick({ loaded, total });
  }

  return new Blob(chunks as BlobPart[], type ? { type } : undefined);
}
