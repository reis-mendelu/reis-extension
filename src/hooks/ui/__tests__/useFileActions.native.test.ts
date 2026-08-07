import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { useFileActions } from '../useFileActions';
import { isNativeHost, openIsFileNatively } from '../../../mobile/openIsFile';
import { logError } from '../../../utils/reportError';
import { promptSessionRecovery } from '../../../mobile/sessionRecovery';

vi.mock('../../../mobile/openIsFile', () => ({
  isNativeHost: vi.fn(() => true),
  openIsFileNatively: vi.fn(async () => ({ usedFallback: false, delivered: 'downloads' })),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

vi.mock('../../../mobile/sessionRecovery', () => ({ promptSessionRecovery: vi.fn() }));

vi.mock('../../../utils/fileUrl', () => ({
  normalizeFileUrl: (url: string) => url,
}));

const expired = () => {
  const err = new Error('HTTP 401') as Error & { sessionExpired?: boolean };
  err.sessionExpired = true;
  return err;
};

describe('useFileActions on Capacitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isNativeHost).mockReturnValue(true);
    vi.mocked(openIsFileNatively).mockResolvedValue({
      usedFallback: false,
      delivered: 'downloads',
    });
    global.fetch = vi.fn();
  });

  // Pins the migration itself. IS denies CORS to every origin, so a browser
  // fetch from the app's own origin cannot reach it — and the catch below it
  // falls through to window.open, which on Capacitor hands the URL to the
  // SYSTEM BROWSER, where there is no IS session.
  it.each([['openFile'], ['downloadSingle']] as const)(
    '%s goes native and never touches the browser fetch',
    async (method) => {
      const { result } = renderHook(() => useFileActions());

      await act(async () => {
        await result.current[method]('slozka.pl?download=1');
      });

      expect(openIsFileNatively).toHaveBeenCalledWith('slozka.pl?download=1');
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  // Every caller drops the returned promise — the prop type is
  // `(link: string) => void` (FileListItem.tsx:31). A rejection here does not
  // reach a catch anywhere; it becomes an unhandled rejection that
  // installErrorReporter turns into a telemetry report, while the student sees
  // a tap that silently does nothing.
  it.each([
    ['openFile', 'useFileActions.openFile'],
    ['downloadSingle', 'useFileActions.downloadSingle'],
  ] as const)(
    '%s settles instead of rejecting when the native fetch fails',
    async (method, ctx) => {
      vi.mocked(openIsFileNatively).mockRejectedValue(new Error('IS did not return a file'));
      const { result } = renderHook(() => useFileActions());

      await act(async () => {
        await expect(result.current[method]('slozka.pl?download=1')).resolves.toBeUndefined();
      });

      expect(logError).toHaveBeenCalledWith(ctx, expect.any(Error));
    }
  );

  it.each([['openFile'], ['downloadSingle']] as const)(
    '%s tells the student the file could not be opened',
    async (method) => {
      vi.mocked(openIsFileNatively).mockRejectedValue(new Error('IS did not return a file'));
      const { result } = renderHook(() => useFileActions());

      await act(async () => {
        await result.current[method]('slozka.pl?download=1');
      });

      expect(toast.error).toHaveBeenCalledWith('Soubor se nepodařilo otevřít.');
    }
  );

  // A lapsed session shows no toast from here. fetchIsBinary already raised
  // the recovery prompt when it minted the error — and did so WITH the token
  // the request used, which is what lets a straggler from a superseded session
  // be filtered out. Re-prompting from here would pass no token and defeat it.
  it.each([['openFile'], ['downloadSingle']] as const)(
    '%s stays silent on a lapsed session, leaving the prompt to the transport',
    async (method) => {
      vi.mocked(openIsFileNatively).mockRejectedValue(expired());
      const { result } = renderHook(() => useFileActions());

      await act(async () => {
        await result.current[method]('slozka.pl?download=1');
      });

      expect(promptSessionRecovery).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    }
  );

  it('leaves the desktop path alone — no toast, browser fetch still used', async () => {
    vi.mocked(isNativeHost).mockReturnValue(false);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf']),
      headers: new Map(),
    });
    global.URL.createObjectURL = vi.fn(() => 'blob:x');
    global.URL.revokeObjectURL = vi.fn();
    window.open = vi.fn();

    const { result } = renderHook(() => useFileActions());
    await act(async () => {
      await result.current.openFile('slozka.pl?download=1');
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(openIsFileNatively).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
