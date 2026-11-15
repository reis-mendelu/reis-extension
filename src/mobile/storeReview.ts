import { getPlatform } from '../platform';
import { isDemoMode } from '../errors/demoMode';
import { logError } from '../utils/reportError';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import {
  markAsked,
  noteDayUsed,
  shouldAskForReview,
  type StoreReviewState,
} from '../utils/storeReviewDecision';

/**
 * The OS's store-rating dialog on the phone and iPad. The rule for WHEN is in
 * utils/storeReviewDecision.ts; this file keeps the record and asks the OS.
 *
 * Nothing here reaches reIS: the record stays in IndexedDB on the device, and
 * whether the student rated, or even saw a dialog, is never known — neither OS
 * tells the app. So there is no feature counter and no disclosure change.
 *
 * The callers are shared code (useExamActions, useEduroamSetup), so every
 * entry point returns early outside Capacitor, and the plugin is imported
 * dynamically so it never enters the extension's static graph.
 */

/**
 * The success moments that may ask. One switch per moment, so choosing where
 * the dialog appears is an edit to this table, not a hunt through callers.
 */
export const STORE_REVIEW_MOMENTS = {
  /** A manual exam registration IS confirmed (useExamActions.handleRegister). */
  exam_registered: true,
  /** The OS saved the eduroam network reIS configured (useEduroamSetup.run). */
  eduroam_saved: true,
} as const;
export type StoreReviewMoment = keyof typeof STORE_REVIEW_MOMENTS;

/** Lets the success toast land and the sheet close before the OS dialog. */
export const ASK_DELAY_MS = 1500;

const KEY = 'store_review';

/** Prague calendar day, the day the daily count uses. */
function today(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function applies(): boolean {
  try {
    return getPlatform().kind === 'capacitor' && !isDemoMode();
  } catch {
    // No platform installed (a test, a bare page): not the app, so never ask.
    return false;
  }
}

async function read(): Promise<StoreReviewState | null> {
  return ((await IndexedDBService.get('meta', KEY)) as StoreReviewState | undefined) ?? null;
}

/** Counts today as a day of use. Called at boot and on every resume. */
export async function noteAppUsedToday(): Promise<void> {
  if (!applies()) return;
  try {
    const before = await read();
    const after = noteDayUsed(before, today());
    if (after !== before) await IndexedDBService.set('meta', KEY, after);
  } catch (e) {
    logError('Mobile.storeReview.noteDay', e);
  }
}

/** One ask at a time: two successes in a row must not stack two dialogs. */
let asking = false;

/**
 * Called right after a success moment. Returns whether it asked the OS — which
 * is not whether a dialog appeared: the OS decides that and does not say.
 */
export async function maybeAskForStoreReview(moment: StoreReviewMoment): Promise<boolean> {
  if (!STORE_REVIEW_MOMENTS[moment] || !applies() || asking) return false;
  asking = true;
  try {
    const state = await read();
    const day = today();
    if (!state || !shouldAskForReview(state, day)) {
      asking = false;
      return false;
    }
    // Written BEFORE the OS is asked, so a crash or a rejection cannot turn
    // into an ask on every following success.
    await IndexedDBService.set('meta', KEY, markAsked(state, day));
  } catch (e) {
    asking = false;
    logError('Mobile.storeReview', e);
    return false;
  }
  setTimeout(() => {
    void import('@capacitor-community/in-app-review')
      .then(({ InAppReview }) => InAppReview.requestReview())
      // Android rejects on any build not installed from Play.
      .catch((e: unknown) => logError('Mobile.storeReview', e))
      .finally(() => {
        asking = false;
      });
  }, ASK_DELAY_MS);
  return true;
}
