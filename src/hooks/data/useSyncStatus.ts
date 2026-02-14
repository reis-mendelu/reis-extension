import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import type { SyncStatus } from '../../services/sync';

/**
 * useSyncStatus - Hook to access sync service status from store.
 *
 * Provides real-time visibility into sync state via central store.
 */
export function useSyncStatus(): SyncStatus {
    return useAppStore(useShallow(state => state.syncStatus));
}
