import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { hasDataConsent, rpc, select, isHarnessEnabled } = vi.hoisted(() => ({
  isHarnessEnabled: vi.fn<(...args: unknown[]) => boolean>(() => false),
  hasDataConsent: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
  rpc: vi.fn<(...args: unknown[]) => Promise<{ error: { message: string } | null }>>(async () => ({
    error: null,
  })),
  select: vi.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>(),
}));

vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ select: () => ({ order: () => select() }) }),
  },
}));
vi.mock('../../utils/firefoxDataConsent', () => ({
  hasDataConsent: (...a: unknown[]) => hasDataConsent(...a),
}));
vi.mock('../../utils/harnessEnabled', () => ({
  isHarnessEnabled: (...a: unknown[]) => isHarnessEnabled(...a),
}));

import {
  __resetCountedOpensForTests,
  __forgetCountedOpensMemoryForTests,
} from '../../services/spolky/countedOpens';
import { countQuestion, fetchQuestions } from '../questions';

const row = {
  id: 'q1',
  prompt_cz: 'Chceš X?',
  prompt_en: 'Want X?',
  note_cz: null,
  note_en: null,
  buttons: [
    { key: 'yes', cz: 'Ano', en: 'Yes' },
    { key: 'no', cz: 'Ne', en: 'No' },
  ],
  starts_at: '2026-10-25T08:00:00+00:00',
  ends_at: '2026-11-25T08:00:00+00:00',
  faculties: null,
};

describe('fetchQuestions', () => {
  it('maps a live row', async () => {
    select.mockResolvedValueOnce({ data: [row], error: null });
    expect(await fetchQuestions()).toEqual([
      {
        id: 'q1',
        promptCz: 'Chceš X?',
        promptEn: 'Want X?',
        noteCz: null,
        noteEn: null,
        buttons: row.buttons,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        faculties: null,
      },
    ]);
  });

  it('answers null, not [], when the answer is not known', async () => {
    select.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    expect(await fetchQuestions()).toBeNull();
  });

  it('drops a row it cannot render instead of the whole list', async () => {
    select.mockResolvedValueOnce({ data: [row, { ...row, id: 'q2', buttons: 'nope' }], error: null });
    expect((await fetchQuestions())?.map((q) => q.id)).toEqual(['q1']);
  });
});

describe('countQuestion', () => {
  beforeEach(async () => {
    await __resetCountedOpensForTests();
    isHarnessEnabled.mockReturnValue(false);
    hasDataConsent.mockResolvedValue(true);
  });
  afterEach(() => vi.clearAllMocks());

  it('sends the question id and the key, and nothing else', async () => {
    expect(await countQuestion('q1', 'yes')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('count_question', { p_question_id: 'q1', p_key: 'yes' });
  });

  it('counts seen and an answer once per device, across restarts', async () => {
    await countQuestion('q1', 'seen');
    await countQuestion('q1', 'yes');
    __forgetCountedOpensMemoryForTests();
    await countQuestion('q1', 'seen');
    await countQuestion('q1', 'no');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('reports a failed write and lets the next try count', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'boom' } });
    expect(await countQuestion('q1', 'yes')).toBe(false);
    expect(await countQuestion('q1', 'yes')).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('sends nothing without Firefox consent or in a harness, and calls it settled', async () => {
    hasDataConsent.mockResolvedValueOnce(false);
    expect(await countQuestion('q1', 'yes')).toBe(true);
    isHarnessEnabled.mockReturnValue(true);
    expect(await countQuestion('q1', 'seen')).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
