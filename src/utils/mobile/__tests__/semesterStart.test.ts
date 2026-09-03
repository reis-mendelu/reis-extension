import { describe, it, expect } from 'vitest';
import { fromCompact, semesterStart, semesterProgress } from '../semesterStart';

const at = (date: string) => ({ date });

describe('fromCompact', () => {
  it('parses an IS date', () => {
    expect(fromCompact('20260915')).toEqual(new Date(2026, 8, 15));
  });

  it('rejects a rolled-over date rather than silently moving term', () => {
    // new Date(2026, 12, 32) is a real Date — in 2027. A term start that
    // quietly jumps a year is worse than none.
    expect(fromCompact('20261332')).toBeNull();
    expect(fromCompact('20260231')).toBeNull();
  });

  it('rejects anything that is not eight digits', () => {
    expect(fromCompact('2026-09-15')).toBeNull();
    expect(fromCompact('')).toBeNull();
  });
});

describe('semesterStart', () => {
  it('is the earliest lesson, whatever order they arrive in', () => {
    expect(semesterStart([at('20261005'), at('20260915'), at('20261201')])).toEqual(
      new Date(2026, 8, 15)
    );
  });

  it('is null with nothing stored', () => {
    expect(semesterStart([])).toBeNull();
  });

  it('ignores unparseable dates instead of failing on them', () => {
    expect(semesterStart([at('rubbish'), at('20260915')])).toEqual(new Date(2026, 8, 15));
  });
});

/**
 * The card used to say "právě běží" no matter what — a claim, not a fact. A
 * student opening the app the week before term saw their subjects announced as
 * already running.
 */
describe('semesterProgress', () => {
  const schedule = [at('20260915'), at('20261005')];

  it('is upcoming before the first lesson', () => {
    const result = semesterProgress(schedule, new Date(2026, 8, 1, 12));
    expect(result).toEqual({ state: 'upcoming', start: new Date(2026, 8, 15) });
  });

  it('is running once the first lesson day arrives, even early in the morning', () => {
    // The lesson is at 09:00; at 08:00 term has still started today.
    expect(semesterProgress(schedule, new Date(2026, 8, 15, 8))).toEqual({ state: 'running' });
  });

  it('is running well into term', () => {
    expect(semesterProgress(schedule, new Date(2026, 9, 20))).toEqual({ state: 'running' });
  });

  it('is unknown with no schedule, rather than guessing either way', () => {
    expect(semesterProgress([], new Date(2026, 8, 1))).toEqual({ state: 'unknown' });
  });

  it('is upcoming on the day before, not running', () => {
    expect(semesterProgress(schedule, new Date(2026, 8, 14, 23, 59))).toEqual({
      state: 'upcoming',
      start: new Date(2026, 8, 15),
    });
  });
});
