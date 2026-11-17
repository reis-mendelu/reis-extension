import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: { getState: () => ({ sklubMenu: [] }), setState: vi.fn() },
}));

import { rebaseSklubWeek } from '../sklubMenuSeed';

const WEEK = [
  { date: '2026-11-09', soup: 'a', dishes: [] },
  { date: '2026-11-13', soup: 'b', dishes: [] },
];

describe('rebaseSklubWeek', () => {
  it('moves the captured week onto the current one, weekdays kept', () => {
    // Wednesday 2 December 2026, noon in Prague.
    const out = rebaseSklubWeek(WEEK, new Date('2026-12-02T11:00:00Z'));
    expect(out.map((d) => d.date)).toEqual(['2026-11-30', '2026-12-04']);
  });

  it('leaves the capture week as it is', () => {
    const out = rebaseSklubWeek(WEEK, new Date('2026-11-11T11:00:00Z'));
    expect(out.map((d) => d.date)).toEqual(['2026-11-09', '2026-11-13']);
  });
});
