import { describe, it, expect, vi } from 'vitest';
import { LOGO_MAX_BYTES, SCALE_STEPS, fitUnderLimit } from '../fitUnderLimit';

// PNG is lossless, so only a smaller image is a smaller file. A fake render
// whose size grows with the area stands in for the canvas jsdom does not have.
const renderOfArea = (bytesAtFullSize: number) =>
  vi.fn(
    async (scale: number) => new Blob([new Uint8Array(Math.round(bytesAtFullSize * scale * scale))])
  );

describe('fitUnderLimit', () => {
  it('matches the society-logos bucket limit (societies_catalog.sql)', () => {
    expect(LOGO_MAX_BYTES).toBe(262144);
  });

  it('keeps the full size when it already fits, rendering once', async () => {
    const render = renderOfArea(100_000);
    const blob = await fitUnderLimit(render);
    expect(blob?.size).toBe(100_000);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(1);
  });

  it('steps the size down until the PNG fits under the limit', async () => {
    // A noisy 480×160 RGBA mark: raw 307200 bytes plus PNG overhead.
    const render = renderOfArea(310_000);
    const blob = await fitUnderLimit(render);
    expect(blob).not.toBeNull();
    expect(blob!.size).toBeLessThanOrEqual(LOGO_MAX_BYTES);
    // Only as small as needed: full size is over, the first step down fits.
    expect(render.mock.calls.map(([s]) => s)).toEqual([1, 0.9]);
  });

  it('returns null when even the smallest step is over the limit', async () => {
    const render = renderOfArea(10_000_000);
    expect(await fitUnderLimit(render)).toBeNull();
    expect(render).toHaveBeenCalledTimes(SCALE_STEPS.length);
  });

  it('accepts exactly the limit', async () => {
    const blob = await fitUnderLimit(async () => new Blob([new Uint8Array(LOGO_MAX_BYTES)]));
    expect(blob?.size).toBe(LOGO_MAX_BYTES);
  });
});
