import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { isHarnessEnabled } from '../utils/harnessEnabled';
import { logError } from '../utils/reportError';
import { hasDataConsent } from '../utils/firefoxDataConsent';
import { claimFirstOpen, confirmOpen, releaseOpen } from '../services/spolky/countedOpens';
import type { Question, QuestionCountKey } from '../types/questions';

/**
 * The questions reIS asks in Novinky, and the one counter behind them.
 *
 * `count_question` carries a question id and a key ('seen' or a button's key)
 * and NO identifier: not the install id, not a faculty. The device remembers
 * what it already counted (`countedOpens`), so each number means "devices",
 * the way Novinky clicks and map opens already do. Questions are written ad hoc
 * and can be about anything; on one id the answers would add up to an opinion
 * history per install. Disclosed as `questions` in privacy/disclosures.ts.
 */
const ButtonSchema = z.object({
  key: z.string(),
  cz: z.string(),
  en: z.string(),
  url: z.string().optional(),
  share: z.boolean().optional(),
  hintCz: z.string().optional(),
  hintEn: z.string().optional(),
});
const RowSchema = z.object({
  id: z.string(),
  prompt_cz: z.string(),
  prompt_en: z.string(),
  note_cz: z.string().nullable(),
  note_en: z.string().nullable(),
  buttons: z.array(ButtonSchema).min(1).max(5),
  starts_at: z.string(),
  ends_at: z.string(),
  faculties: z.array(z.string()).nullable(),
  // An icon this build does not know falls back to the question mark.
  icon: z.string().nullish().catch(null),
  display: z.string().nullish().catch(null),
});

/**
 * The live questions, or `null` when the answer is not known (see
 * `fetchNotifications` for why the two must differ). The table's RLS returns
 * only questions between starts_at and ends_at.
 */
export async function fetchQuestions(): Promise<Question[] | null> {
  try {
    const { data, error } = await supabase
      .from('reis_questions')
      .select(
        'id, prompt_cz, prompt_en, note_cz, note_en, buttons, starts_at, ends_at, faculties, icon, display'
      )
      .order('starts_at', { ascending: false });
    if (error || !Array.isArray(data)) {
      if (error) logError('Api.fetchQuestions', error);
      return null;
    }
    // Row by row: one malformed question must not hide the others.
    return data.flatMap((raw) => {
      const r = RowSchema.safeParse(raw);
      if (!r.success) {
        logError('Api.fetchQuestions', r.error);
        return [];
      }
      const q = r.data;
      return [
        {
          id: q.id,
          promptCz: q.prompt_cz,
          promptEn: q.prompt_en,
          noteCz: q.note_cz,
          noteEn: q.note_en,
          buttons: q.buttons,
          startsAt: q.starts_at,
          endsAt: q.ends_at,
          faculties: q.faculties,
          icon: q.icon === 'google_play' ? q.icon : null,
          display: q.display === 'stars' ? q.display : null,
        },
      ];
    });
  } catch (err) {
    logError('Api.fetchQuestions', err);
    return null;
  }
}

/** Same rule as featureUsage: a harness or the demo is not a student. */
function writesAllowed(): boolean {
  return !isDemoMode() && !isHarnessEnabled(import.meta.env);
}

/**
 * Count `key` for this question, once per device: 'seen' on its own surface,
 * any button on the answer surface, so a second answer is never counted.
 *
 * Resolves `false` only when the write failed (the reservation is released,
 * so a later try counts). Nothing to send — a harness, no Firefox consent, or
 * already counted — is settled, `true`.
 */
export function countQuestion(questionId: string, key: QuestionCountKey): Promise<boolean> {
  // One request per surface and question at a time, and every caller awaits
  // it: an answer that asks for 'seen' while the dwell's count is still in
  // flight must learn whether it landed (review #587), not be told "settled".
  const surface = key === 'seen' ? 'question_seen' : 'question_answer';
  const slot = `${surface}:${questionId}`;
  const running = inFlight.get(slot);
  if (running) return running;
  const sent = send(questionId, key, surface).finally(() => inFlight.delete(slot));
  inFlight.set(slot, sent);
  return sent;
}

const inFlight = new Map<string, Promise<boolean>>();

async function send(
  questionId: string,
  key: QuestionCountKey,
  surface: 'question_seen' | 'question_answer'
): Promise<boolean> {
  if (!writesAllowed()) return true;
  if (!(await hasDataConsent('technicalAndInteraction'))) return true;
  if (!(await claimFirstOpen(surface, questionId))) return true;
  try {
    const { error } = await supabase.rpc('count_question', {
      p_question_id: questionId,
      p_key: key,
    });
    if (error) throw new Error(error.message);
    await confirmOpen(surface, questionId);
    return true;
  } catch (err) {
    releaseOpen(surface, questionId);
    logError('Api.countQuestion', err);
    return false;
  }
}
