import { useState, useEffect } from 'react';
import { IndexedDBService } from '../services/storage';
import type { StudyProgramData } from '../api/studyProgram';
import { syncService } from '../services/sync';

export function useStudyProgram() {
    const [data, setData] = useState<StudyProgramData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log('[useStudyProgram] Hook mounted, loading data...');
        loadData();
        
        // Listen for sync updates
        const handleSyncUpdate = (action?: string) => {
            if (action === 'STUDY_PROGRAM_UPDATE') {
                console.log('[useStudyProgram] Received update signal, reloading...');
                loadData();
            }
        };

        // Subscribe to synchronous updates
        const unsubscribe = syncService.subscribe(handleSyncUpdate);
        
        return () => {
            unsubscribe();
        };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            console.log('[useStudyProgram] Fetching from IndexedDB...');
            let programData: StudyProgramData | null | undefined = await IndexedDBService.get('study_program', 'current');
            
            if (programData) {
                console.log('[useStudyProgram] ✅ Data found');
                setData(programData);
            } else {
                console.warn('[useStudyProgram] ⚠️ No data found in any storage');
            }
        } catch (err) {
            console.error("[useStudyProgram] ❌ Failed to load study program:", err);
            setError("Failed to load study program data.");
        } finally {
            setLoading(false);
        }
    };

    const sync = async () => {
        try {
            setLoading(true);
            await syncService.triggerSync();
        } catch (err) {
            console.error("[useStudyProgram] ❌ Background sync failed:", err);
        } finally {
            // Loading will be finished by the loadData call or the update signal
        }
    };

    return { data, loading, error, reload: loadData, sync };
}
