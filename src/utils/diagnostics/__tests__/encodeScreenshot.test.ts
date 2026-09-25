import { describe, it, expect, vi, beforeEach } from 'vitest';
const logError = vi.fn();
vi.mock('../../reportError', () => ({ logError: (...a: unknown[]) => logError(...a) }));

import { encodeScreenshot, SCREENSHOT_MAX_BYTES, type ScreenshotCodec } from '../encodeScreenshot';

function codec(sizes: (w: number, q: number) => number, dims = { width: 4000, height: 3000 }) {
  const calls: Array<{ w: number; h: number; q: number }> = [];
  const c: ScreenshotCodec = {
    measure: vi.fn(async () => dims),
    render: vi.fn(async (_src, w, h, q) => {
      calls.push({ w, h, q });
      return new Blob([new Uint8Array(sizes(w, q))], { type: 'image/jpeg' });
    }),
  };
  return { c, calls };
}

const file = new Blob(['x'], { type: 'image/png' });

describe('encodeScreenshot', () => {
  it('scales the longest side to 1600 and stops at the first quality that fits', async () => {
    const { c, calls } = codec((_w, q) => (q > 0.7 ? SCREENSHOT_MAX_BYTES + 1 : 1000));
    const out = await encodeScreenshot(file, c);
    expect(calls.map((x) => x.q)).toEqual([0.85, 0.75, 0.65]);
    expect(calls[0]).toMatchObject({ w: 1600, h: 1200 });
    expect(out?.bytes).toBe(1000);
    expect(out?.base64).not.toMatch(/^data:/);
  });

  it('does not upscale a small image', async () => {
    const { c, calls } = codec(() => 10, { width: 800, height: 600 });
    await encodeScreenshot(file, c);
    expect(calls[0]).toMatchObject({ w: 800, h: 600 });
  });

  it('shrinks the image when no quality fits at full size', async () => {
    const { c, calls } = codec((w) => (w >= 1600 ? SCREENSHOT_MAX_BYTES + 1 : 500));
    const out = await encodeScreenshot(file, c);
    expect(out?.bytes).toBe(500);
    expect(calls.at(-1)!.w).toBe(1200);
  });

  it('gives up with null when nothing fits', async () => {
    const { c } = codec(() => SCREENSHOT_MAX_BYTES + 1);
    expect(await encodeScreenshot(file, c)).toBeNull();
  });

  it('returns null when the file cannot be decoded', async () => {
    const c: ScreenshotCodec = {
      measure: async () => {
        throw new Error('not an image');
      },
      render: vi.fn(),
    };
    expect(await encodeScreenshot(file, c)).toBeNull();
  });

  describe('decoder fallback', () => {
    beforeEach(() => logError.mockReset());

    const failing: ScreenshotCodec = {
      measure: async () => {
        throw new Error('The source image could not be decoded.');
      },
      render: vi.fn(),
    };

    it('falls back to the next decoder when one throws, and logs why', async () => {
      const { c } = codec(() => 1000);
      const out = await encodeScreenshot(file, [failing, c]);
      expect(out?.bytes).toBe(1000);
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError.mock.calls[0]![0]).toBe('encodeScreenshot');
    });

    it('logs every failed decoder and returns null when none works', async () => {
      expect(await encodeScreenshot(file, [failing, failing])).toBeNull();
      expect(logError).toHaveBeenCalledTimes(2);
    });

    it('does not try another decoder just because the image cannot be made small enough', async () => {
      const big = codec(() => SCREENSHOT_MAX_BYTES + 1);
      const spare = codec(() => 10);
      expect(await encodeScreenshot(file, [big.c, spare.c])).toBeNull();
      expect(spare.c.measure).not.toHaveBeenCalled();
      expect(logError).not.toHaveBeenCalled();
    });
  });
});
