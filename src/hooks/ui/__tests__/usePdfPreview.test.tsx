import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const openPdfInline = vi.fn();
const fetchPdfBlob = vi.fn();
const openFile = vi.fn();
const downloadSingle = vi.fn();
const activeDownloads = { 'https://is.mendelu.cz/a.pdf': { loaded: 512, total: 2048 } };
vi.mock('../useFileActions', () => ({
  useFileActions: () => ({
    openPdfInline: (...a: unknown[]) => openPdfInline(...a),
    fetchPdfBlob: (...a: unknown[]) => fetchPdfBlob(...a),
    openFile: (...a: unknown[]) => openFile(...a),
    downloadSingle,
    isDownloading: false,
    downloadProgress: null,
    activeDownloads,
  }),
}));

const isPdfInkAvailable = vi.fn(async () => false);
vi.mock('../../../mobile/pdfInkNative', () => ({
  isPdfInkAvailable: () => isPdfInkAvailable(),
  nativePdfInkDeps: { tag: 'native-deps' },
  // The recent-files slice reads the index through this after every open.
  capacitorPdfCacheFs: { readText: async () => '{}' },
}));

const openPdfWithInk = vi.fn();
vi.mock('../../../mobile/pdfInk', () => ({
  openPdfWithInk: (...a: unknown[]) => openPdfWithInk(...a),
}));

// Read at factory time, so it must be hoisted with vi.mock.
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { usePdfPreview } from '../usePdfPreview';
import { useAppStore } from '../../../store/useAppStore';

describe('usePdfPreview — downloads', () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * The row's download button gave no sign it had been tapped — a file comes
   * down the IS session whole, and a button that does nothing visible for
   * seconds reads as broken. That tracking lives in `useFileActions` now,
   * per link and with byte counts (see its tests: progress published and
   * cleared, cleared on failure, a second tap refused). This hook's job is to
   * hand it to the phone sheet untouched, and NOT to wrap `downloadSingle`
   * again: a wrapper that awaited it whole kept spinning through iOS's share
   * sheet, after the bytes had landed.
   */
  it('passes the per-row download state through, with downloadSingle unwrapped', () => {
    const { result } = renderHook(() => usePdfPreview('EBC-EKM'));
    expect(result.current.activeDownloads).toBe(activeDownloads);
    expect(result.current.downloadSingle).toBe(downloadSingle);
  });
});

