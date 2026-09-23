import { bytesToBase64 } from '../services/eduroam/base64';

/**
 * The content-script half of `fetchAuthedBytes` for the extension iframe: read
 * an IS file response as base64, so it crosses postMessage as a plain string
 * (the REIS_FETCH reply carries text). HTML where a file was expected is a page,
 * not the file — refuse it rather than hand it back to be saved as a
 * certificate. Lowercased because `Headers` normalises names, not values.
 */
export async function readBytesBody(response: Response): Promise<string> {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error('Expected file bytes, got HTML (session expired?)');
  }
  return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
}
