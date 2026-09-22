import { logError } from '../reportError';
import type { UserParams } from '../userParams';

type IdentityListener = (params: UserParams | null) => void;

const listeners = new Set<IdentityListener>();

/**
 * Announced when IS turns out to have a DIFFERENT student signed in than the
 * stored record describes — see `getUserParams`, which is the only caller.
 *
 * The local data has already been deleted by the time this fires. It exists
 * for the state a database wipe cannot reach: the Zustand store, which has
 * already hydrated the previous student's schedule, exams and subjects into
 * memory, where the screens read them synchronously.
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

export function announceIdentityChange(params: UserParams | null): void {
  for (const cb of listeners) {
    try {
      cb(params);
    } catch (e) {
      logError('getUserParams.onIdentityChange', e);
    }
  }
}
