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
 */
export async function encodeSocietyLogo(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = LOGO_SIDE;
    canvas.height = LOGO_SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, LOGO_SIDE, LOGO_SIDE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob returned null');
    return blob;
  } finally {
    bitmap.close();
  }
}
