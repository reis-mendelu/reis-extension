/**
 * useFiles - Hook to access subject files from storage.
 * 
 * Returns stored files immediately and subscribes to sync updates.
 */

import { useState, useEffect } from 'react';
import { syncService } from '../../services/sync';
import { IndexedDBService } from '../../services/storage';
import type { ParsedFile } from '../../types/documents';

export interface UseFilesResult {
    files: ParsedFile[] | null;
    isLoading: boolean;
}

export function useFiles(courseCode: string | undefined): UseFilesResult {
    const [files, setFiles] = useState<ParsedFile[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!courseCode) {
            setFiles(null);
            setIsLoading(false);
            return;
        }

        const loadData = async () => {
             setIsLoading(true);
             try {
                 // Load from IndexedDB
                 const data = await IndexedDBService.get('files', courseCode);
                 
                 setFiles(data || []);
             } catch (error) {
                 console.error('[useFiles] Failed to load files:', error);
                 setFiles(null); 
             } finally {
                 setIsLoading(false);
             }
        };

        // Initial load
        loadData();

        // Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            loadData();
        });

        return unsubscribe;
    }, [courseCode]);

    return { files, isLoading };
}
