import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';

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
  answerSupportQuestion: (answer: 'yes' | 'dismissed') => Promise<void>;
}

interface SavedRecord {
  answer?: 'yes' | 'dismissed';
  badgeSeen?: boolean;
}

const KEY = 'support_question';

async function readSaved(): Promise<SavedRecord> {
  // A failed read falls back to "never asked": the worst case is the row
  // once more, never a lost answer, because every write merges with disk.
  const saved = (await IndexedDBService.get('meta', KEY).catch(() => undefined)) as
    SavedRecord | undefined;
  return saved ?? {};
}

/**
 * Merged with what is on disk, not just what is in memory: Novinky can open
 * before boot's read has landed, and writing only memory would erase an
 * answer already saved — the same trap `markNotificationsRead` documents.
 */
async function save(patch: SavedRecord): Promise<SavedRecord> {
  const next = { ...(await readSaved()), ...patch };
  await IndexedDBService.set('meta', KEY, next);
  return next;
}

function toState(saved: SavedRecord): SupportQuestionSlice['supportQuestion'] {
  return { status: saved.answer ?? 'open', badgeSeen: saved.badgeSeen === true };
}

export const createSupportQuestionSlice: AppSlice<SupportQuestionSlice> = (set, get) => ({
  supportQuestion: { status: 'loading', badgeSeen: false },

  loadSupportQuestion: async () => {
    set({ supportQuestion: toState(await readSaved()) });
  },

  markSupportQuestionSeen: async () => {
    if (get().supportQuestion.badgeSeen) return;
    set({ supportQuestion: { ...get().supportQuestion, badgeSeen: true } });
    await save({ badgeSeen: true });
  },

  answerSupportQuestion: async (answer) => {
    set({ supportQuestion: { status: answer, badgeSeen: true } });
    await save({ answer, badgeSeen: true });
  },
});
