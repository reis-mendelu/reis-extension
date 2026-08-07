import { toast } from 'sonner';
import { getPlatform } from '../platform';
import { TOKEN_KEY } from '../platform/tokenStore';
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

async function runRecovery(): Promise<string> {
  // ensureSession returns the stored token when it still looks plausible, and
  // a lapsed UISAuth looks exactly like a live one. Clearing first is what
  // makes this a re-login rather than a no-op that returns the dead token.
  await getPlatform().storage.remove(TOKEN_KEY);
  const token = await ensureSession(await buildInAppLoginDeps());

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

/** How long to wait for an in-flight sync before giving up on the re-sync. */
const RESYNC_IDLE_TIMEOUT_MS = 30_000;
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

  // Still busy after the deadline means a wedged run, which is its own problem;
  // calling anyway just no-ops, so record it rather than pretending it synced.
  if (sync.isSyncing) {
    logError('Mobile.recoverSession.resync', new Error('Sync still in flight; skipped re-sync'));
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
 */
export function promptSessionRecovery(): void {
  if (getPlatform().kind !== 'capacitor') return;

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
