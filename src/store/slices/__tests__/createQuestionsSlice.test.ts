import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuestionsSlice, type QuestionsSlice } from '../createQuestionsSlice';
import type { Question } from '../../../types/questions';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (_store: string, key: string) => disk.get(key)),
    setMany: vi.fn(async (_store: string, entries: Array<[string, unknown]>) => {
      for (const [key, value] of entries) disk.set(key, value);
    }),
  },
}));
const { fetchQuestions, countQuestion, hasDataConsent } = vi.hoisted(() => ({
  fetchQuestions: vi.fn<() => Promise<Question[] | null>>(async () => []),
  countQuestion: vi.fn<(id: string, key: string) => Promise<boolean>>(async () => true),
  hasDataConsent: vi.fn<() => Promise<boolean>>(async () => true),
}));
vi.mock('../../../api/questions', () => ({ fetchQuestions, countQuestion }));
vi.mock('../../../utils/firefoxDataConsent', () => ({ hasDataConsent }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

const question: Question = {
  id: 'q1',
  promptCz: 'Chceš X?',
  promptEn: 'Want X?',
  noteCz: null,
  noteEn: null,
  buttons: [
    { key: 'yes', cz: 'Ano', en: 'Yes' },
    { key: 'no', cz: 'Ne', en: 'No' },
    { key: 'open', cz: 'Otevřít', en: 'Open', url: 'https://example.com' },
  ],
  startsAt: '2026-10-25T08:00:00Z',
  endsAt: '2026-11-25T08:00:00Z',
  faculties: null,
};

function makeSlice(): () => QuestionsSlice {
  let state: QuestionsSlice;
  const set = (p: Partial<QuestionsSlice>) => {
    state = { ...state, ...p };
  };
  const get = () => state;
  state = (createQuestionsSlice as unknown as (s: typeof set, g: typeof get) => QuestionsSlice)(
    set,
    get
  );
  return get;
}

describe('createQuestionsSlice', () => {
  beforeEach(() => {
    disk.clear();
    vi.clearAllMocks();
    fetchQuestions.mockResolvedValue([question]);
    hasDataConsent.mockResolvedValue(true);
    countQuestion.mockResolvedValue(true);
  });

  it('starts loading, then serves the fetched list and caches it', async () => {
    const get = makeSlice();
    expect(get().questions.status).toBe('loading');
    await get().loadQuestions();
    expect(get().questions.status).toBe('ready');
    expect(get().questions.list).toEqual([question]);
    expect(disk.get('questions_cache')).toEqual([question]);
  });

  it('keeps the cache when the fetch fails', async () => {
    disk.set('questions_cache', [question]);
    fetchQuestions.mockResolvedValueOnce(null);
    const get = makeSlice();
    await get().loadQuestions();
    expect(get().questions.list).toEqual([question]);
  });

  // Firefox with technical data off: asking and then dropping the answer would
  // be a fake, so the question is not asked at all.
  it('marks questions as not allowed without Firefox consent', async () => {
    hasDataConsent.mockResolvedValueOnce(false);
    const get = makeSlice();
    await get().loadQuestions();
    expect(get().questions.allowed).toBe(false);
  });

  it('remembers an answer, counts seen and the key, and survives a restart', async () => {
    const get = makeSlice();
    await get().loadQuestions();
    await get().answerQuestion('q1', 'yes');
    expect(countQuestion.mock.calls).toEqual([
      ['q1', 'seen'],
      ['q1', 'yes'],
    ]);
    expect(get().questions.answers).toEqual({ q1: 'yes' });
    const again = makeSlice();
    await again().loadQuestions();
    expect(again().questions.answers).toEqual({ q1: 'yes' });
  });

  it('keeps an answer whose count failed for this session only', async () => {
    countQuestion.mockImplementation(async (_id, key) => key === 'seen');
    const get = makeSlice();
    await get().loadQuestions();
    await get().answerQuestion('q1', 'yes');
    expect(get().questions.answers).toEqual({ q1: 'yes' });
    const again = makeSlice();
    await again().loadQuestions();
    expect(again().questions.answers).toEqual({});
  });

  // A link is counted and opened; the row stays, so it is no answer.
  it('counts a link tap without answering the question', async () => {
    const get = makeSlice();
    await get().loadQuestions();
    await get().answerQuestion('q1', 'open');
    // Seen first: the link opens a browser, which stops the on-screen dwell.
    expect(countQuestion.mock.calls).toEqual([
      ['q1', 'seen'],
      ['q1', 'open'],
    ]);
    expect(get().questions.answers).toEqual({});
  });

  it('ignores a second answer', async () => {
    const get = makeSlice();
    await get().loadQuestions();
    await get().answerQuestion('q1', 'yes');
    await get().answerQuestion('q1', 'no');
    expect(get().questions.answers).toEqual({ q1: 'yes' });
  });

  it('clears the badge for the questions Novinky showed, across restarts', async () => {
    const get = makeSlice();
    await get().loadQuestions();
    await get().markQuestionsBadgeSeen(['q1']);
    const again = makeSlice();
    await again().loadQuestions();
    expect(again().questions.badgeSeen).toEqual(['q1']);
  });
});
