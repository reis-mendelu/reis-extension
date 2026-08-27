import { IndexedDBService } from '../storage';
// Built through the typed factory, not by hand: a hand-written literal is not
// checked against ActionType, which is how 'push_notes_html' reached the
// boundary as an action the validator rejected.
import { Messages } from '../../types/messages';

export type SyncStatus = {
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
  handshakeDone?: boolean;
  handshakeTimedOut?: boolean;
};

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

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  subscribe(cb: (a?: string) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  async getStatus(): Promise<SyncStatus> {
    return {
      isSyncing: this.isSyncing,
      lastSync: await IndexedDBService.get('meta', 'last_sync'),
      error: await IndexedDBService.get('meta', 'sync_error'),
    };
  }
  setIsSyncing(v: boolean) {
    this.isSyncing = v;
    this.notifyListeners();
  }
  triggerSync(payload?: unknown) {
    window.parent.postMessage(Messages.action('trigger_sync', payload || {}), '*');
  }
  /** Kick a Drive backup immediately using already-cached file listings (no full IS re-crawl). */
  triggerDriveBackup() {
    window.parent.postMessage(Messages.action('trigger_drive_backup', {}), '*');
  }
  triggerExamRefresh() {
    window.parent.postMessage(Messages.action('refresh_exams', {}), '*');
  }
  triggerRefresh(a?: string) {
    this.notifyListeners(a);
  }
  private notifyListeners(a?: string) {
    this.listeners.forEach((cb) => {
      try {
        cb(a);
      } catch {
        /* listener error */
      }
    });
  }
}

export const syncService = new SyncServiceClass();
