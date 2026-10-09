import { getPlatform } from '../../platform';
import type { SyncState } from './runSync';

const KEY = 'reis.gcal.state';
export type PersistedSync = SyncState & { enabled: boolean; sourcesFingerprint: string | null };
const EMPTY: PersistedSync = {
  enabled: false,
  calendarId: null,
  held: {},
  lastSyncAt: null,
  pastFillPending: false,
  reisDeleted: {},
  skipped: {},
  sourcesFingerprint: null,
};

export async function loadSyncState(): Promise<PersistedSync> {
  const v = (await getPlatform().storage.get(KEY)) as Partial<PersistedSync> | null;
  return { ...EMPTY, ...(v ?? {}) };
}
export async function saveSyncState(s: PersistedSync): Promise<void> {
  await getPlatform().storage.set(KEY, s);
}
export async function clearSyncState(): Promise<void> {
  await getPlatform().storage.remove(KEY);
}
