import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc, insert, update, eq } = vi.hoisted(() => ({
  rpc: vi.fn<(...a: unknown[]) => Promise<{ data: unknown; error: unknown }>>(),
  insert: vi.fn<(...a: unknown[]) => Promise<{ error: unknown }>>(async () => ({ error: null })),
  update: vi.fn<(...a: unknown[]) => unknown>(),
  eq: vi.fn<(...a: unknown[]) => Promise<{ error: unknown }>>(async () => ({ error: null })),
}));
vi.mock('../../services/admin/authClient', () => ({
  adminAuthClient: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      insert: (...a: unknown[]) => insert(...a),
      update: (...a: unknown[]) => {
        update(...a);
        return { eq: (...b: unknown[]) => eq(...b) };
      },
    }),
  },
}));
vi.mock('../../utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { createQuestion, endQuestion, fetchQuestionResults } from '../adminQuestions';

const input = {
  promptCz: 'Chceš X?',
  promptEn: 'Want X?',
  noteCz: null,
  noteEn: null,
  buttons: [
    { key: 'yes', cz: 'Ano', en: 'Yes' },
    { key: 'no', cz: 'Ne', en: 'No' },
  ],
  startsAt: '2026-10-25T08:00:00.000Z',
  endsAt: '2026-11-22T08:00:00.000Z',
  faculties: null,
};

describe('adminQuestions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the snake_case row', async () => {
    expect(await createQuestion(input)).toBe(true);
    expect(insert).toHaveBeenCalledWith({
      prompt_cz: 'Chceš X?',
      prompt_en: 'Want X?',
      note_cz: null,
      note_en: null,
      buttons: input.buttons,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      faculties: null,
    });
  });

  it('reports a refused write', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'rls' } });
    expect(await createQuestion(input)).toBe(false);
  });

  // A question that has not started ends as a zero-length window.
  it('ends a live question now, and a scheduled one before it starts', async () => {
    const now = new Date('2026-11-01T10:00:00.000Z');
    await endQuestion({ id: 'q1', startsAt: '2026-10-25T08:00:00.000Z' }, now);
    expect(update).toHaveBeenLastCalledWith({ ends_at: now.toISOString() });
    await endQuestion({ id: 'q2', startsAt: '2026-12-01T08:00:00.000Z' }, now);
    expect(update).toHaveBeenLastCalledWith({
      ends_at: now.toISOString(),
      starts_at: now.toISOString(),
    });
    expect(eq).toHaveBeenLastCalledWith('id', 'q2');
  });

  it('maps the results, and answers null on failure', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'q1',
          prompt_cz: 'Chceš X?',
          prompt_en: 'Want X?',
          note_cz: null,
          note_en: null,
          buttons: input.buttons,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          faculties: null,
          totals: { seen: 10, yes: 3 },
          daily: [{ day: '2026-10-25', key: 'seen', n: 10 }],
        },
      ],
      error: null,
    });
    const [r] = (await fetchQuestionResults()) ?? [];
    expect(r?.totals).toEqual({ seen: 10, yes: 3 });
    expect(r?.daily).toEqual([{ day: '2026-10-25', key: 'seen', n: 10 }]);
    expect(rpc).toHaveBeenCalledWith('question_results');

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'forbidden' } });
    expect(await fetchQuestionResults()).toBeNull();
  });
});
