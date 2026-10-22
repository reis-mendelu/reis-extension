import type { IDBPDatabase } from 'idb';

/** One put of an already-validated value, in whichever store it belongs to. */
export interface StoreWrite {
  store: string;
  key: string;
  value: unknown;
}

/**
 * Puts into several stores in ONE readwrite transaction: all of it lands or
 * none of it does. IndexedDBService.setAcross validates, then calls this.
 */
export async function putAcross(db: IDBPDatabase<unknown>, writes: StoreWrite[]): Promise<void> {
  const stores = [...new Set(writes.map((w) => w.store))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = db.transaction(stores as any, 'readwrite');
  // Every put is its own promise; an aborted transaction rejects each of
  // them, so each needs a handler or it surfaces as an unhandled rejection.
  const puts: Promise<unknown>[] = [];
  try {
    for (const w of writes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      puts.push(tx.objectStore(w.store as any).put(w.value as any, w.key));
    }
  } catch (err) {
    // A put that throws does not abort on its own: the puts before it
    // would still commit. Abort, so it really is all or nothing.
    for (const p of [...puts, tx.done]) p.catch(() => {});
    tx.abort();
    throw err;
  }
  await Promise.all([...puts, tx.done]);
}
