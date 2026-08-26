import type { SyncSlice, AppSlice } from '../types';
import { syncService } from '../../services/sync';

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
    fetchSyncStatus: async () => {
      const currentStatus = await syncService.getStatus();
      set((state) => ({
        syncStatus: {
          ...currentStatus,
          handshakeDone: false,
          handshakeTimedOut: state.syncStatus.handshakeTimedOut,
        },
        isSyncing: currentStatus.isSyncing,
      }));
    },
    setSyncStatus: (status) =>
      set((state) => ({
        syncStatus: { ...state.syncStatus, ...status, handshakeDone: true },
        isSyncing: status.isSyncing !== undefined ? status.isSyncing : state.isSyncing,
        // `isSyncing: false` is the only message that means a crawl
        // finished. Latched, never cleared: once a sync has completed, an
        // empty screen is the truth and later runs must not put a skeleton
        // back over it every fifteen minutes.
        firstSyncSettled: state.firstSyncSettled || status.isSyncing === false,
      })),
  };
};
