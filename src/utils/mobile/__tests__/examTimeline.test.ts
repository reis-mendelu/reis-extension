import { describe, it, expect } from 'vitest';
import { buildExamTimeline } from '../examTimeline';
import type { ExamSubject } from '../../../types/exams';

const subject = (code: string, registered?: { id?: string; date: string; time: string }): ExamSubject => ({
  version: 1, id: code, name: code, code,
  sections: [{ id: `${code}-s`, name: 'zkouška', type: 'exam', status: registered ? 'registered' : 'open', registeredTerm: registered, terms: [] }],
});

describe('buildExamTimeline', () => {
  const now = new Date('2026-04-20T08:00:00');

  it('returns nothing for no exams', () => {
    expect(buildExamTimeline([], now)).toEqual([]);
  });

  it('skips sections with no registered term', () => {
    expect(buildExamTimeline([subject('EBC-ALG')], now)).toEqual([]);
  });

  it('builds a point with days remaining', () => {
    const pts = buildExamTimeline([subject('EBC-ALG', { id: 't1', date: '25.04.2026', time: '09:00' })], now);
    expect(pts).toHaveLength(1);
    expect(pts[0]!.subjectCode).toBe('EBC-ALG');
    expect(pts[0]!.daysLeft).toBe(5);
  });

  // The timeline lays several points across a phone width, so it renders
  // `shortLabel`; the full `label` stays for anything wanting date + time.
  it('carries a day-and-month short label beside the full one', () => {
    const pts = buildExamTimeline([subject('EBC-ALG', { id: 't1', date: '05.04.2026', time: '09:00' })], now);
    expect(pts[0]!.label).toBe('05.04.2026 09:00');
    expect(pts[0]!.shortLabel).toBe('5.4.');
  });

  it('reports zero days left for a term today', () => {
    const pts = buildExamTimeline([subject('EBC-ALG', { id: 't1', date: '20.04.2026', time: '14:00' })], now);
    expect(pts[0]!.daysLeft).toBe(0);
  });

  it('sorts points ascending by date', () => {
    const pts = buildExamTimeline(
      [
        subject('LATE', { id: 'a', date: '30.04.2026', time: '09:00' }),
        subject('EARLY', { id: 'b', date: '22.04.2026', time: '09:00' }),
      ],
      now
    );
    expect(pts.map((p) => p.subjectCode)).toEqual(['EARLY', 'LATE']);
  });

  it('skips malformed dates instead of throwing', () => {
    expect(buildExamTimeline([subject('BAD', { id: 'x', date: 'not-a-date', time: '09:00' })], now)).toEqual([]);
  });
});
