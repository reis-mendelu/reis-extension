import { computeTargetDimensions, blobToBase64 } from '@/services/notes/imageNormalize';

// Re-encodes the screenshot a student attaches to a report. Drawing through a
// canvas is the point, not a side effect: the output carries none of the
// original's metadata, so a phone photo's EXIF — GPS included — never leaves
// the device. The server accepts only JPEG under SCREENSHOT_MAX_BYTES.

export const SCREENSHOT_MAX_BYTES = 614_400;
export const SCREENSHOT_MAX_SIDE = 1600;
const QUALITIES = [0.85, 0.75, 0.65, 0.5, 0.4];
const SHRINK = 0.75;
const SHRINK_STEPS = 2;

export interface ScreenshotCodec {
  measure(src: Blob): Promise<{ width: number; height: number }>;
  render(src: Blob, w: number, h: number, quality: number): Promise<Blob | null>;
}

export interface EncodedScreenshot {
  base64: string;
  bytes: number;
  blob: Blob;
}

const canvasCodec: ScreenshotCodec = {
  async measure(src) {
    const bmp = await createImageBitmap(src);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close();
    return dims;
  },
  async render(src, w, h, quality) {
    const bmp = await createImageBitmap(src);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      // A transparent PNG would otherwise turn black: JPEG has no alpha.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
      );
    } finally {
      bmp.close();
    }
  },
};

/** Null when the file is not a decodable image or cannot be made small enough. */
export async function encodeScreenshot(
  file: Blob,
  codec: ScreenshotCodec = canvasCodec
): Promise<EncodedScreenshot | null> {
  try {
    const { width, height } = await codec.measure(file);
    let { w, h } = computeTargetDimensions(width, height, SCREENSHOT_MAX_SIDE);
    for (let step = 0; step <= SHRINK_STEPS; step++) {
      for (const q of QUALITIES) {
        const blob = await codec.render(file, w, h, q);
        if (blob && blob.size <= SCREENSHOT_MAX_BYTES) {
          return { base64: await blobToBase64(blob), bytes: blob.size, blob };
        }
      }
      w = Math.round(w * SHRINK);
      h = Math.round(h * SHRINK);
    }
    return null;
  } catch {
    return null;
  }
}
