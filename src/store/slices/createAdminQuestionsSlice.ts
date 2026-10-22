import type { AppSlice } from '../types';
import {
  createQuestion,
  endQuestion,
  fetchQuestionResults,
  type QuestionInput,
  type QuestionResult,
} from '../../api/adminQuestions';

/**
 * The console's "Otázky" pane (reis_admin only): every question ever asked,
 * newest first, with its counts. Results come from `question_results`, which
 * refuses anyone but reis_admin.
 */
export interface AdminQuestionsSlice {
  /** null until loaded, or when the last load failed. */
  adminQuestions: QuestionResult[] | null;
  adminQuestionsLoading: boolean;
  loadAdminQuestions: () => Promise<void>;
  /** True once written; the list is reloaded either way. */
  createAdminQuestion: (q: QuestionInput) => Promise<boolean>;
  endAdminQuestion: (q: Pick<QuestionResult, 'id' | 'startsAt'>) => Promise<boolean>;
}

export const createAdminQuestionsSlice: AppSlice<AdminQuestionsSlice> = (set, get) => ({
  adminQuestions: null,
  adminQuestionsLoading: false,

  loadAdminQuestions: async () => {
    set({ adminQuestionsLoading: true });
    const list = await fetchQuestionResults();
    // A failed reload keeps what is on screen rather than blanking it.
    set({ adminQuestions: list ?? get().adminQuestions, adminQuestionsLoading: false });
  },

  createAdminQuestion: async (q) => {
    const ok = await createQuestion(q);
    await get().loadAdminQuestions();
    return ok;
  },

  endAdminQuestion: async (q) => {
    const ok = await endQuestion(q);
    await get().loadAdminQuestions();
    return ok;
  },
});
