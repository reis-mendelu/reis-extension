import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../utils/reportError', () => ({
  logError: vi.fn(),
}));

vi.mock('../../../api/termDuration', () => ({
  fetchTermDuration: vi.fn(),
}));

import { enrichExamsWithDurations, ENRICHMENT_BUDGET_MS } from '../examDurations';
import { fetchTermDuration } from '../../../api/termDuration';
import { logError } from '../../../utils/reportError';
import type { ExamSubject } from '../../../types/exams';

const subject = (
  code: string,
  registeredTerm?: { id?: string; durationMinutes?: number }
): ExamSubject => ({
  version: 1,
  id: code,
  name: code,
  code,
  sections: [
    {
      id: `${code}-s`,
      name: 'zkouška',
      type: 'zkouška',
      status: registeredTerm ? 'registered' : 'open',
      registeredTerm: registeredTerm
        ? { date: '24.06.2026', time: '09:45', ...registeredTerm }
        : undefined,
      terms: [],
    },
  ],
});

describe('enrichExamsWithDurations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('attaches the fetched duration to a registered term', async () => {
    vi.mocked(fetchTermDuration).mockResolvedValue(10);
    const result = await enrichExamsWithDurations([subject('A', { id: '1' })], [], '111', '222');
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBe(10);
  });

  it('does not mutate the input exams', async () => {
    vi.mocked(fetchTermDuration).mockResolvedValue(10);
    const input = [subject('A', { id: '1' })];
    await enrichExamsWithDurations(input, [], '111', '222');
    expect(input[0]!.sections[0]!.registeredTerm?.durationMinutes).toBeUndefined();
  });

  it('reuses a cached duration instead of refetching', async () => {
    const cached = [subject('A', { id: '1', durationMinutes: 45 })];
    const result = await enrichExamsWithDurations(
      [subject('A', { id: '1' })],
      cached,
      '111',
      '222'
    );
    expect(fetchTermDuration).not.toHaveBeenCalled();
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBe(45);
  });

  // Every listed term, not only the registered ones: the phone shows each
  // term's length under it. Registered terms go first, so the budget spends
  // itself on the calendar's blocks before anything else.
  it('also attaches durations to the terms a section lists, registered one first', async () => {
    vi.mocked(fetchTermDuration).mockImplementation(async (id) => (id === '1' ? 90 : 25));
    const s = subject('A', { id: '1' });
    s.sections[0]!.terms = [
      { id: '2', date: '01.07.2026', time: '09:00' },
      { id: '1', date: '24.06.2026', time: '09:45' },
    ];
    const result = await enrichExamsWithDurations([s], [], '111', '222');
    expect(vi.mocked(fetchTermDuration).mock.calls.map((c) => c[0])).toEqual(['1', '2']);
    const terms = result[0]!.sections[0]!.terms;
    expect(terms.find((t) => t.id === '2')?.durationMinutes).toBe(25);
    expect(terms.find((t) => t.id === '1')?.durationMinutes).toBe(90);
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBe(90);
  });

  it('reuses a cached duration of a listed term instead of refetching', async () => {
    const cached = subject('A');
    cached.sections[0]!.terms = [
      { id: '7', date: '01.07.2026', time: '09:00', durationMinutes: 30 },
    ];
    const fresh = subject('A');
    fresh.sections[0]!.terms = [{ id: '7', date: '01.07.2026', time: '09:00' }];
    const result = await enrichExamsWithDurations([fresh], [cached], '111', '222');
    expect(fetchTermDuration).not.toHaveBeenCalled();
    expect(result[0]!.sections[0]!.terms[0]!.durationMinutes).toBe(30);
  });

  // A listed term whose page has no length answered null, which used to be
  // cached as nothing — so every sync fetched it again, for every such term.
  it('remembers a listed term IS gave no length for, and does not refetch it', async () => {
    vi.mocked(fetchTermDuration).mockResolvedValue(null);
    const first = subject('A');
    first.sections[0]!.terms = [{ id: '7', date: '01.07.2026', time: '09:00' }];
    const synced = await enrichExamsWithDurations([first], [], '111', '222');
    expect(synced[0]!.sections[0]!.terms[0]!.durationMinutes).toBeNull();

    vi.mocked(fetchTermDuration).mockClear();
    const again = subject('A');
    again.sections[0]!.terms = [{ id: '7', date: '01.07.2026', time: '09:00' }];
    const result = await enrichExamsWithDurations([again], synced, '111', '222');
    expect(fetchTermDuration).not.toHaveBeenCalled();
    expect(result[0]!.sections[0]!.terms[0]!.durationMinutes).toBeNull();
  });

  // The calendar sizes the registered term's block, and a teacher can fill the
  // length in later — so a registered term with none is asked again. There are
  // a handful of those, not one per listed term.
  it('keeps asking about a registered term that had no length', async () => {
    const cached = subject('A', { id: '1' });
    cached.sections[0]!.terms = [
      { id: '1', date: '24.06.2026', time: '09:45', durationMinutes: null },
    ];
    vi.mocked(fetchTermDuration).mockResolvedValue(60);
    const fresh = subject('A', { id: '1' });
    fresh.sections[0]!.terms = [{ id: '1', date: '24.06.2026', time: '09:45' }];
    const result = await enrichExamsWithDurations([fresh], [cached], '111', '222');
    expect(fetchTermDuration).toHaveBeenCalledWith('1', '111', '222');
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBe(60);
    expect(result[0]!.sections[0]!.terms[0]!.durationMinutes).toBe(60);
  });

  it('skips registered terms with no term id', async () => {
    await enrichExamsWithDurations([subject('A', { id: '' })], [], '111', '222');
    expect(fetchTermDuration).not.toHaveBeenCalled();
  });

  it('leaves duration undefined and reports when a single fetch fails', async () => {
    vi.mocked(fetchTermDuration).mockRejectedValue(new Error('auth redirect'));
    const result = await enrichExamsWithDurations([subject('A', { id: '1' })], [], '111', '222');
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });

  it('isolates a failure so other terms still resolve', async () => {
    vi.mocked(fetchTermDuration).mockImplementation(async (id: string) => {
      if (id === '1') throw new Error('boom');
      return 30;
    });
    const result = await enrichExamsWithDurations(
      [subject('A', { id: '1' }), subject('B', { id: '2' })],
      [],
      '111',
      '222'
    );
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBeUndefined();
    expect(result[1]!.sections[0]!.registeredTerm?.durationMinutes).toBe(30);
  });

  it('returns exams untouched when studium/obdobi are missing', async () => {
    const result = await enrichExamsWithDurations([subject('A', { id: '1' })], [], '', '');
    expect(fetchTermDuration).not.toHaveBeenCalled();
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBeUndefined();
  });

  it('never runs more than 3 fetches concurrently', async () => {
    let active = 0;
    let peak = 0;
    vi.mocked(fetchTermDuration).mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return 20;
    });
    const exams = Array.from({ length: 9 }, (_, i) => subject(`S${i}`, { id: String(i + 1) }));
    await enrichExamsWithDurations(exams, [], '111', '222');
    expect(fetchTermDuration).toHaveBeenCalledTimes(9);
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe('the enrichment budget', () => {
  it('gives up and returns the exams when the fetches outlast the budget', async () => {
    // fetchWithAuth carries no timeout, and syncAllData awaits this call before
    // it assembles the batch and reports the run finished. One stalled IS
    // request must not leave the app syncing forever.
    vi.useFakeTimers();
    try {
      vi.mocked(fetchTermDuration).mockImplementation(() => new Promise(() => {}));
      const promise = enrichExamsWithDurations([subject('A', { id: '1' })], [], '111', '222');
      await vi.advanceTimersByTimeAsync(ENRICHMENT_BUDGET_MS + 1000);
      const result = await promise;
      expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  // Losing the race used to leave the workers running: they kept pulling terms
  // off the queue after the sync had moved on, into the next sync's burst.
  it('starts no new fetch once the budget is spent', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetchTermDuration).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(10), 15000))
      );
      const s = subject('A');
      s.sections[0]!.terms = Array.from({ length: 12 }, (_, i) => ({
        id: String(i + 1),
        date: '01.07.2026',
        time: '09:00',
      }));
      const promise = enrichExamsWithDurations([s], [], '111', '222');
      // 3 start at 0 s, 3 more at 15 s; the budget ends at 20 s.
      await vi.advanceTimersByTimeAsync(ENRICHMENT_BUDGET_MS + 1000);
      await promise;
      await vi.advanceTimersByTimeAsync(120000);
      expect(fetchTermDuration).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not wait out the budget when every fetch answers', async () => {
    vi.mocked(fetchTermDuration).mockResolvedValue(10);
    const result = await enrichExamsWithDurations([subject('A', { id: '1' })], [], '111', '222');
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBe(10);
  });
});
