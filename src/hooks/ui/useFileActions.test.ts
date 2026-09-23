import { renderHook, act } from '@testing-library/react';
import { useFileActions } from './useFileActions';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
// The source does `new JSZip()`, so the mock's default export has to be
// constructible. vitest 5 constructs a mock's implementation under `new`
// instead of calling it, and an arrow function has no [[Construct]] — the old
// `vi.fn().mockImplementation(() => ({...}))` now throws "is not a
// constructor". Nothing here asserts on the JSZip constructor itself, so a
// plain class is both sufficient and clearer than a mock wrapping one.
vi.mock('jszip', () => ({
  default: class {
    file = vi.fn();
    generateAsync = vi.fn().mockResolvedValue(new Blob(['test-zip-content']));
    files = { 'file1.pdf': {}, 'file2.pdf': {} };
  },
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('../../utils/fileUrl', () => ({
  normalizeFileUrl: vi.fn((url) => url),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock requestQueue - use vi.mock without outer variables to avoid hoisting issues
vi.mock('../../utils/requestQueue', () => ({
  requestQueue: {
    add: vi.fn((fn) => fn()),
  },
}));

import { requestQueue } from '../../utils/requestQueue';

describe('useFileActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      // %PDF- because fetchPdfBlob now checks it; the other paths do not care.
      blob: async () => new Blob(['%PDF-1.4 test content']),
      headers: new Map([['content-disposition', 'attachment; filename="test.pdf"']]),
    });
  });

  it('should track progress during downloadZip', async () => {
    const { result } = renderHook(() => useFileActions());
    const fileLinks = ['link1', 'link2', 'link3'];

    await act(async () => {
      await result.current.downloadZip(fileLinks, 'test.zip');
    });

    expect(result.current.isDownloading).toBe(false);
    expect(result.current.downloadProgress).toBe(null);
    expect(requestQueue.add).toHaveBeenCalledTimes(3);
  });

  it('should retry once on 500 error', async () => {
    const { result } = renderHook(() => useFileActions());

    // Mock fail then success
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['ok']), headers: new Map() }) // retry success
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['ok2']), headers: new Map() }); // second file success

    await act(async () => {
      await result.current.downloadZip(['f1', 'f2'], 'test.zip');
    });

    // 3 calls total: 2 for first file (fail + retry), 1 for second file
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
  describe('fetchPdfBlob / openPdfInline', () => {
    it('fetchPdfBlob returns the bytes with credentials, null when IS refuses', async () => {
      const { result } = renderHook(() => useFileActions());
      const blob = await result.current.fetchPdfBlob('https://is.mendelu.cz/x.pdf');
      expect(blob).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalledWith('https://is.mendelu.cz/x.pdf', {
        credentials: 'include',
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
      expect(await result.current.fetchPdfBlob('https://is.mendelu.cz/x.pdf')).toBeNull();
    });

    it('is null for bytes that are not a PDF — the caller downloads instead', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['PK\u0003\u0004 a docx, not a PDF']),
      });
      const { result } = renderHook(() => useFileActions());
      expect(await result.current.fetchPdfBlob('https://is.mendelu.cz/x')).toBeNull();
    });

    it('openPdfInline is fetchPdfBlob plus a blob URL', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:one');
      const { result } = renderHook(() => useFileActions());
      expect(await result.current.openPdfInline('https://is.mendelu.cz/x.pdf')).toBe('blob:one');
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
      expect(await result.current.openPdfInline('https://is.mendelu.cz/x.pdf')).toBeNull();
    });
  });
  /**
   * The gap this suite exists to close: tapping the row's download button used
   * to set no state at all, so on a slow IS connection nothing moved between
   * the tap and the file appearing — "there's no loading so it seems the button
   * is not working". The row, not a global flag, is where the student is
   * looking, so the state is keyed by the row's link.
   */
  describe('downloadSingle progress', () => {
    it('publishes progress for the row being downloaded and clears it when done', async () => {
      let release: (r: unknown) => void = () => {};
      global.fetch = vi.fn(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useFileActions());

      let pending!: Promise<void>;
      act(() => {
        pending = result.current.downloadSingle('link1');
      });

      expect(result.current.activeDownloads['link1']).toEqual({ loaded: 0, total: null });
      // The header's bulk button shares the busy flag: one download at a time.
      expect(result.current.isDownloading).toBe(true);

      await act(async () => {
        release({
          ok: true,
          blob: async () => new Blob(['pdf']),
          headers: new Map([['content-disposition', 'attachment; filename="a.pdf"']]),
        });
        await pending;
      });

      expect(result.current.activeDownloads['link1']).toBeUndefined();
      expect(result.current.isDownloading).toBe(false);
    });

    it('carries real byte counts when IS declares a Content-Length', async () => {
      const chunks = [new Uint8Array([1, 2, 3, 4, 5]), new Uint8Array([6, 7, 8, 9, 10])];
      let i = 0;
      // The second chunk is held back so the test can observe a COMMITTED
      // mid-stream render. Without the gate React batches the whole download
      // into one commit and every intermediate tick is invisible — which is
      // also what a student would see if the ticks never reached state.
      let releaseSecond: () => void = () => {};
      const secondChunk = new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });

      global.fetch = vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-length': '10' }),
        body: {
          getReader: () => ({
            read: async () => {
              if (i === 1) await secondChunk;
              return i < chunks.length
                ? { done: false, value: chunks[i++] }
                : { done: true, value: undefined };
            },
          }),
        },
        blob: async () => new Blob(chunks as BlobPart[]),
      })) as unknown as typeof fetch;

      const { result } = renderHook(() => useFileActions());

      let pending!: Promise<void>;
      await act(async () => {
        pending = result.current.downloadSingle('link1');
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.activeDownloads['link1']).toEqual({ loaded: 5, total: 10 });

      await act(async () => {
        releaseSecond();
        await pending;
      });

      expect(result.current.activeDownloads['link1']).toBeUndefined();
    });

    it('ignores a second tap on a row already downloading', async () => {
      let release: (r: unknown) => void = () => {};
      global.fetch = vi.fn(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      ) as unknown as typeof fetch;
      const { result } = renderHook(() => useFileActions());

      let first!: Promise<void>;
      let second!: Promise<void>;
      act(() => {
        first = result.current.downloadSingle('link1');
        second = result.current.downloadSingle('link1');
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        release({ ok: true, blob: async () => new Blob(['pdf']), headers: new Map() });
        await Promise.all([first, second]);
      });
    });

    it('clears the row even when the download fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
      window.open = vi.fn();
      const { result } = renderHook(() => useFileActions());

      await act(async () => {
        await result.current.downloadSingle('link1');
      });

      // A row stuck spinning forever is worse than the missing spinner was.
      expect(result.current.activeDownloads['link1']).toBeUndefined();
      expect(result.current.isDownloading).toBe(false);
    });
  });
});
