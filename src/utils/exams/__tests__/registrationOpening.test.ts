import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { isJustOpened, nextRegistrationOpening, OPENING_GRACE_MS } from '../registrationOpening';
import type { ExamSubject, ExamTerm } from '../../../types/exams';

const START = new Date(2026, 11, 1, 8, 0, 0);
const at = (ms: number) => new Date(START.getTime() + ms);
// The same opening as an instant, for the refresh timer: IS's 08:00 is Prague time (CET, UTC+1).
const OPENS = Date.UTC(2026, 11, 1, 7, 0, 0);
const after = (ms: number) => OPENS + ms;

const term = (over: Partial<ExamTerm> = {}): ExamTerm => ({
  id: 't1',
  date: '15.12.2026',
  time: '09:00',
  registrationStart: '01.12.2026 08:00',
  canRegisterNow: false,
  ...over,
});

const subjects = (...terms: ExamTerm[]): ExamSubject[] => [
  {
    version: 1,
    id: 's',
    name: 'Ekonometrie',
    code: 'EBC-EKO',
    sections: [{ id: 'sec', name: 'zkouška', type: 'exam', status: 'open', terms }],
  },
];

describe('isJustOpened', () => {
  it('is false while the opening is still ahead — that is the countdown, not this', () => {
    expect(isJustOpened(term(), at(-10_000))).toBe(false);
  });

  it('is true in the minute after the opening while IS still shows no register link', () => {
    expect(isJustOpened(term(), at(10_000))).toBe(true);
    expect(isJustOpened(term(), at(60_000))).toBe(true);
  });

  it('ends after the grace window: a term IS still will not open is simply not bookable', () => {
    expect(isJustOpened(term(), at(OPENING_GRACE_MS))).toBe(false);
  });

  it('is never true once IS gave the register link — the button is IS’s call alone', () => {
    expect(isJustOpened(term({ canRegisterNow: true }), at(10_000))).toBe(false);
  });

  it('is false for a term the student cannot register for, a full one and a closed one', () => {
    expect(isJustOpened(term({ cannotRegister: true }), at(10_000))).toBe(false);
    expect(isJustOpened(term({ full: true }), at(10_000))).toBe(false);
    expect(
      isJustOpened(term({ capacity: { occupied: 20, total: 20, raw: '20/20' } }), at(10_000))
    ).toBe(false);
    expect(isJustOpened(term({ registrationEnd: '01.12.2026 08:00' }), at(10_000))).toBe(false);
  });

  it('is false for a term with no start', () => {
    expect(isJustOpened(term({ registrationStart: undefined }), at(10_000))).toBe(false);
  });
});

describe('nextRegistrationOpening', () => {
  it('is the earliest opening still ahead, as a timestamp', () => {
    const later = term({ id: 't2', registrationStart: '05.12.2026 08:00' });
    expect(nextRegistrationOpening(subjects(later, term()), after(-60_000))).toBe(OPENS);
  });

  it('keeps naming an opening for a minute after it passes, so retries survive it', () => {
    expect(nextRegistrationOpening(subjects(term()), after(30_000))).toBe(OPENS);
    expect(nextRegistrationOpening(subjects(term()), after(5 * 60_000))).toBeNull();
  });

  it('ignores terms IS already opened, and ones that never open for this student', () => {
    expect(
      nextRegistrationOpening(subjects(term({ canRegisterNow: true })), after(-1000))
    ).toBeNull();
    expect(
      nextRegistrationOpening(subjects(term({ cannotRegister: true })), after(-1000))
    ).toBeNull();
  });

  it('is null with nothing to wait for', () => {
    expect(nextRegistrationOpening([], after(0))).toBeNull();
    expect(
      nextRegistrationOpening(subjects(term({ registrationStart: undefined })), after(0))
    ).toBeNull();
  });
});

/**
 * IS writes Prague wall-clock times. A phone in London read "08:00" as 08:00
 * London, so the refresh at the opening asked IS an hour after the seats went.
 */
describe('nextRegistrationOpening on a phone outside Prague', () => {
  const zone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/London';
  });
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  it('names the Prague instant: 08:00 in Prague is 07:00 UTC in December', () => {
    const pragueOpening = Date.UTC(2026, 11, 1, 7, 0);
    expect(nextRegistrationOpening(subjects(term()), pragueOpening - 60_000)).toBe(pragueOpening);
  });
});
