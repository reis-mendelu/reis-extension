import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { useDocumentDownload } from '../useDocumentDownload';
import * as proxy from '../../../api/proxyClient';
import { DemoModeError } from '../../../errors/demoMode';
import { ShareCanceledError } from '../../../errors/shareCanceled';

describe('useDocumentDownload', () => {
  beforeEach(() => vi.useRealTimers());
  // cleanup() unmounts each hook so its done→idle timer-clearing effect runs —
  // otherwise the 2s setTimeout leaks and can fire mid-way through a later test.
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('drives a row loading → done on success', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockResolvedValue({ usedFallback: false });
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    expect(result.current.status['potvrzeni-cz']).toBe('loading');
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));
  });

  it('drives a row loading → error on failure', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('reg-arch', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['reg-arch']).toBe('error'));
  });

  // A demo block is not a failure of the download. Leaving the row in 'error'
  // put a red warning triangle next to a button that did exactly what it was
  // supposed to — which reads, to an App Store reviewer taking the demo, as a
  // broken app rather than an explained limit. The toast does the explaining.
  it('returns a demo-blocked row to idle rather than flagging an error', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new DemoModeError());
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('idle'));
  });

  /**
   * Cancelling the iOS save dialog is not a failed download.
   *
   * On iOS the file is written to Documents BEFORE the share sheet opens, so by
   * the time the student sees "where do you want this?" the download has
   * already succeeded. `@capacitor/share` reports a dismissal by rejecting, and
   * that rejection reached the generic catch: "when a file is downloaded
   * successfully from 'Studijni dokumenty' and I cancel the dialog (where to
   * save it), it just shows a warning icon. That makes little sense."
   */
  it('returns a cancelled save dialog to idle rather than flagging an error', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new ShareCanceledError());
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('idle'));
  });

  it("recognises the iOS plugin's own cancellation, not just the typed one", async () => {
    // What actually arrives from @capacitor/share when the sheet is dismissed.
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new Error('Share canceled'));
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('idle'));
  });

  it('says nothing when the student simply cancelled', async () => {
    const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as never);
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new ShareCanceledError());
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('idle'));
    expect(err).not.toHaveBeenCalled();
  });

  /**
   * A real failure has to be READABLE. The row's triangle could not be tapped
   * and carried no text — "I can't click the warning or anything to see what
   * it's about" — so the sentence is said at the moment it happens.
   */
  it('tells the student out loud when the download really failed', async () => {
    const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as never);
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new Error('Filesystem write failed'));
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('error'));
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('ignores a ghost re-click on a row already in flight', async () => {
    const spy = vi.spyOn(proxy, 'downloadDocument').mockResolvedValue({ usedFallback: false });
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clears the pending done→idle timer on unmount', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockResolvedValue({ usedFallback: false });
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));

    clearTimeoutSpy.mockClear();
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('warns the student when the UNSEALED document was saved instead', async () => {
    // The silent-downgrade guard: an unsealed copy can be refused by the office
    // the student takes it to, so the fallback must never be invisible.
    const warn = vi.spyOn(toast, 'warning').mockImplementation(() => '' as never);
    vi.spyOn(proxy, 'downloadDocument').mockResolvedValue({ usedFallback: true });
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf', 'https://x-plain');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the sealed document worked', async () => {
    const warn = vi.spyOn(toast, 'warning').mockImplementation(() => '' as never);
    vi.spyOn(proxy, 'downloadDocument').mockResolvedValue({ usedFallback: false });
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('prehled-cz', 'https://x', 'f.pdf', 'https://x-plain');
    });
    await waitFor(() => expect(result.current.status['prehled-cz']).toBe('done'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('passes the unsealed fallback URL through to the downloader', async () => {
    const spy = vi.spyOn(proxy, 'downloadDocument').mockResolvedValue({ usedFallback: false });
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://sealed', 'f.pdf', 'https://plain');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));
    expect(spy).toHaveBeenCalledWith('https://sealed', 'f.pdf', 'https://plain');
  });
});
