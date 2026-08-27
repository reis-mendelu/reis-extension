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

  it('skips sections that are not registered', async () => {
    await enrichExamsWithDurations([subject('A')], [], '111', '222');
    expect(fetchTermDuration).not.toHaveBeenCalled();
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

  it('does not wait out the budget when every fetch answers', async () => {
    vi.mocked(fetchTermDuration).mockResolvedValue(10);
    const result = await enrichExamsWithDurations([subject('A', { id: '1' })], [], '111', '222');
    expect(result[0]!.sections[0]!.registeredTerm?.durationMinutes).toBe(10);
  });
});
