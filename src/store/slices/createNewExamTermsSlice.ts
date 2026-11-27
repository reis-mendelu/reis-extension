import type { AppSlice } from '../types';
import { clearUnseenTerms, readUnseenTerms } from '../../services/sync/examTermsUnseen';
import { logError } from '../../utils/reportError';
import { allTermKeys } from '../../utils/newExamTerms';

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
  /**
   * Zkoušky was on screen: the new terms in the list it shows have been seen.
   * Only those: the Android background check records keys without saving the
   * list they came from, so a key can be newer than the cached list.
   */
  markExamTermsSeen: () => void;
  /**
   * Terms acknowledged on Zkoušky in this session. A sync or a boot read that
   * was already in flight answers from before the acknowledgement; filtering
   * through this keeps such an answer from bringing a seen term back, and a
   * stored copy of one (its clear failed, or lost a race) is cleared again.
   * Session-only on purpose: after a restart the record itself is the truth,
   * and a term whose clear never landed shows once more until Zkoušky is opened.
   */
  examTermsAcknowledged: string[];
}

export const createNewExamTermsSlice: AppSlice<NewExamTermsSlice> = (set, get) => {
  /** Drops acknowledged terms, and clears any stored copy of one again: a bounded retry. */
  const withoutAcknowledged = (keys: string[]): string[] => {
    const done = new Set(get().examTermsAcknowledged);
    const stale = keys.filter((k) => done.has(k));
    if (stale.length > 0) {
      clearUnseenTerms(stale).catch((err) => logError('NewExamTermsSlice.retryClear', err));
    }
    return keys.filter((k) => !done.has(k));
  };

  return {
    examTermsNew: [],
    examTermsAcknowledged: [],
    setExamTermsNew: (keys) => set({ examTermsNew: withoutAcknowledged(keys) }),
    loadExamTermsNew: async () => {
      try {
        const keys = withoutAcknowledged(await readUnseenTerms());
        // A sync that landed first already holds the newer answer.
        if (get().examTermsNew.length === 0) set({ examTermsNew: keys });
      } catch (err) {
        logError('NewExamTermsSlice.load', err);
      }
    },
    markExamTermsSeen: () => {
      const onScreen = new Set(allTermKeys(get().exams.data));
      const shown = get().examTermsNew.filter((k) => onScreen.has(k));
      if (shown.length === 0) return;
      const seen = new Set(shown);
      set((st) => ({
        examTermsNew: st.examTermsNew.filter((k) => !seen.has(k)),
        examTermsAcknowledged: [...new Set([...st.examTermsAcknowledged, ...shown])],
      }));
      // What is stored once the clear has its turn: another tab may have found
      // a term in the meantime, and it stays news here too.
      clearUnseenTerms(shown)
        .then((rest) => {
          const fresh = withoutAcknowledged(rest);
          if (fresh.length > 0)
            set((s) => ({ examTermsNew: [...new Set([...s.examTermsNew, ...fresh])] }));
        })
        .catch((err) => logError('NewExamTermsSlice.markSeen', err));
    },
  };
};
