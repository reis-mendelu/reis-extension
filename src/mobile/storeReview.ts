import { getPlatform } from '../platform';
import { isDemoMode } from '../errors/demoMode';
import { logError } from '../utils/reportError';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import {
  markAsked,
  noteDayUsed,
  filesToCredit,
  noteFilesOpened,
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
 * Some callers are shared code (useExamActions), so every
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
  /**
   * reIS's PDF reader closed after 30 s or more, once 3 such sessions have
   * been counted in all (storeReviewAfterReaderClosed). Asked after the reader is gone, never as a
   * file opens. Only the readers count: a file handed to the iOS share sheet or
   * saved into Android's Downloads never shows in reIS, and the share sheet can
   * send the student into another app, where an ask would be wasted.
   */
  file_reader_closed: true,
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
    const needsFiles = moment === 'file_reader_closed';
    if (!state || !shouldAskForReview(state, day, { needsFiles })) {
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

/**
 * The file moment. Called once reIS's reader has closed and the screen under it
 * is back: the iPad's PencilKit reader resolves its `open` on Close, the pdf.js
 * viewer on the phone calls closePreview. `openMs` is how long the reader was
 * up, `filesShown` how many files it showed (the PencilKit sidebar can show
 * several). A session under 30 s counts nothing and asks nothing, so closing
 * file 3 to open file 4 never brings up stars.
 */
export async function storeReviewAfterReaderClosed(
  openMs: number,
  filesShown: number
): Promise<boolean> {
  if (!applies()) return false;
  const credited = filesToCredit(openMs, filesShown);
  if (credited === 0) return false;
  try {
    const before = await read();
    const after = noteFilesOpened(before, today(), credited);
    if (after !== before) await IndexedDBService.set('meta', KEY, after);
  } catch (e) {
    logError('Mobile.storeReview.noteFile', e);
    return false;
  }
  return maybeAskForStoreReview('file_reader_closed');
}
