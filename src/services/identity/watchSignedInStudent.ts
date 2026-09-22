import { getUserParams, onIdentityChange } from '../../utils/userParams';

/**
 * Watches for the signed-in student changing under the app's feet.
 *
 * `getUserParams()` owns the check itself — once per session it confirms with
 * IS that the stored record still describes whoever is signed in, and deletes
 * the local data when it does not. Two things are left for the app, and this
 * is both of them:
 *
 * 1. **Ask.** The check only happens when something reads the params, so a
 *    boot where nothing did would miss a switched student entirely.
 * 2. **Restart.** The wipe empties IndexedDB, but the store has already
 *    hydrated the previous student's schedule, exams and subjects into memory
 *    and the screens read it synchronously. Re-running boot is what clears
 *    that — the same reasoning `mobile/signOut.ts` restarts on, instead of a
 *    hand-rolled teardown across forty slices.
 */
export function watchSignedInStudent(
  restart: () => void = () => window.location.reload()
): () => void {
  const off = onIdentityChange(() => restart());
  void getUserParams();
  return off;
}