describe('usePdfPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPdfInkAvailable.mockResolvedValue(false);
    URL.revokeObjectURL = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:from-ink');
  });

  /**
   * Which file is being fetched, for as long as the fetch runs.
   *
   * The hook computed a bare `isPreviewLoading` that no caller ever read, so a
   * tapped row showed nothing at all while a whole PDF came down the IS session
   * — "there's no loading so it seems the button is not working". The row needs
   * to know WHICH file, not merely that something is happening.
   */
  it('names the file it is fetching, and stops when the fetch ends', async () => {
    let finish!: (v: string) => void;
    openPdfInline.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHook(() => usePdfPreview());

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.viewPdf('/lecture.pdf', { name: 'Lecture' });
    });
    expect(result.current.openingLink).toBe('/lecture.pdf');

    await act(async () => {
      finish('blob:abc');
      await done;
    });
    expect(result.current.openingLink).toBeNull();
  });

  it('ignores a second tap while the first file is still coming down', async () => {
    openPdfInline.mockReturnValue(new Promise<string>(() => {}));
    const { result } = renderHook(() => usePdfPreview());
    await act(async () => {
      void result.current.viewPdf('/first.pdf');
    });
    await act(async () => {
      void result.current.viewPdf('/second.pdf');
    });

    expect(openPdfInline).toHaveBeenCalledTimes(1);
    expect(result.current.openingLink).toBe('/first.pdf');
  });

  it('shows the blob it fetched', async () => {
    openPdfInline.mockResolvedValue('blob:abc');
    const { result } = renderHook(() => usePdfPreview());
    await act(async () => void (await result.current.viewPdf('/x.pdf', { name: 'Notes' })));
    expect(result.current.previewUrl).toBe('blob:abc');
    expect(result.current.previewFile).toEqual({ link: '/x.pdf', name: 'Notes' });
  });

  // IS serves viewer pages under the same anchors, so "not a PDF" is a normal
  // outcome rather than an error — fall through to the download.
  it('falls back to the download when the file is not a PDF', async () => {
    openPdfInline.mockResolvedValue(null);
    const { result } = renderHook(() => usePdfPreview());
    await act(async () => void (await result.current.viewPdf('/x.html')));
    expect(openFile).toHaveBeenCalledWith('/x.html');
    expect(result.current.previewUrl).toBeNull();
  });

  it('revokes the blob when the preview is closed', async () => {
    openPdfInline.mockResolvedValue('blob:abc');
    const { result } = renderHook(() => usePdfPreview());
    await act(async () => void (await result.current.viewPdf('/x.pdf')));
    act(() => result.current.closePreview());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:abc');
  });

  // Close the drawer while the fetch is still running: the URL lands on a dead
  // hook, so it never reaches state and the unmount cleanup never sees it. Left
  // alone, the blob is pinned for the life of the document.
  it('revokes a blob that arrives after unmount', async () => {
    let resolveFetch!: (v: string) => void;
    openPdfInline.mockReturnValue(new Promise<string>((r) => (resolveFetch = r)));

    const { result, unmount } = renderHook(() => usePdfPreview());
    let pending!: Promise<void>;
    act(() => void (pending = result.current.viewPdf('/x.pdf')));

    unmount();
    await act(async () => {
      resolveFetch('blob:late');
      await pending;
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:late');
  });

  describe('on an iPad with the PdfInk plugin', () => {
    beforeEach(() => isPdfInkAvailable.mockResolvedValue(true));

    it('opens the native reader with the course, its PDF list, link, name and date, and mounts no web viewer', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'shown', hasInk: true });
      const subject = {
        title: 'Matematika',
        files: [{ link: '/y.pdf', name: 'Other', date: '1. 1. 2026' }],
      };
      const { result } = renderHook(() => usePdfPreview('EBC-MT', subject));
      await act(
        async () =>
          void (await result.current.viewPdf('/x.pdf', { name: 'Slides', date: '12. 3. 2026' }))
      );
      expect(openPdfWithInk).toHaveBeenCalledWith(
        { tag: 'native-deps' },
        expect.objectContaining({
          courseCode: 'EBC-MT',
          courseTitle: 'Matematika',
          files: subject.files,
          fileLink: '/x.pdf',
          name: 'Slides',
          date: '12. 3. 2026',
          strings: expect.objectContaining({
            discard: expect.any(String),
            openFailed: expect.any(String),
          }),
          fetchPdf: expect.any(Function),
        })
      );
      expect(openPdfInline).not.toHaveBeenCalled();
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.isPreviewLoading).toBe(false);
    });

    it('hands its fetchPdf to the file actions so the reader and the viewer share one fetch', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'shown', hasInk: false });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.pdf', { date: 'd' })));
      const input = openPdfWithInk.mock.calls[0]?.[1] as {
        fetchPdf: (link: string) => Promise<Blob | null>;
        courseTitle: string;
        files: unknown[];
      };
      await input.fetchPdf('/other.pdf');
      expect(fetchPdfBlob).toHaveBeenCalledWith('/other.pdf');
      // Without a subject the course code stands in as the title and the list is empty.
      expect(input.courseTitle).toBe('EBC-MT');
      expect(input.files).toEqual([]);
    });

    it('mounts the web viewer from the same bytes when PDFKit cannot read them', async () => {
      const blob = new Blob(['x']);
      openPdfWithInk.mockResolvedValue({ kind: 'unreadable', blob });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.pdf', { name: 'Slides' })));
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(result.current.previewUrl).toBe('blob:from-ink');
      expect(result.current.previewFile).toEqual({ link: '/x.pdf', name: 'Slides' });
    });

    it('falls back to the download when IS served a viewer page', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'notPdf' });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.html')));
      expect(openFile).toHaveBeenCalledWith('/x.html');
    });

    it('tells the student when the reader failed, instead of a tap that did nothing', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'failed', error: new Error('offline') });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.pdf')));
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.isPreviewLoading).toBe(false);
    });

    it('uses the web viewer when no course is known — there is nothing to key the ink by', async () => {
      openPdfInline.mockResolvedValue('blob:abc');
      const { result } = renderHook(() => usePdfPreview());
      await act(async () => void (await result.current.viewPdf('/x.pdf')));
      expect(openPdfWithInk).not.toHaveBeenCalled();
      expect(result.current.previewUrl).toBe('blob:abc');
    });
  });

  it('refreshes the recently-opened list after the native reader closes', async () => {
    isPdfInkAvailable.mockResolvedValue(true);
    openPdfWithInk.mockResolvedValue({ kind: 'shown', hasInk: false });
    const refreshRecentPdfs = vi.fn(async () => undefined);
    useAppStore.setState({ refreshRecentPdfs } as never);

    const { result } = renderHook(() => usePdfPreview('EBC-AP'));
    await act(async () => void (await result.current.viewPdf('/x.pdf', { name: 'Notes' })));

    expect(refreshRecentPdfs).toHaveBeenCalledTimes(1);
  });
});
