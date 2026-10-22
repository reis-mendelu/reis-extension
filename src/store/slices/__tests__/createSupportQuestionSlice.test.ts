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
    setMany: vi.fn(async (_store: string, entries: Array<[string, unknown]>) => {
      for (const [key, value] of entries) disk.set(key, value);
    }),
  },
}));
const logError = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/reportError', () => ({ logError }));

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
    vi.clearAllMocks();
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

  // Two extension tabs share the device's storage. A tab clearing its badge
  // after another tab answered must not bring the question back.
  it('a badge write from another tab cannot erase an answer', async () => {
    const tabA = makeSlice();
    const tabB = makeSlice();
    await tabA().loadSupportQuestion();
    await tabB().loadSupportQuestion();

    await Promise.all([
      tabB().answerSupportQuestion('dismissed'),
      tabA().markSupportQuestionSeen(),
    ]);

    const next = makeSlice();
    await next().loadSupportQuestion();
    expect(next().supportQuestion).toEqual({ status: 'dismissed', badgeSeen: true });
  });

  // A tap must never end in an unhandled rejection: a full disk is logged
  // locally and the answer still holds for this session.
  it('logs a failed write and keeps the answer in memory', async () => {
    vi.mocked(IndexedDBService.setMany).mockRejectedValueOnce(new Error('QuotaExceededError'));
    const get = makeSlice();
    await expect(get().answerSupportQuestion('yes')).resolves.toBeUndefined();
    expect(get().supportQuestion.status).toBe('yes');
    expect(logError).toHaveBeenCalledWith('SupportQuestionSlice.answer', expect.any(Error));
  });

  it('logs a failed read and asks', async () => {
    vi.mocked(IndexedDBService.get).mockRejectedValueOnce(new Error('blocked'));
    const get = makeSlice();
    await get().loadSupportQuestion();
    expect(get().supportQuestion).toEqual({ status: 'open', badgeSeen: false });
    expect(logError).toHaveBeenCalledWith('SupportQuestionSlice.load', expect.any(Error));
  });
});
