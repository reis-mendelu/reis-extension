import { getUserParams, isIdentityConfirmed, clearUserParamsCache } from '../../utils/userParams';
import { onIdentityChange } from '../../utils/userParams/identityEvents';
import { logError } from '../../utils/reportError';

/** Between attempts to reach IS for the identity check. */
const RETRY_GAP_MS = 20_000;
const ATTEMPTS = 3;

/** Lazy for the same reason `proxyClient` imports it lazily: it carries the
 *  Supabase client, which a boot that never switches students has no use for. */
async function clearAdminSessionLazily(): Promise<void> {
  const { clearAdminSession } = await import('../admin/clearAdminSession');
  await clearAdminSession();
}

/**
 * Watches for the signed-in student changing under the app's feet.
 *
 * `getUserParams()` owns the check itself — once per session it confirms with
 * IS that the stored record still describes whoever is signed in, and deletes
 * the local data when it does not. Two things are left for the app, and this
 * is both of them:
 *
 * 1. **Ask, and keep asking until IS answers.** The check only happens when
 *    something reads the params, and in the iframe almost nothing does at
 *    boot: this call and the daily-usage ping, once each. So a first attempt
 *    that fails — offline, a slow IS, the fetch proxy racing the content
 *    script's side of the handshake — would otherwise leave the previous
 *    student's data on screen until the next launch, with no later read to
 *    trigger the re-check `getUserParams` is prepared to do. (The content
 *    script needs none of this: its sync ticks re-read the params on their
 *    own.)
 * 2. **Drop the society login, then restart.** The wipe empties IndexedDB,
 *    but two things live outside it. The society/admin login is kept by
 *    supabase-js in `chrome.storage.local` — sign-out already drops it, and a
 *    switch without a sign-out has to as well, or the next student inherits
 *    the previous one's society console. And the store has already hydrated
 *    the previous student's schedule, exams and subjects into memory; re-running
 *    boot is what clears that — the same reasoning `mobile/signOut.ts`
 *    restarts on, instead of a hand-rolled teardown across forty slices.
 *
 *    No restart when the wipe itself failed: the previous record is still on
 *    disk, so a restart would find it, fail the same wipe and restart again.
 *
 * Only this listener clears the society login, and that covers every host:
 * the content script's IndexedDB is a separate copy, but the iframe holds its
 * own record and detects the switch independently, and `chrome.storage.local`
 * is shared between them.
 */
export function watchSignedInStudent(
  restart: () => void = () => window.location.reload(),
  {
    attempts = ATTEMPTS,
    gapMs = RETRY_GAP_MS,
    clearAdmin = clearAdminSessionLazily,
  }: { attempts?: number; gapMs?: number; clearAdmin?: () => Promise<void> } = {}
): () => void {
  let stopped = false;
  const off = onIdentityChange((_params, { wiped }) => {
    void (async () => {
      try {
        await clearAdmin();
      } catch (e) {
        logError('watchSignedInStudent.clearAdmin', e);
      }
      if (wiped) restart();
    })();
  });

  void (async () => {
    for (let attempt = 0; attempt < attempts && !stopped; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, gapMs));
        if (stopped) return;
        // Before the retry, not after: `getUserParams` serves its cached
        // record without asking IS again, so a retry that leaves the cache in
        // place asks nothing and the loop spins for free.
        clearUserParamsCache();
      }
      await getUserParams();
      if (isIdentityConfirmed()) return;
    }
  })();

  return () => {
    stopped = true;
    off();
  };
}
