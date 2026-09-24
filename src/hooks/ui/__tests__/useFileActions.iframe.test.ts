import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The extension iframe's file actions, end to end down to the proxy. The
// direct-fetch path is useFileActions.test.ts; Capacitor's is the .native one.
const fetchViaProxy = vi.fn();
vi.mock('../../../api/proxyClient', () => ({
  fetchViaProxy: (...args: unknown[]) => fetchViaProxy(...args),
  isInIframe: () => true,
}));
const zipFile = vi.fn();
vi.mock('jszip', () => ({
  default: class {
    file = zipFile;
    generateAsync = vi.fn().mockResolvedValue(new Blob(['zip']));
    files = { 'a.pdf': {} };
  },
}));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../../../utils/requestQueue', () => ({
  requestQueue: { add: (fn: () => unknown) => fn() },
}));

import { useFileActions } from '../useFileActions';

const pdf = (name: string) =>
  JSON.stringify({
    contentType: 'application/pdf',
    contentDisposition: `attachment; filename="${name}"`,
    base64: 'JVBERi0xLjQ=', // %PDF-1.4
  });

const page = JSON.stringify({
  contentType: 'text/html; charset=utf-8',
  contentDisposition: null,
  base64: 'PGh0bWw+', // <html>
});

describe('useFileActions inside the extension iframe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchViaProxy.mockReset();
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('direct fetch from the iframe')));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('previews a PDF through the proxy', async () => {
    fetchViaProxy.mockResolvedValue(pdf('a.pdf'));
    const { result } = renderHook(() => useFileActions());
    const blob = await result.current.fetchPdfBlob('https://is.mendelu.cz/a');
    expect(blob).not.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // #376's byte progress survives the hop: the row shows the proxy's ticks.
  it("downloadSingle shows the proxy's byte ticks on the row", async () => {
    let resolve!: (v: string) => void;
    fetchViaProxy.mockImplementation(
      (_u: string, _o: unknown, onTick: (t: { loaded: number; total: number | null }) => void) => {
        onTick({ loaded: 40, total: 100 });
        return new Promise<string>((r) => (resolve = r));
      }
    );
    const { result } = renderHook(() => useFileActions());
    const link = 'https://is.mendelu.cz/a';

    let done!: Promise<void>;
    act(() => {
      done = result.current.downloadSingle(link);
    });
    await vi.waitFor(() =>
      expect(result.current.activeDownloads[link]).toEqual({ loaded: 40, total: 100 })
    );
    await act(async () => {
      resolve(pdf('a.pdf'));
      await done;
    });
    expect(result.current.activeDownloads[link]).toBeUndefined();
  });

  // Across postMessage a rejection is only a string, so the 5xx retry reads
  // the status out of it.
  it('downloadZip retries a file once when the proxy reports an IS 5xx', async () => {
    fetchViaProxy
      .mockRejectedValueOnce(new Error('Error: HTTP 503'))
      .mockResolvedValueOnce(pdf('a.pdf'))
      .mockResolvedValueOnce(pdf('b.pdf'));
    const { result } = renderHook(() => useFileActions());
    await act(() =>
      result.current.downloadZip(['https://is.mendelu.cz/a', 'https://is.mendelu.cz/b'], 'x.zip')
    );
    expect(fetchViaProxy).toHaveBeenCalledTimes(3);
    expect(zipFile.mock.calls.map((c) => c[0]).sort()).toEqual(['a.pdf', 'b.pdf']);
  });

  it('downloadZip does not retry a 403', async () => {
    fetchViaProxy
      .mockRejectedValueOnce(new Error('Error: HTTP 403'))
      .mockResolvedValueOnce(pdf('b.pdf'));
    const { result } = renderHook(() => useFileActions());
    await act(() =>
      result.current.downloadZip(['https://is.mendelu.cz/a', 'https://is.mendelu.cz/b'], 'x.zip')
    );
    expect(fetchViaProxy).toHaveBeenCalledTimes(2);
  });

  // A viewer or login page is not the file: the student gets the URL opened
  // top-level, where IS answers for itself, never a blob of the page.
  it('openFile opens the IS URL, not a blob, when IS answers with a page', async () => {
    fetchViaProxy.mockResolvedValue(page);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { result } = renderHook(() => useFileActions());
    await act(() => result.current.openFile('https://is.mendelu.cz/a'));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('https://is.mendelu.cz/a', '_blank', 'noopener,noreferrer');
  });

  it('downloadSingle opens the IS URL instead of saving a page under the file name', async () => {
    fetchViaProxy.mockResolvedValue(page);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { result } = renderHook(() => useFileActions());
    await act(() => result.current.downloadSingle('https://is.mendelu.cz/a'));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('https://is.mendelu.cz/a', '_blank', 'noopener,noreferrer');
  });

  it('downloadZip leaves a page out of the zip', async () => {
    fetchViaProxy.mockResolvedValueOnce(page).mockResolvedValueOnce(pdf('b.pdf'));
    const { result } = renderHook(() => useFileActions());
    await act(() =>
      result.current.downloadZip(['https://is.mendelu.cz/a', 'https://is.mendelu.cz/b'], 'x.zip')
    );
    expect(zipFile.mock.calls.map((c) => c[0])).toEqual(['b.pdf']);
  });
});
