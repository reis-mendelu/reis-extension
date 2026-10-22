import type { QuestionInput, QuestionResult } from '../../api/adminQuestions';

// Dev-only questions store for `npm run dev:web` (VITE_DEV_SOCIETY): the fake
// admin session cannot pass RLS, so the console's question writes land here
// and never reach Supabase. Only reached behind DEV_SOCIETY, which is gated on
// import.meta.env.DEV, so `wxt build` strips it. Type-only import from the API
// file keeps this a leaf, as devSociety.ts is.

let questions: QuestionResult[] = [];
let counter = 0;

export const devQuestionsStore = {
  list(): QuestionResult[] {
    return [...questions].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  },
  create(q: QuestionInput): boolean {
    questions = [...questions, { ...q, id: `dev-q-${++counter}`, totals: {}, daily: [] }];
    return true;
  },
  end(id: string, patch: { ends_at: string; starts_at?: string }): boolean {
    questions = questions.map((q) =>
      q.id === id ? { ...q, endsAt: patch.ends_at, startsAt: patch.starts_at ?? q.startsAt } : q
    );
    return true;
  },
};
