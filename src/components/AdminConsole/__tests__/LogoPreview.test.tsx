import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { LogoPreview } from '../LogoPreview';

// jsdom has no canvas and no createImageBitmap: a fake 2d context records the
// paint calls, and the bitmap stub reads one file and refuses the other.
const ctx = { clearRect: vi.fn(), drawImage: vi.fn() };
const good = new File([new Uint8Array([1])], 'good.png', { type: 'image/png' });
const bad = new File([new Uint8Array([2])], 'bad.png', { type: 'image/png' });

beforeEach(() => {
  ctx.clearRect.mockClear();
  ctx.drawImage.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (f: Blob) => {
      if (f === bad) throw new Error('unreadable');
      return { width: 100, height: 100, close: vi.fn() };
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LogoPreview', () => {
  it('blanks the old logo when an unreadable file replaces it', async () => {
    const { rerender } = render(<LogoPreview file={good} />);
    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalledTimes(1));
    ctx.clearRect.mockClear();

    rerender(<LogoPreview file={bad} />);
    // Cleared up front, before the decode that fails; nothing drawn after it.
    expect(ctx.clearRect).toHaveBeenCalled();
    await waitFor(() => expect(createImageBitmap).toHaveBeenCalledWith(bad));
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });
});
