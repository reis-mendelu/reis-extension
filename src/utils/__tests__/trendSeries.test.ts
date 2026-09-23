import { describe, it, expect } from 'vitest';
import { buildTrendSeries, trendMax } from '../trendSeries';

const TODAY = new Date(2026, 8, 22); // 22 September 2026, local

describe('buildTrendSeries', () => {
  it('returns one point per day, ending today', () => {
    const series = buildTrendSeries([], 5, TODAY);

    expect(series.map((p) => p.day)).toEqual([
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
    ]);
  });

  // The reason this module exists: the RPC omits a day with no activity, so a
  // chart drawn from its rows would put Monday beside Friday at equal spacing.
  // A quiet week and a busy one would draw the same shape.
  it('fills a day the RPC omitted with zero rather than skipping it', () => {
    const series = buildTrendSeries(
      [
        { day: '2026-09-20', value: 4 },
        { day: '2026-09-22', value: 9 },
      ],
      3,
      TODAY
    );

    expect(series).toEqual([
      { day: '2026-09-20', value: 4 },
      { day: '2026-09-21', value: 0 },
      { day: '2026-09-22', value: 9 },
    ]);
  });

  it('sums several rows landing on the same day', () => {
    const series = buildTrendSeries(
      [
        { day: '2026-09-22', value: 3 },
        { day: '2026-09-22', value: 4 },
      ],
      1,
      TODAY
    );

    expect(series).toEqual([{ day: '2026-09-22', value: 7 }]);
  });

  it('ignores rows older than the window', () => {
    const series = buildTrendSeries([{ day: '2026-01-01', value: 999 }], 2, TODAY);

    expect(series.every((p) => p.value === 0)).toBe(true);
  });

  it('never returns an empty series, however small the span', () => {
    expect(buildTrendSeries([], 0, TODAY)).toHaveLength(1);
    expect(buildTrendSeries([], -5, TODAY)).toHaveLength(1);
  });

  // A local day is 23 or 25 hours across a daylight-saving change, so stepping
  // back by a fixed 86,400,000 ms skips or repeats a date every autumn. Europe
  // /Prague ends DST on 25 October 2026. Asserted as "distinct, consecutive
  // calendar days" rather than against fixed strings, so it is meaningful in a
  // DST timezone and still correct on a CI runner pinned to UTC.
  it('steps calendar days across a daylight-saving change', () => {
    const series = buildTrendSeries([], 5, new Date(2026, 9, 27)); // 27 October
    const days = series.map((p) => p.day);

    expect(new Set(days).size).toBe(days.length);
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T00:00:00Z`);
      prev.setUTCDate(prev.getUTCDate() + 1);
      expect(days[i]).toBe(prev.toISOString().slice(0, 10));
    }
  });

  // Crossing a month boundary is where naive day arithmetic breaks.
  it('walks back across a month boundary', () => {
    const series = buildTrendSeries([], 3, new Date(2026, 9, 1)); // 1 October

    expect(series.map((p) => p.day)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });
});

describe('trendMax', () => {
  it('floors at 1 so an all-zero series can still be divided by', () => {
    expect(trendMax([{ day: 'a', value: 0 }])).toBe(1);
  });

  it('returns the largest value', () => {
    expect(
      trendMax([
        { day: 'a', value: 3 },
        { day: 'b', value: 11 },
      ])
    ).toBe(11);
  });
});
