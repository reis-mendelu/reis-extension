export const MARK_MAX_W = 480;
export const MARK_MAX_H = 160;

/** The largest size within the box that keeps the aspect. Never enlarges. */
export function fitWithin(
  w: number,
  h: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  const s = Math.min(1, maxW / w, maxH / h);
  // At least 1px a side: a zero-width canvas cannot be encoded.
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/**
 * A partner's wide colour mark (spec 2026-10-09): aspect kept, never cropped
 * square like a society logo, at most 480×160, PNG so transparency survives.
 * Re-drawing through a canvas drops the original's metadata, as
 * encodeSocietyLogo does.
 */
export async function encodePartnerMark(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { w, h } = fitWithin(bitmap.width, bitmap.height, MARK_MAX_W, MARK_MAX_H);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob returned null');
    return blob;
  } finally {
    bitmap.close();
  }
}
