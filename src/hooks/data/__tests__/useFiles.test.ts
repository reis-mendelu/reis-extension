import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { useFiles } from '../useFiles';

/**
 * useFiles re-reads on `syncStatus.lastSync`, which until Návrhy #26 never
 * changed. Now that it does, every finished sync re-runs the open drawer's
 * effect — so the cost has to be bounded: a folder is crawled from IS at most
 * once per STALE_MS however many syncs end, and only for the drawer that is open.
 */

const CODE = 'EBC-PS';
const NOW = 1_700_000_000_000;

function endSync(lastSync: number) {
  act(() => {
    useAppStore.getState().setSyncStatus({ isSyncing: false, lastSync });
  });
}

describe('useFiles after a sync ends', () => {
  let refresh: Mock<(code: string) => Promise<void>>;
  let fetchFiles: Mock<(code: string) => Promise<void>>;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    // Stamps like the real action, so the second sync sees a fresh folder.
    refresh = vi.fn<(code: string) => Promise<void>>(async (code) => {
      useAppStore.setState((s) => ({
        lastFilesFetchedAt: { ...s.lastFilesFetchedAt, [code]: Date.now() },
      }));
    });
    fetchFiles = vi.fn<(code: string) => Promise<void>>(async () => undefined);
    useAppStore.setState({
      files: { [CODE]: [] },
      filesLoading: {},
      lastFilesFetchedAt: { [CODE]: NOW - 5 * 60_000 },
      refreshFilesForSubject: refresh,
      fetchFiles,
      syncStatus: {
        isSyncing: false,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('crawls the open folder at most once for two syncs a minute apart', () => {
    renderHook(() => useFiles(CODE));
    expect(refresh).toHaveBeenCalledTimes(1); // the open itself: cache is 5 min old

    vi.setSystemTime(NOW + 20_000);
    endSync(NOW + 20_000);
    vi.setSystemTime(NOW + 40_000);
    endSync(NOW + 40_000);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchFiles).toHaveBeenCalledTimes(2); // cache reads only
  });

  it('crawls again once the folder is stale — the retry after an outage', () => {
    renderHook(() => useFiles(CODE));
    vi.setSystemTime(NOW + 61_000);
    endSync(NOW + 61_000);

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a drawer that is not open', () => {
    renderHook(() => useFiles(undefined));
    endSync(NOW + 1);

    expect(refresh).not.toHaveBeenCalled();
    expect(fetchFiles).not.toHaveBeenCalled();
  });
});
