import { toast } from 'sonner';
import { getPlatform } from '../platform';
import { clearStoredToken } from '../platform/tokenStore';
import { logError } from '../utils/reportError';
import { translate } from '../i18n/translate';
import { useAppStore } from '../store/useAppStore';
import { ensureSession } from './ensureSession';
import { buildInAppLoginDeps } from './inAppLoginDeps';

/**
 * Re-login after an IS session lapses.
 *
 * The extension answers a lapsed session by navigating the host page to
 * `login.pl` (`messageHandler.ts:203`). Capacitor has no host page to navigate,
 * so before this the app could only *say* the session had died — every
 * authenticated path was stuck until the student killed and reopened the app.
 *
 * Deliberately prompt-first: nothing here opens a login WebView on its own.
 * A sync fans out ~236 requests in the background, and having one of them throw
 * a full-screen login over whatever the student is reading is worse than a
 * stale panel.
 */

/** Shared so simultaneous failures replace one prompt instead of stacking. */
const PROMPT_ID = 'reis-session-expired';

/** In-flight recovery, so a fanned-out failure opens one login, not a dozen. */
let inFlight: Promise<string> | null = null;

/**
 * The token the last successful recovery installed, used to tell a live failure
 * from a straggler.
 *
 * Never logged, never sent anywhere — it exists only to be compared by identity
 * with the token a failing request used.
 */
let activeToken: string | null = null;

async function runRecovery(): Promise<string> {
  // ensureSession returns the stored token when it still looks plausible, and
  // a lapsed UISAuth looks exactly like a live one. Clearing first is what
  // makes this a re-login rather than a no-op that returns the dead token.
  await clearStoredToken();
  const token = await ensureSession(await buildInAppLoginDeps());

  activeToken = token;
  // The prompt is `duration: Infinity` with a stable id, so it does NOT go away
  // on its own once the student has signed back in. Left up, it invites a
  // second tap that would clear the token they just obtained.
  toast.dismiss(PROMPT_ID);

  // Re-sync. Whatever failed during the lapse left the store holding
  // pre-expiry data, and without this it would sit there until the next
  // SYNC_INTERVAL tick or app resume — so a student who just signed back in
  // would still be looking at stale exams and grades.
  //
  // Lazily imported and fire-and-forget: recovery has already succeeded by
  // this point, so a failing sync must not turn it into a failure, and the
  // static import would pull the sync graph into the app's login path.
  void resyncWhenIdle().catch((e) => logError('Mobile.recoverSession.resync', e));

  return token;
}

/**
 * How long to wait for an in-flight sync before giving up on the re-sync.
 *
 * Sized against `SYNC_INTERVAL` (5 min), not guessed: past that point the
 * periodic run fires on its own and waiting longer buys nothing. 30 s was too
 * short — a full sync is ~236 requests, which on mobile data can easily run
 * past it.
 *
 * A bound is needed at all because `isSyncing` is not guaranteed to clear:
 * `syncAllData` sets it and then calls `sendToIframe` BEFORE entering its
 * `try`, so a throw there leaves the flag stuck true and its `finally` never
 * runs. Waiting unbounded on that would spin for the life of the app.
 */
const RESYNC_IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const RESYNC_POLL_MS = 250;

/**
 * Runs a sync once no other run owns it.
 *
 * `syncAllData` opens with `if (isSyncing) return` — so calling it straight
 * after login is a coin flip: the very run that DETECTED the lapse is often
 * still winding down its ~236 requests, and the re-sync would be dropped
 * silently, leaving the student staring at pre-expiry data they just signed in
 * to refresh.
 *
 * The module object is kept whole rather than destructured: `isSyncing` is an
 * exported `let`, and destructuring would snapshot it instead of reading the
 * live binding — which would busy-wait forever or not at all.
 */
async function resyncWhenIdle(): Promise<void> {
  const sync = await import('../injector/syncService');

  const deadline = Date.now() + RESYNC_IDLE_TIMEOUT_MS;
  while (sync.isSyncing && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, RESYNC_POLL_MS));
  }

  // Still busy after the deadline. The data is not lost — the periodic run
  // (SYNC_INTERVAL) picks it up within a few minutes — but the student sees
  // pre-expiry data until then, so this is recorded rather than swallowed.
  if (sync.isSyncing) {
    logError(
      'Mobile.recoverSession.resync',
      new Error('Sync still in flight past the deadline; leaving it to the periodic run')
    );
    return;
  }

  await sync.syncAllData();
}

/**
 * Runs the login WebView and stores the new token. Resolves to whether a
 * session was obtained — never throws, because every caller is already a catch
 * block that has given up on its own request, and a dismissed login is a
 * choice rather than a fault.
 */
export async function recoverSession(): Promise<boolean> {
  if (getPlatform().kind !== 'capacitor') return false;

  if (!inFlight) {
    inFlight = runRecovery().finally(() => {
      inFlight = null;
    });
  }

  try {
    await inFlight;
    return true;
  } catch (e) {
    logError('Mobile.recoverSession', e);
    return false;
  }
}

/**
 * Tells the student their session expired and offers to sign back in.
 *
 * Safe to call from anywhere that catches a `sessionExpired` error, including
 * non-React code — the string is resolved through `translate` against the
 * store's current language rather than a hook.
 *
 * `failedToken` is the token the failing request actually used. A sync fans out
 * ~236 requests, and one issued BEFORE a re-login can land well after it — that
 * response is unauthenticated because its token is dead, not because the
 * current session is. Prompting on it would offer to repair a session that is
 * already healthy, and accepting would delete the token the student had just
 * obtained and send them through the login again.
 *
 * Comparing tokens rather than waiting out a grace period keeps this exact:
 * there is no window to tune, and a genuine second lapse — which carries the
 * CURRENT token — still prompts.
 */
export function promptSessionRecovery(failedToken?: string): void {
  if (getPlatform().kind !== 'capacitor') return;

  // Only suppress when we can prove the failure belongs to a superseded
  // session. Before any recovery has run, activeToken is null and everything
  // through — a failure must never be swallowed for lack of information.
  if (failedToken && activeToken && failedToken !== activeToken) return;

  const language = useAppStore.getState().language;
  toast.error(translate(language, 'session.expired'), {
    id: PROMPT_ID,
    // No auto-dismiss: this is the one message that is useless if missed.
    duration: Infinity,
    action: {
      label: translate(language, 'session.signIn'),
      onClick: () => {
        void recoverSession();
      },
    },
  });
}
