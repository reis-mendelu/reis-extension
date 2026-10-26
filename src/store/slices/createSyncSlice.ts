import type { SyncSlice, AppSlice } from '../types';

export const createSyncSlice: AppSlice<SyncSlice> = (set) => {
  setTimeout(() => {
    set((state) => ({
      syncStatus: { ...state.syncStatus, handshakeTimedOut: true },
    }));
  }, 10000);

  return {
    syncStatus: {
      isSyncing: false,
      lastSync: null,
      error: null,
      handshakeDone: false,
      handshakeTimedOut: false,
    },
    isSyncing: true,
    firstSyncSettled: false,
    syncLoaded: {},
    markSyncLoaded: (domains) =>
      set((state) => ({
        syncLoaded: { ...state.syncLoaded, ...Object.fromEntries(domains.map((d) => [d, true])) },
      })),
    // Boot only: the previous session's stamp, so diagnostics and the drawers
    // have a value before the first run ends. Writes nothing once a sync has
    // delivered one — the IndexedDB read races the first REIS_SYNC_UPDATE —
    // and touches nothing else: the handshake and isSyncing belong to the sync.
    seedLastSync: (lastSync) =>
      set((state) =>
        state.syncStatus.lastSync === null
          ? { syncStatus: { ...state.syncStatus, lastSync } }
          : state
      ),
    setSyncStatus: (status) =>
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          // A run that is starting has not failed yet. useAppLogic forwards
          // REIS_SYNC_UPDATE as `{ isSyncing }` alone, so without this the
          // merge carried the previous run's error into the retry and the
          // screens keying off it stayed on their failure state throughout.
          ...(status.isSyncing === true ? { error: null } : {}),
          ...status,
          handshakeDone: true,
        },
        isSyncing: status.isSyncing !== undefined ? status.isSyncing : state.isSyncing,
        // `isSyncing: false` is the only message that means a crawl
        // finished. Latched, never cleared: once a sync has completed, an
        // empty screen is the truth and later runs must not put a skeleton
        // back over it every fifteen minutes.
        firstSyncSettled: state.firstSyncSettled || status.isSyncing === false,
      })),
  };
};
