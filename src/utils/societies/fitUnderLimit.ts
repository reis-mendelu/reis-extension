/**
 * The society-logos bucket's file_size_limit
 * (supabase/migrations/20260926120000_societies_catalog.sql). Storage refuses a
 * bigger file with an error the console can only report as "upload failed".
 */
export const LOGO_MAX_BYTES = 262_144;

/**
 * Scales tried in order. PNG is lossless, so only fewer pixels make a smaller
 * file. A 256×256 logo is 262144 raw RGBA bytes and a 480×160 mark 307200, so a
 * noisy image goes over only by PNG overhead and one or two steps fit it; the
 * floor exists so the loop ends.
 */
export const SCALE_STEPS = [1, 0.9, 0.8, 0.7, 0.6, 0.5] as const;

/**
 * Renders at each step until the PNG fits, never enlarging. Null when even the
 * smallest step is over the limit, so the caller can say so before uploading.
 */
export async function fitUnderLimit(
  render: (scale: number) => Promise<Blob>,
  limit = LOGO_MAX_BYTES
): Promise<Blob | null> {
  for (const scale of SCALE_STEPS) {
    const blob = await render(scale);
    if (blob.size <= limit) return blob;
  }
  return null;
}

/** A w×h canvas, drawn by `paint`, as a PNG (keeps transparency, drops metadata). */
export async function drawPng(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  paint(ctx);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob returned null');
  return blob;
}
