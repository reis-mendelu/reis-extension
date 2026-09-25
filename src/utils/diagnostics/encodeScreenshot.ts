import { computeTargetDimensions, blobToBase64 } from '@/services/notes/imageNormalize';
import { logError } from '../reportError';

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

function drawJpeg(
  source: CanvasImageSource,
  w: number,
  h: number,
  quality: number
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  // A transparent PNG would otherwise turn black: JPEG has no alpha.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

const bitmapCodec: ScreenshotCodec = {
  async measure(src) {
    const bmp = await createImageBitmap(src);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close();
    return dims;
  },
  async render(src, w, h, quality) {
    const bmp = await createImageBitmap(src);
    try {
      return await drawJpeg(bmp, w, h, quality);
    } finally {
      bmp.close();
    }
  },
};

function loadImage(src: Blob): Promise<{ img: HTMLImageElement; done: () => void }> {
  const url = URL.createObjectURL(src);
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve({ img, done: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image element could not decode the file'));
    };
    img.src = url;
  });
}

// The same draw through an <img>. On the Android emulator one pick in seven
// failed to attach and none of the next six reproduced it; a second decode
// path costs nothing when the first works, and saves the attach when it does not.
const imageElementCodec: ScreenshotCodec = {
  async measure(src) {
    const { img, done } = await loadImage(src);
    done();
    return { width: img.naturalWidth, height: img.naturalHeight };
  },
  async render(src, w, h, quality) {
    const { img, done } = await loadImage(src);
    try {
      return await drawJpeg(img, w, h, quality);
    } finally {
      done();
    }
  },
};

async function encodeWith(file: Blob, codec: ScreenshotCodec): Promise<EncodedScreenshot | null> {
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
}

/**
 * Null when no decoder can read the file, or it cannot be made small enough.
 * A decoder that THROWS is logged — so the failure lands in the report's own
 * technical details next time — and the next one is tried. One that decodes
 * but cannot fit the size cap is final: another decoder would not shrink it.
 */
export async function encodeScreenshot(
  file: Blob,
  codecs: ScreenshotCodec | ScreenshotCodec[] = [bitmapCodec, imageElementCodec]
): Promise<EncodedScreenshot | null> {
  for (const [i, codec] of (Array.isArray(codecs) ? codecs : [codecs]).entries()) {
    try {
      return await encodeWith(file, codec);
    } catch (err) {
      logError('encodeScreenshot', err, { decoder: i, type: file.type, size: file.size });
    }
  }
  return null;
}
