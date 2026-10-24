import type { AppSlice } from '../types';
import type { Question } from '../../types/questions';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { fetchQuestions, countQuestion } from '../../api/questions';
import { hasDataConsent } from '../../utils/firefoxDataConsent';
import { logError } from '../../utils/reportError';

/**
 * The questions reIS asks in Novinky (`api/questions.ts`), on both trees.
 *
 * - `loading` until boot has read what this device saved: nothing shows and
 *   nothing badges, or an answered question would flash on every cold start.
 * - `answers` is what this device answered. An answered question stays as
 *   "Díky" until it ends (decided 2026-10-22). An answer whose count did not
 *   reach Supabase is kept for this session only, so a later launch asks — and
 *   counts — again.
 * - `badgeSeen` is the bell: opening Novinky with a question in clears it.
 * - `allowed` is Firefox's technical-data toggle. Off means the question is not
 *   asked at all; asking and then dropping the answer would be a fake.
 */
export interface QuestionsState {
  status: 'loading' | 'ready';
  list: Question[];
  answers: Record<string, string>;
  badgeSeen: string[];
  allowed: boolean;
}

export interface QuestionsSlice {
  questions: QuestionsState;
  loadQuestions: () => Promise<void>;
  refreshQuestions: () => Promise<void>;
  /** An answer button, or a link button (counted, not an answer). */
  answerQuestion: (id: string, key: string) => Promise<void>;
  markQuestionsBadgeSeen: (ids: string[]) => Promise<void>;
}

const CACHE_KEY = 'questions_cache';
const ANSWERS_KEY = 'question_answers';
const BADGE_KEY = 'question_badge_seen';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    return ((await IndexedDBService.get('meta', key)) as T | undefined) ?? fallback;
  } catch (err) {
    logError('QuestionsSlice.read', err);
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await IndexedDBService.setMany('meta', [[key, value]]);
  } catch (err) {
    logError('QuestionsSlice.write', err);
  }
}

/** One holder at a time across extension tabs (Web Locks where they exist). */
async function exclusive<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? await locks.request(name, fn) : fn();
}

/** Read fresh, merge, write: a second extension tab's answer is not overwritten. */
async function merge<T>(key: string, fallback: T, fn: (saved: T) => T): Promise<void> {
  await exclusive(`reis_${key}`, async () => write(key, fn(await read(key, fallback))));
}

const consent = () => hasDataConsent('technicalAndInteraction').catch(() => false);

export const createQuestionsSlice: AppSlice<QuestionsSlice> = (set, get) => ({
  questions: { status: 'loading', list: [], answers: {}, badgeSeen: [], allowed: false },

  loadQuestions: async () => {
    const [list, answers, badgeSeen, allowed] = await Promise.all([
      read<Question[]>(CACHE_KEY, []),
      read<Record<string, string>>(ANSWERS_KEY, {}),
      read<string[]>(BADGE_KEY, []),
      consent(),
    ]);
    set({
      questions: {
        ...get().questions,
        status: 'ready',
        list,
        // Answers given this session before the disk was read are kept.
        answers: { ...answers, ...get().questions.answers },
        badgeSeen,
        allowed,
      },
    });
    await get().refreshQuestions();
  },

  refreshQuestions: async () => {
    // Firefox's switch can change while reIS runs, so every refresh asks again.
    const [list, allowed] = await Promise.all([fetchQuestions(), consent()]);
    set({ questions: { ...get().questions, allowed } });
    // null is "ask again later": the cache survives a failed request.
    if (list === null) return;
    set({ questions: { ...get().questions, list } });
    await write(CACHE_KEY, list);
  },

  answerQuestion: async (id, key) => {
    const question = get().questions.list.find((q) => q.id === id);
    const button = question?.buttons.find((b) => b.key === key);
    if (!button || get().questions.answers[id]) return;
    // Consent withdrawn since the last refresh: no thanks for an answer that
    // would not be sent, and the questions go.
    if (!(await consent())) {
      set({ questions: { ...get().questions, allowed: false } });
      return;
    }
    if (button.url) {
      // Seen first, as for an answer: the link opens a browser, which hides
      // the page and stops the on-screen dwell before it could count.
      // A link shares the answer claim, so a link tap followed by another
      // button counts only the first; the presets give a link question one
      // button, so that cannot happen from the console today.
      if (await countQuestion(id, 'seen')) await countQuestion(id, key);
      return;
    }
    const answer = (k: string) =>
      set({ questions: { ...get().questions, answers: { ...get().questions.answers, [id]: k } } });
    answer(key);
    // Per question across tabs: the first answer saved on this device wins, and
    // a later tab shows it instead of sending its own (review #587).
    await exclusive(`reis_question_${id}`, async () => {
      const earlier = (await read<Record<string, string>>(ANSWERS_KEY, {}))[id];
      if (earlier) return answer(earlier);
      // An answer is proof it was read, so it is sent only once 'seen' landed:
      // no answer falls outside the denominator. Either failing keeps the
      // answer for this session only, and a later launch asks again.
      if (!(await countQuestion(id, 'seen'))) return;
      if (!(await countQuestion(id, key))) return;
      await merge<Record<string, string>>(ANSWERS_KEY, {}, (saved) => ({ ...saved, [id]: key }));
    });
  },

  markQuestionsBadgeSeen: async (ids) => {
    const seen = get().questions.badgeSeen;
    const fresh = ids.filter((id) => !seen.includes(id));
    if (!fresh.length) return;
    set({ questions: { ...get().questions, badgeSeen: [...seen, ...fresh] } });
    await merge<string[]>(BADGE_KEY, [], (saved) => [...new Set([...saved, ...fresh])]);
  },
});
