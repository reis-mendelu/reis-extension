import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFileActions } from '../useFileActions';
import { fetchIsBinary } from '../../../api/capacitorBinary';
import { logError } from '../../../utils/reportError';

vi.mock('../../../mobile/openIsFile', () => ({ isNativeHost: () => true }));
vi.mock('../../../api/capacitorBinary', () => ({ fetchIsBinary: vi.fn() }));
vi.mock('../../../platform/tokenStore', () => ({ loadStoredToken: async () => 'tok' }));
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({}),
  Capacitor: { getPlatform: () => 'ios' },
  CapacitorHttp: { get: vi.fn() },
  CapacitorCookies: { setCookie: vi.fn() },
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../../../utils/fileUrl', () => ({ normalizeFileUrl: (u: string) => u }));

/**
 * A null from fetchPdfBlob is what turns a reader tap into "Soubor se nepodařilo
 * otevřít" when the iPad holds a stale copy, and into the same message for a
 * file picked in the reader's sidebar. Its reasons were logged with
 * `console.log`, which the diagnostic log a report can attach never sees, so
 * suggestion #32 (iPad, 16 Oct) came in with no way to tell which it was.
 */
describe('fetchPdfBlob on Capacitor leaves a diagnostic for every null', () => {
  beforeEach(() => vi.clearAllMocks());

  it('when IS serves a page instead of a file', async () => {
    vi.mocked(fetchIsBinary).mockResolvedValue({ kind: 'page' } as never);
    const { result } = renderHook(() => useFileActions());
    await expect(result.current.fetchPdfBlob('slozka.pl?download=1')).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith('useFileActions.fetchPdfBlob', expect.any(Error));
    expect(vi.mocked(logError).mock.calls[0]?.[1]).toHaveProperty(
      'message',
      expect.stringMatching(/page/)
    );
  });

  it('when the bytes are not a PDF', async () => {
    vi.mocked(fetchIsBinary).mockResolvedValue({
      kind: 'binary',
      blob: new Blob(['PK\u0003\u0004 docx']),
      filename: 'a.docx',
    } as never);
    const { result } = renderHook(() => useFileActions());
    await expect(result.current.fetchPdfBlob('slozka.pl?download=1')).resolves.toBeNull();
    expect(vi.mocked(logError).mock.calls[0]?.[1]).toHaveProperty(
      'message',
      expect.stringMatching(/not a PDF/)
    );
  });

  it('when the fetch throws', async () => {
    vi.mocked(fetchIsBinary).mockRejectedValue(new Error('HTTP 500'));
    const { result } = renderHook(() => useFileActions());
    await expect(result.current.fetchPdfBlob('slozka.pl?download=1')).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith('useFileActions.fetchPdfBlob', expect.any(Error));
  });

  it('but returns a real PDF without a word', async () => {
    vi.mocked(fetchIsBinary).mockResolvedValue({
      kind: 'binary',
      blob: new Blob(['%PDF-1.7 …']),
      filename: 'a.pdf',
    } as never);
    const { result } = renderHook(() => useFileActions());
    await expect(result.current.fetchPdfBlob('slozka.pl?download=1')).resolves.not.toBeNull();
    expect(logError).not.toHaveBeenCalled();
  });
});
