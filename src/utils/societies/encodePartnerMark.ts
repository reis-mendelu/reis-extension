import { drawPng, fitUnderLimit } from './fitUnderLimit';

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
 * encodeSocietyLogo does. 480×160 RGBA is over the bucket's limit even raw, so
 * a noisy mark steps down until it fits; null = it never did.
 */
export async function encodePartnerMark(file: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await fitUnderLimit((scale) => {
      const max = { w: MARK_MAX_W * scale, h: MARK_MAX_H * scale };
      const { w, h } = fitWithin(bitmap.width, bitmap.height, max.w, max.h);
      return drawPng(w, h, (ctx) => ctx.drawImage(bitmap, 0, 0, w, h));
    });
  } finally {
    bitmap.close();
  }
}
