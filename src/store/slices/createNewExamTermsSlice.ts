import type { AppSlice } from '../types';
import { clearUnseenTerms, readUnseenTerms } from '../../services/sync/examTermsUnseen';
import { logError } from '../../utils/reportError';

/**
 * New exam terms the student has not looked at yet (examTermKey strings), on
 * both trees: the sync finds them (services/sync/newExamTerms), Novinky shows
 * them as "Nový termín" rows (utils/exams/newTermAlerts), and opening Zkoušky
 * clears them.
 */
export interface NewExamTermsSlice {
  examTermsNew: string[];
  setExamTermsNew: (keys: string[]) => void;
  /** Boot: what an earlier sync found and nobody has looked at yet. */
  loadExamTermsNew: () => Promise<void>;
  /** Zkoušky was on screen: every new term has been seen. */
  markExamTermsSeen: () => void;
}

export const createNewExamTermsSlice: AppSlice<NewExamTermsSlice> = (set, get) => ({
  examTermsNew: [],
  setExamTermsNew: (keys) => set({ examTermsNew: keys }),
  loadExamTermsNew: async () => {
    try {
      const keys = await readUnseenTerms();
      // A sync that landed first already holds the newer answer.
      if (get().examTermsNew.length === 0) set({ examTermsNew: keys });
    } catch (err) {
      logError('NewExamTermsSlice.load', err);
    }
  },
  markExamTermsSeen: () => {
    const shown = get().examTermsNew;
    if (shown.length === 0) return;
    set({ examTermsNew: [] });
    // What is stored once the clear has its turn: another tab may have found
    // a term in the meantime, and it stays news here too.
    clearUnseenTerms(shown)
      .then((rest) => {
        if (rest.length > 0)
          set((s) => ({ examTermsNew: [...new Set([...s.examTermsNew, ...rest])] }));
      })
      .catch((err) => logError('NewExamTermsSlice.markSeen', err));
  },
});
