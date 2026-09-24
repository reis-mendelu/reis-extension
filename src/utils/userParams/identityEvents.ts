import { logError } from '../reportError';
import type { UserParams } from '../userParams';

/**
 * `wiped` says whether the local data really was deleted. It is false only
 * when the wipe itself failed, in which case the previous student's record is
 * still on disk and a restart would just rediscover it — see `getUserParams`.
 */
export interface IdentityChange {
  wiped: boolean;
}

type IdentityListener = (params: UserParams | null, change: IdentityChange) => void;

const listeners = new Set<IdentityListener>();

/**
 * Announced when IS turns out to have a DIFFERENT student signed in than the
 * stored record describes — see `getUserParams`, which is the only caller.
 *
 * It exists for the state a database wipe cannot reach: the Zustand store,
 * which has already hydrated the previous student's schedule, exams and
 * subjects into memory, and the society login, which supabase-js keeps in
 * `chrome.storage.local` rather than IndexedDB.
 *
 * A listener that throws is logged and skipped rather than allowed to stop the
 * others — this runs on the path that has just wiped the device, and a broken
 * subscriber must not leave the rest of the app unaware.
 */
export function onIdentityChange(cb: IdentityListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function announceIdentityChange(params: UserParams | null, change: IdentityChange): void {
  for (const cb of listeners) {
    try {
      cb(params, change);
    } catch (e) {
      logError('getUserParams.onIdentityChange', e);
    }
  }
}
