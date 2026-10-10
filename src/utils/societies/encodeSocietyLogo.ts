import { drawPng, fitUnderLimit } from './fitUnderLimit';

export const LOGO_SIDE = 256;

/** The largest centred square: a logo is shown in round and square slots. */
export function squareCrop(w: number, h: number): { sx: number; sy: number; side: number } {
  const side = Math.min(w, h);
  return { sx: (w - side) / 2, sy: (h - side) / 2, side };
}

/**
 * Re-encodes an uploaded logo on the device: centre-cropped square, 256×256,
 * PNG (keeps transparency). Drawing through a canvas also drops the original's
 * metadata. Accepts what createImageBitmap reads everywhere (PNG, JPEG, WebP);
 * the form's file input limits the picker to those, so SVG never arrives here.
 * A photo-like logo can be over the bucket's limit at 256px, so it steps down
 * until it fits; null = it never did, and the caller says so before uploading.
 */
export async function encodeSocietyLogo(file: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
    return await fitUnderLimit((scale) => {
      const px = Math.max(1, Math.round(LOGO_SIDE * scale));
      return drawPng(px, px, (ctx) => ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, px, px));
    });
  } finally {
    bitmap.close();
  }
}
