/** Pure helpers + the canvas normalize step for pasted note images. */

/** Longest-edge downscale, preserving aspect ratio. No upscaling. */
export function computeTargetDimensions(
  w: number,
  h: number,
  maxEdge: number
): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h };
  const scale = maxEdge / longest;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/** Full SHA-256 hex of the given bytes — the content-addressed image key. */
export async function hashBytes(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const MAX_IMAGE_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

/**
 * Decode an arbitrary image Blob, downscale to MAX_IMAGE_EDGE, re-encode JPEG.
 * Not unit-tested (canvas is unavailable under happy-dom) — covered by the
 * verification spike and the manual end-to-end check.
 */
export async function normalizeImage(
  input: Blob
): Promise<{ blob: Blob; mime: string; w: number; h: number }> {
  const bitmap = await createImageBitmap(input);
  try {
    const { w, h } = computeTargetDimensions(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) throw new Error('toBlob returned null');
    return { blob, mime: 'image/jpeg', w, h };
  } finally {
    bitmap.close();
  }
}

/** Raw base64 (no data: prefix) of a Blob's bytes. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!); // safe: i < buf.length
  return btoa(binary);
}
