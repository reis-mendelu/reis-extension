import { IndexedDBService } from '../storage';
import { syncExams } from './syncExams';
import { syncSchedule } from './syncSchedule';
import { syncSubjects } from './syncSubjects';
import { syncFiles } from './syncFiles';
import { syncAssessments } from './syncAssessments';
import { syncSyllabus } from './syncSyllabus';
import { migrateAndCleanup } from './SyncMigration';

const SYNC_INTERVAL = 300000;
export type SyncStatus = { isSyncing: boolean; lastSync: number | null; error: string | null; };

class SyncServiceClass {
    private intervalId: any = null;
    private listeners = new Set<(action?: string) => void>();
    private isSyncing = false;

    async start() {
        if (this.intervalId) return;
        await migrateAndCleanup();
        this.syncAll();
        this.intervalId = setInterval(() => this.syncAll(), SYNC_INTERVAL);
    }

    stop() { if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; } }

    async syncAll() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        await IndexedDBService.set('meta', 'sync_in_progress', true);
        try {
            await Promise.allSettled([syncSchedule(), syncExams(), syncSubjects()]);
            await Promise.allSettled([syncAssessments(), syncSyllabus(), syncFiles()]);
            await IndexedDBService.set('meta', 'last_sync', Date.now());
            await IndexedDBService.delete('meta', 'sync_error');
            this.notifyListeners();
        } catch (e) {
            console.error(e);
            await IndexedDBService.set('meta', 'sync_error', e instanceof Error ? e.message : 'Unknown error');
        } finally {
            this.isSyncing = false;
            await IndexedDBService.delete('meta', 'sync_in_progress');
        }
    }

    subscribe(cb: (a?: string) => void) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
    async getStatus(): Promise<SyncStatus> { return { isSyncing: this.isSyncing, lastSync: await IndexedDBService.get('meta', 'last_sync'), error: await IndexedDBService.get('meta', 'sync_error') }; }
    setIsSyncing(v: boolean) { this.isSyncing = v; this.notifyListeners(); }
    triggerSync() { window.parent.postMessage({ type: 'REIS_ACTION', id: crypto.randomUUID(), action: 'trigger_sync', payload: {} }, '*'); }
    triggerRefresh(a?: string) { this.notifyListeners(a); }
    private notifyListeners(a?: string) { this.listeners.forEach(cb => { try { cb(a); } catch (e) { console.error(e); } }); }
}

export const syncService = new SyncServiceClass();
