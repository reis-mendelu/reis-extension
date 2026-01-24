/**
 * useSyncStatus - Hook to access sync service status.
 * 
 * Provides real-time visibility into sync state.
 */

import { useState, useEffect } from 'react';
import { syncService, type SyncStatus } from '../../services/sync';

export function useSyncStatus(): SyncStatus {
    const [status, setStatus] = useState<SyncStatus>({
        isSyncing: false,
        lastSync: null,
        error: null
    });

    useEffect(() => {
        const fetchStatus = async () => {
            const currentStatus = await syncService.getStatus();
            setStatus(currentStatus);
        };

        void fetchStatus();

        // Refresh status when sync completes
        const unsubscribe = syncService.subscribe(() => {
            void fetchStatus();
        });

        // Also poll periodically for isSyncing changes
        const interval = setInterval(() => {
            void fetchStatus();
        }, 1000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    return status;
}
