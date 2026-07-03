import { describe, it, expect } from 'vitest';
import { gradeForCourse } from '../gradeLookup';
import type { CourseGrade } from '../../types/documents';

const g = (over: Partial<CourseGrade>): CourseGrade => ({
  period: 'LS 2025/2026 - PEF', predmetId: '1', courseCode: undefined, courseName: 'X',
  examType: 'zk', attempt: 1, gradeText: '', gradeLetter: '', credits: 4, ...over,
});

describe('gradeForCourse (matched by predmet id)', () => {
  it('returns null when no grade matches the predmet id', () => {
    expect(gradeForCourse([g({ predmetId: '162547' })], '999')).toBeNull();
  });

  it('returns null for an empty predmet id', () => {
    expect(gradeForCourse([g({ predmetId: '162547' })], '')).toBeNull();
  });

  it('matches by predmetId even when courseCode is undefined (real IS data shape)', () => {
    const grade = g({ courseCode: undefined, predmetId: '162547', gradeLetter: 'A', gradeText: 'výborně (A)' });
    expect(gradeForCourse([grade], '162547')).toBe(grade);
  });

  it('falls back to courseCode when the predmet id has drifted', () => {
    const grade = g({ predmetId: '999', courseCode: 'EBC-OP1', gradeLetter: 'A' });
    expect(gradeForCourse([grade], '162539', 'EBC-OP1')).toBe(grade);
  });

  it('prefers a passing grade over an earlier failed attempt', () => {
    const fail = g({ predmetId: '5', gradeLetter: 'F', attempt: 1 });
    const pass = g({ predmetId: '5', gradeLetter: 'B', attempt: 2 });
    expect(gradeForCourse([fail, pass], '5')).toBe(pass);
  });

  it('falls back to the latest attempt when none passed', () => {
    const a1 = g({ predmetId: '6', gradeLetter: 'F', attempt: 1 });
    const a2 = g({ predmetId: '6', gradeLetter: 'F', attempt: 2 });
    expect(gradeForCourse([a1, a2], '6')).toBe(a2);
  });
});

import { gradeBadge } from '../gradeLookup';

describe('gradeBadge', () => {
  it('returns the letter for a graded exam', () => {
    expect(gradeBadge(g({ gradeLetter: 'A', gradeText: 'výborně (A)' }))).toEqual({ kind: 'letter', text: 'A', passed: true });
  });

  it('marks F as not passed', () => {
    expect(gradeBadge(g({ gradeLetter: 'F', gradeText: 'nedostatečně (F)' }))).toEqual({ kind: 'letter', text: 'F', passed: false });
  });

  it('maps a zápočet (no letter) to credited', () => {
    expect(gradeBadge(g({ gradeLetter: '', gradeText: 'započteno (zap)' }))).toEqual({ kind: 'credited' });
  });

  it('maps a zakončení (no letter) to completed', () => {
    expect(gradeBadge(g({ gradeLetter: '', gradeText: 'úspěšně absolvován (zak)' }))).toEqual({ kind: 'completed' });
  });

  it('returns null for a null grade or an unrecognised no-letter result', () => {
    expect(gradeBadge(null)).toBeNull();
    expect(gradeBadge(g({ gradeLetter: '', gradeText: 'neabsolvováno' }))).toBeNull();
  });
});
