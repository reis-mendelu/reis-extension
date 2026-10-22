import { z } from 'zod';
import { adminAuthClient } from '../services/admin/authClient';
import { DEV_SOCIETY } from '../utils/mock/devSociety';
import { devQuestionsStore } from '../utils/mock/devQuestions';
import { logError } from '../utils/reportError';
import type { Question } from '../types/questions';

// The console's side of the Novinky questions: write one, end one, read the
// counts. RLS and `question_results` let only reis_admin through; the console
// gating on the role is a convenience, never the authorization.
// Under VITE_DEV_SOCIETY (npm run dev:web) the session is fake, so these run
// against an in-memory store and never reach Supabase. Never cite them as
// evidence the write path works.

export type QuestionInput = Omit<Question, 'id'>;

export interface QuestionResult extends Question {
  /** 'seen' and each button key → devices, over the whole question. */
  totals: Record<string, number>;
  daily: Array<{ day: string; key: string; n: number }>;
}

const ResultSchema = z.object({
  id: z.string(),
  prompt_cz: z.string(),
  prompt_en: z.string(),
  note_cz: z.string().nullable(),
  note_en: z.string().nullable(),
  buttons: z.array(
    z.object({ key: z.string(), cz: z.string(), en: z.string(), url: z.string().optional() })
  ),
  starts_at: z.string(),
  ends_at: z.string(),
  faculties: z.array(z.string()).nullable(),
  totals: z.record(z.string(), z.number()),
  daily: z.array(z.object({ day: z.string(), key: z.string(), n: z.number() })),
});

export async function fetchQuestionResults(): Promise<QuestionResult[] | null> {
  if (DEV_SOCIETY) return devQuestionsStore.list();
  const { data, error } = await adminAuthClient.rpc('question_results');
  if (error) {
    logError('Api.fetchQuestionResults', error);
    return null;
  }
  const parsed = z.array(ResultSchema).safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchQuestionResults', new Error('malformed question_results'));
    return null;
  }
  return parsed.data.map((r) => ({
    id: r.id,
    promptCz: r.prompt_cz,
    promptEn: r.prompt_en,
    noteCz: r.note_cz,
    noteEn: r.note_en,
    buttons: r.buttons,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    faculties: r.faculties,
    totals: r.totals,
    daily: r.daily,
  }));
}

export async function createQuestion(q: QuestionInput): Promise<boolean> {
  if (DEV_SOCIETY) return devQuestionsStore.create(q);
  const { error } = await adminAuthClient.from('reis_questions').insert({
    prompt_cz: q.promptCz,
    prompt_en: q.promptEn,
    note_cz: q.noteCz,
    note_en: q.noteEn,
    buttons: q.buttons,
    starts_at: q.startsAt,
    ends_at: q.endsAt,
    faculties: q.faculties,
  });
  if (error) logError('Api.createQuestion', error);
  return !error;
}

/**
 * Ends a question now. There is no delete: a question's counts go with it, and
 * an ended one stays in the console as the record of what was asked. One that
 * has not started yet ends as a zero-length window, so no student ever sees it.
 */
export async function endQuestion(
  q: Pick<Question, 'id' | 'startsAt'>,
  now: Date = new Date()
): Promise<boolean> {
  const at = now.toISOString();
  const patch =
    Date.parse(q.startsAt) > now.getTime() ? { ends_at: at, starts_at: at } : { ends_at: at };
  if (DEV_SOCIETY) return devQuestionsStore.end(q.id, patch);
  const { error } = await adminAuthClient.from('reis_questions').update(patch).eq('id', q.id);
  if (error) logError('Api.endQuestion', error);
  return !error;
}
