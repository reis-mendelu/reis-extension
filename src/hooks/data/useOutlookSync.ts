/**
 * useOutlookSync - Hook for Outlook calendar sync status.
 * 
 * Provides current sync status and toggle function.
 */

import { useState, useEffect, useCallback } from 'react';
import { outlookSyncService } from '../../services/sync';

export interface UseOutlookSyncResult {
    /** Current sync status (null = still loading) */
    isEnabled: boolean | null;
    /** Whether status is being checked/updated */
    isLoading: boolean;
    /** Toggle sync on/off */
    toggle: () => Promise<void>;
    /** Enable sync explicitly */
    enable: () => Promise<void>;
    /** Disable sync explicitly */
    disable: () => Promise<void>;
}

export function useOutlookSync(): UseOutlookSyncResult {
    const [isEnabled, setIsEnabled] = useState<boolean | null>(
        outlookSyncService.getStatus()
    );
    const [isLoading, setIsLoading] = useState(
        outlookSyncService.isRefreshing()
    );

    useEffect(() => {
        // Subscribe to status changes
        const unsubscribe = outlookSyncService.subscribe((status) => {
            setIsEnabled(status);
            setIsLoading(outlookSyncService.isRefreshing());
        });

        // Poll for loading state changes
        const interval = setInterval(() => {
            setIsLoading(outlookSyncService.isRefreshing());
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    const toggle = useCallback(async () => {
        setIsLoading(true);
        await outlookSyncService.toggle();
        setIsLoading(false);
    }, []);

    const enable = useCallback(async () => {
        if (outlookSyncService.getStatus()) return; // Already enabled
        setIsLoading(true);
        await outlookSyncService.enable();
        setIsLoading(false);
    }, []);

    const disable = useCallback(async () => {
        if (!outlookSyncService.getStatus()) return; // Already disabled
        setIsLoading(true);
        await outlookSyncService.disable();
        setIsLoading(false);
    }, []);

    return { isEnabled, isLoading, toggle, enable, disable };
}
