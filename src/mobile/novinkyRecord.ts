import { IndexedDBService } from '../services/storage/IndexedDBService';

/** The 'meta' key holding the row ids already notified, per source. */
export const NOVINKY_NOTIFIED_KEY = 'novinky_notified';

/** Per source; a source with no key has no record yet (its silent first run). */
export interface Notified {
  alerts?: string[];
  feed?: string[];
  notices?: string[];
}

export async function readRecord(): Promise<Notified> {
  return ((await IndexedDBService.get('meta', NOVINKY_NOTIFIED_KEY)) ?? {}) as Notified;
}

/**
 * Only the sources that have a record: IndexedDB's meta schema drops a whole
 * value holding an undefined, and a dropped record would make every later run
 * the silent first run.
 */
export function saveRecord(r: Notified): Promise<void> {
  const record: Notified = {};
  if (r.alerts) record.alerts = r.alerts;
  if (r.feed) record.feed = r.feed;
  if (r.notices) record.notices = r.notices;
  return IndexedDBService.set('meta', NOVINKY_NOTIFIED_KEY, record);
}

export function deleteRecord(): Promise<void> {
  return IndexedDBService.delete('meta', NOVINKY_NOTIFIED_KEY);
}
