import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexedDBService } from '../../../services/storage/IndexedDBService';
import {
  createSupportQuestionSlice,
  type SupportQuestionSlice,
} from '../createSupportQuestionSlice';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (_store: string, key: string) => disk.get(key)),
    set: vi.fn(async (_store: string, key: string, value: unknown) => void disk.set(key, value)),
  },
}));

function makeSlice(): () => SupportQuestionSlice {
  let state: SupportQuestionSlice;
  const set = (p: Partial<SupportQuestionSlice>) => {
    state = { ...state, ...p };
  };
  const get = () => state;
  state = (
    createSupportQuestionSlice as unknown as (s: typeof set, g: typeof get) => SupportQuestionSlice
  )(set, get);
  return get;
}

/**
 * The "would you support reIS?" question in Novinky. Its answer lives on the
 * device only: nothing here may reach Supabase, which is why the slice talks
 * to IndexedDB and nothing else.
 */
describe('createSupportQuestionSlice', () => {
  beforeEach(() => {
    disk.clear();
    vi.mocked(IndexedDBService.set).mockClear();
  });

  // Until the saved answer is read, nothing may show: a student who answered
  // last week would otherwise see the row flash and a phantom badge on every
  // cold start.
  it('starts out loading, which neither shows the row nor badges', () => {
    expect(makeSlice()().supportQuestion.status).toBe('loading');
  });

  it('opens on a device that has never answered', async () => {
    const get = makeSlice();
    await get().loadSupportQuestion();
    expect(get().supportQuestion).toEqual({ status: 'open', badgeSeen: false });
  });

  it.each(['yes', 'dismissed'] as const)('keeps a "%s" answer across launches', async (answer) => {
    const first = makeSlice();
    await first().loadSupportQuestion();
    await first().answerSupportQuestion(answer);
    expect(first().supportQuestion.status).toBe(answer);

    const next = makeSlice();
    await next().loadSupportQuestion();
    expect(next().supportQuestion.status).toBe(answer);
  });

  it('remembers that the badge was seen, without answering', async () => {
    const first = makeSlice();
    await first().loadSupportQuestion();
    await first().markSupportQuestionSeen();

    const next = makeSlice();
    await next().loadSupportQuestion();
    expect(next().supportQuestion).toEqual({ status: 'open', badgeSeen: true });
  });

  // Novinky can open before boot's read has landed. Writing only what is in
  // memory then would erase an answer already on disk.
  it('merges with the saved record rather than overwriting it', async () => {
    disk.set('support_question', { answer: 'dismissed' });
    const get = makeSlice();
    await get().markSupportQuestionSeen();
    expect(disk.get('support_question')).toEqual({ answer: 'dismissed', badgeSeen: true });
  });
});
