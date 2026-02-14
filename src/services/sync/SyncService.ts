import { IndexedDBService } from '../storage';

export type SyncStatus = { isSyncing: boolean; lastSync: number | null; error: string | null; };

/**
 * SyncService — Event bus for the iframe app.
 *
 * The content script (injector/syncService.ts) owns data fetching.
 * This class only manages listeners, status reads, and cross-context signaling.
 * The start()/syncAll() methods were removed as dead code — they were never called.
 */
class SyncServiceClass {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private listeners = new Set<(action?: string) => void>();
    private isSyncing = false;

    stop() { if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; } }

    subscribe(cb: (a?: string) => void) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
    async getStatus(): Promise<SyncStatus> { return { isSyncing: this.isSyncing, lastSync: await IndexedDBService.get('meta', 'last_sync'), error: await IndexedDBService.get('meta', 'sync_error') }; }
    setIsSyncing(v: boolean) { this.isSyncing = v; this.notifyListeners(); }
    triggerSync(payload?: unknown) { window.parent.postMessage({ type: 'REIS_ACTION', id: crypto.randomUUID(), action: 'trigger_sync', payload: payload || {} }, '*'); }
    triggerRefresh(a?: string) { this.notifyListeners(a); }
    private notifyListeners(a?: string) { this.listeners.forEach(cb => { try { cb(a); } catch (e) { console.error(e); } }); }
}

export const syncService = new SyncServiceClass();
