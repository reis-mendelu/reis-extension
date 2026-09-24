import { describe, it, expect } from 'vitest';
import { termDeadline } from '../examDeadline';
import type { ExamSection, ExamTerm } from '../../../types/exams';

const NOW = new Date(2026, 8, 22, 12, 0); // 22 Sep 2026, noon

const term = (over: Partial<ExamTerm> = {}): ExamTerm => ({
  id: 't1',
  date: '09.11.2026',
  time: '11:00',
  ...over,
});

const section = (over: Partial<ExamSection> = {}): ExamSection => ({
  id: 's1',
  name: 'zkouška',
  type: 'exam',
  status: 'open',
  terms: [],
  ...over,
});

/**
 * One deadline per term, the one the student can act on:
 *   registered  → until when they can still get OFF it
 *   bookable    → until when they can still get ON it
 *   not open yet→ from when they will be able to
 *   closed      → until when it was possible, which is why it is closed now
 */
describe('termDeadline', () => {
  it('gives the deregistration deadline for the term you are on', () => {
    const t = term({ deregistrationDeadline: '07.11.2026 18:00' });
    expect(termDeadline(t, section(), true, NOW)).toEqual({
      kind: 'deregisterUntil',
      value: '07.11.2026 18:00',
    });
  });

  it('falls back to the registered term when IS put the deadline only there', () => {
    const s = section({
      status: 'registered',
      registeredTerm: {
        id: 't1',
        date: '09.11.2026',
        time: '11:00',
        deregistrationDeadline: '06.11.2026 20:00',
      },
    });
    expect(termDeadline(term(), s, true, NOW)?.value).toBe('06.11.2026 20:00');
  });

  it('gives the registration deadline for a term you can book now', () => {
    const t = term({ canRegisterNow: true, registrationEnd: '08.11.2026 20:00' });
    expect(termDeadline(t, section(), false, NOW)).toEqual({
      kind: 'registerUntil',
      value: '08.11.2026 20:00',
    });
  });

  // The row's own trailing slot already says "otevírá se 1. 11." — repeating it
  // in the panel below was the same fact twice. The panel answers the next
  // question instead: once it opens, how long do I have?
  it('gives the closing moment while registration has not started yet', () => {
    const t = term({ registrationStart: '01.11.2026 13:00', registrationEnd: '08.11.2026 20:00' });
    expect(termDeadline(t, section(), false, NOW)).toEqual({
      kind: 'registerUntil',
      value: '08.11.2026 20:00',
    });
  });

  it('falls back to the opening moment when IS gave no closing one', () => {
    const t = term({ registrationStart: '01.11.2026 13:00' });
    expect(termDeadline(t, section(), false, NOW)).toEqual({
      kind: 'registerFrom',
      value: '01.11.2026 13:00',
    });
  });

  it('gives the moment registration closed for a term that is over', () => {
    const t = term({ registrationStart: '01.09.2026 13:00', registrationEnd: '20.09.2026 20:00' });
    expect(termDeadline(t, section(), false, NOW)).toEqual({
      kind: 'registerUntil',
      value: '20.09.2026 20:00',
    });
  });

  it('says nothing when IS gave no dates at all', () => {
    expect(termDeadline(term(), section(), false, NOW)).toBeNull();
  });
});
