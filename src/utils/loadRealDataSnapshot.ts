import { Messages } from '../types/messages';
import type { SyncedData } from '../types/messages';
import { isInIframe } from '../api/proxyClient';

const SNAPSHOT_URL = '/.dev-real-data.json';

/** Dev-only, standalone-only: load the scraped real-data snapshot and feed it
 *  through the production REIS_SYNC_UPDATE handler. No-op if unavailable. */
export async function loadRealDataSnapshot(): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  if (isInIframe()) return false;
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return false;
  try {
    const res = await fetch(SNAPSHOT_URL);
    if (!res.ok) return false;
    const snapshot = (await res.json()) as SyncedData;
    window.postMessage(Messages.syncUpdate({ ...snapshot, isSyncing: false }), '*');
    return true;
  } catch {
    return false;
  }
}
