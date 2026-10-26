import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

describe('setSyncStatus', () => {
  beforeEach(() => {
    useAppStore.setState({
      firstSyncSettled: false,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
  });

  it('clears the previous error when a retry starts', () => {
    // useAppLogic forwards REIS_SYNC_UPDATE as `{ isSyncing }` alone, so the
    // merge used to carry the failed run's error into the retry — and the
    // screens that key their failure state off `syncStatus.error` kept showing
    // it for the whole retry, over a sync that had not failed yet.
    useAppStore.setState({
      syncStatus: { ...useAppStore.getState().syncStatus, error: 'boom' },
    });

    useAppStore.getState().setSyncStatus({ isSyncing: true });

    expect(useAppStore.getState().syncStatus.error).toBeNull();
  });

  it('keeps an error that the same update carries', () => {
    useAppStore.getState().setSyncStatus({ isSyncing: true, error: 'still broken' });
    expect(useAppStore.getState().syncStatus.error).toBe('still broken');
  });

  it('leaves the error alone when a run reports back finished', () => {
    useAppStore.getState().setSyncStatus({ isSyncing: false, error: 'boom' });
    expect(useAppStore.getState().syncStatus.error).toBe('boom');
    expect(useAppStore.getState().firstSyncSettled).toBe(true);
  });
});

describe('seedLastSync', () => {
  beforeEach(() => {
    useAppStore.setState({
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: false,
        handshakeTimedOut: false,
      },
    });
  });

  it('fills lastSync from the cache while the store has none', () => {
    useAppStore.getState().seedLastSync(1_600_000_000_000);
    expect(useAppStore.getState().syncStatus.lastSync).toBe(1_600_000_000_000);
  });

  it('never overwrites a value a sync already delivered', () => {
    // The IndexedDB read races the first REIS_SYNC_UPDATE. A seed resolving
    // second must not roll the store back to the previous session's stamp.
    useAppStore.getState().setSyncStatus({ isSyncing: false, lastSync: 1_700_000_000_000 });
    useAppStore.getState().seedLastSync(1_600_000_000_000);
    expect(useAppStore.getState().syncStatus.lastSync).toBe(1_700_000_000_000);
  });

  it('touches nothing but lastSync — not the handshake, not isSyncing', () => {
    useAppStore.getState().seedLastSync(1_600_000_000_000);
    const s = useAppStore.getState();
    expect(s.syncStatus.handshakeDone).toBe(false);
    expect(s.syncStatus.isSyncing).toBe(true);
  });
});
