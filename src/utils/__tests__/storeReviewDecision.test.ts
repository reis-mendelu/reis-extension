import { describe, it, expect } from 'vitest';
import {
  ASK_COOLDOWN_DAYS,
  MIN_DAYS_SINCE_FIRST,
  MIN_DAYS_USED,
  markAsked,
  noteDayUsed,
  shouldAskForReview,
  type StoreReviewState,
} from '../storeReviewDecision';

/** A state that passes both usage gates, never asked. */
const seasoned = (over: Partial<StoreReviewState> = {}): StoreReviewState => ({
  firstDay: '2026-11-01',
  lastDay: '2026-11-08',
  daysUsed: 5,
  lastAskedDay: null,
  ...over,
});

describe('the gates are the ones agreed', () => {
  it('5 days of use, 7 days since first launch, 120 days between asks', () => {
    expect(MIN_DAYS_USED).toBe(5);
    expect(MIN_DAYS_SINCE_FIRST).toBe(7);
    expect(ASK_COOLDOWN_DAYS).toBe(120);
  });
});

describe('noteDayUsed', () => {
  it('starts the record on the first day', () => {
    expect(noteDayUsed(null, '2026-11-15')).toEqual({
      firstDay: '2026-11-15',
      lastDay: '2026-11-15',
      daysUsed: 1,
      lastAskedDay: null,
    });
  });

  it('counts a day once, however often the app opens that day', () => {
    const one = noteDayUsed(null, '2026-11-15');
    expect(noteDayUsed(one, '2026-11-15')).toBe(one);
  });

  it('counts each new day and keeps the first day and the last ask', () => {
    const s = seasoned({ lastAskedDay: '2026-01-01' });
    expect(noteDayUsed(s, '2026-11-09')).toEqual({
      ...s,
      lastDay: '2026-11-09',
      daysUsed: 6,
    });
  });

  it('ignores a day before the last one (a clock set back)', () => {
    const s = seasoned();
    expect(noteDayUsed(s, '2026-11-02')).toBe(s);
  });
});

describe('shouldAskForReview', () => {
  it('never without a record', () => {
    expect(shouldAskForReview(null, '2026-11-15')).toBe(false);
  });

  it('asks once both gates pass and it never asked', () => {
    expect(shouldAskForReview(seasoned(), '2026-11-08')).toBe(true);
  });

  it('not before the 5th day of use', () => {
    expect(shouldAskForReview(seasoned({ daysUsed: 4 }), '2026-11-30')).toBe(false);
  });

  it('not before 7 days since the first launch, however many days were used', () => {
    // Day 7 after 1 Nov is 8 Nov; 7 Nov is only 6 days on.
    expect(shouldAskForReview(seasoned({ daysUsed: 9 }), '2026-11-07')).toBe(false);
    expect(shouldAskForReview(seasoned({ daysUsed: 9 }), '2026-11-08')).toBe(true);
  });

  it('not again within 120 days of the last ask', () => {
    const asked = seasoned({ lastAskedDay: '2026-11-08' });
    expect(shouldAskForReview(asked, '2027-03-07')).toBe(false); // day 119
    expect(shouldAskForReview(asked, '2027-03-08')).toBe(true); // day 120
  });

  it('not when the last ask is in the future (a clock set back)', () => {
    expect(shouldAskForReview(seasoned({ lastAskedDay: '2027-01-01' }), '2026-11-20')).toBe(false);
  });

  it('a garbled day refuses rather than asks', () => {
    expect(shouldAskForReview(seasoned({ firstDay: 'nonsense' }), '2026-11-20')).toBe(false);
  });
});

describe('markAsked', () => {
  it('records the day and closes the window', () => {
    const asked = markAsked(seasoned(), '2026-11-10');
    expect(asked.lastAskedDay).toBe('2026-11-10');
    expect(shouldAskForReview(asked, '2026-11-11')).toBe(false);
  });
});
