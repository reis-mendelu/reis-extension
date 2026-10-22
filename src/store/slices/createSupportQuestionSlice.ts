import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

/**
 * The "would you support reIS?" question, asked as a row in Novinky on both
 * trees (2026-10-22; it was a line in Profil before).
 *
 * Its answer is kept on this device and nowhere else. "Ano" is ALSO counted,
 * by `SupportPrompt`, through the whitelisted `support_prompt_yes` signal;
 * "Ne" is counted nowhere — a counter for it would be a new feature label,
 * which needs a migration and a disclosure. This slice never talks to Supabase.
 *
 * - `loading` until boot has read the saved record: nothing shows and nothing
 *   badges, or a student who answered last week would see the row flash and
 *   a phantom badge on every cold start.
 * - `badgeSeen` is the bell. Opening Novinky clears it, as it does for every
 *   other row; the row itself stays until it is answered.
 */
export type SupportQuestionStatus = 'loading' | 'open' | 'yes' | 'dismissed';

export interface SupportQuestionSlice {
  supportQuestion: { status: SupportQuestionStatus; badgeSeen: boolean };
  loadSupportQuestion: () => Promise<void>;
  markSupportQuestionSeen: () => Promise<void>;
  /**
   * `delivered` is the "yes" counter's write. A "yes" it reports as failed is
   * not remembered, so a later launch asks — and counts — again.
   */
  answerSupportQuestion: (
    answer: 'yes' | 'dismissed',
    delivered?: Promise<boolean | void>
  ) => Promise<void>;
}

/**
 * Two keys, not one record. Each write then touches only its own key, so no
 * write has to read-merge-write anything: a second extension tab clearing its
 * badge cannot put back a record without the answer another tab just saved.
 */
const ANSWER_KEY = 'support_question_answer';
const BADGE_KEY = 'support_question_badge_seen';

/**
 * Failures are logged locally and swallowed. A failed read falls back to
 * "never asked" — the worst case is the row once more; a failed write leaves
 * the answer in memory for this session. Neither may surface as an unhandled
 * rejection from a tap.
 */
async function readSaved(): Promise<SupportQuestionSlice['supportQuestion']> {
  try {
    const [answer, badgeSeen] = await Promise.all([
      IndexedDBService.get('meta', ANSWER_KEY),
      IndexedDBService.get('meta', BADGE_KEY),
    ]);
    const status = answer === 'yes' || answer === 'dismissed' ? answer : 'open';
    return { status, badgeSeen: badgeSeen === true };
  } catch (err) {
    logError('SupportQuestionSlice.load', err);
    return { status: 'open', badgeSeen: false };
  }
}

async function write(context: string, entries: Array<readonly [string, unknown]>): Promise<void> {
  try {
    await IndexedDBService.setMany('meta', entries);
  } catch (err) {
    logError(context, err);
  }
}

export const createSupportQuestionSlice: AppSlice<SupportQuestionSlice> = (set, get) => ({
  supportQuestion: { status: 'loading', badgeSeen: false },

  loadSupportQuestion: async () => {
    set({ supportQuestion: await readSaved() });
  },

  markSupportQuestionSeen: async () => {
    if (get().supportQuestion.badgeSeen) return;
    set({ supportQuestion: { ...get().supportQuestion, badgeSeen: true } });
    await write('SupportQuestionSlice.markSeen', [[BADGE_KEY, true]]);
  },

  answerSupportQuestion: async (answer, delivered) => {
    set({ supportQuestion: { status: answer, badgeSeen: true } });
    const remembered = (await delivered) !== false;
    await write(
      'SupportQuestionSlice.answer',
      remembered
        ? [
            [ANSWER_KEY, answer],
            [BADGE_KEY, true],
          ]
        : [[BADGE_KEY, true]]
    );
  },
});
