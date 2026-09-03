import { describe, it, expect } from 'vitest';
import { weekRangeLabel, weekEyebrow } from '../weekRange';

const week = (y: number, m: number, d: number, len = 5) =>
  Array.from({ length: len }, (_, i) => new Date(y, m - 1, d + i));

describe('weekRangeLabel', () => {
  it('says the month once when the week does not cross one', () => {
    expect(weekRangeLabel(week(2026, 9, 1), 'cs-CZ')).toBe('1.–5. 9.');
  });

  it('says both months when the week straddles them', () => {
    expect(weekRangeLabel(week(2026, 9, 29), 'cs-CZ')).toBe('29. 9. – 3. 10.');
  });

  it('covers a strip that carries a weekend day too', () => {
    // Saturday teaching for combined-study cohorts extends the strip to six or
    // seven chips, and the label has to describe what is actually on screen —
    // a fixed Mon–Fri range would contradict the title above it when a Saturday
    // is the selected day.
    expect(weekRangeLabel(week(2026, 9, 1, 6), 'cs-CZ')).toBe('1.–6. 9.');
  });

  it('reads naturally in English', () => {
    expect(weekRangeLabel(week(2026, 9, 1), 'en-US')).toBe('Sep 1–5');
    expect(weekRangeLabel(week(2026, 9, 29), 'en-US')).toBe('Sep 29 – Oct 3');
  });

  it('says nothing rather than guessing when there are no days', () => {
    expect(weekRangeLabel([], 'cs-CZ')).toBe('');
  });

  it('handles a single-day strip', () => {
    expect(weekRangeLabel(week(2026, 9, 3, 1), 'cs-CZ')).toBe('3.–3. 9.');
  });

  it('does not roll a December week into the wrong year', () => {
    expect(weekRangeLabel(week(2026, 12, 28), 'cs-CZ')).toBe('28. 12. – 1. 1.');
  });
});

describe('weekEyebrow', () => {
  it('leads with the teaching week, then the dates', () => {
    expect(weekEyebrow('4. týden', '1.–5. 9.')).toBe('4. týden · 1.–5. 9.');
  });

  /**
   * The case that must not become a claim. `getWeekForDate` returns null both
   * outside the teaching period AND while IS's table is still in flight, and
   * the two are indistinguishable here — so the honest output is the dates
   * alone. Printing "0. týden", or an empty separator, would assert something
   * about the semester that a late fetch had not yet earned.
   */
  it('falls back to the dates alone when there is no teaching week', () => {
    expect(weekEyebrow(null, '1.–5. 9.')).toBe('1.–5. 9.');
  });

  it('never leaves a dangling separator', () => {
    expect(weekEyebrow('4. týden', '')).toBe('4. týden');
    expect(weekEyebrow(null, '')).toBe('');
  });
});
