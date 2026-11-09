import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StudyPlan, SubjectStatus } from '../../types/studyPlan';
import {
  pastSubjectCodes,
  isPastSubject,
  codeForCourseId,
  withoutPastSubjects,
} from '../pastSubjects';

// Made-up codes and ids, in the shapes IS's study plan parses to.
const row = (code: string, over: Partial<SubjectStatus>): SubjectStatus => ({
  id: `id-${code}`,
  code,
  name: code,
  credits: 5,
  type: 'zk',
  isEnrolled: false,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: 'NEZAPSÁNO',
  ...over,
});

const plan = (...subjects: SubjectStatus[]): StudyPlan => ({
  title: 'plan',
  isFulfilled: false,
  creditsAcquired: 0,
  creditsRequired: 180,
  blocks: [{ title: '1. semestr', groups: [{ name: 'g', statusDescription: '', subjects }] }],
});

// Passed last winter, still on the plan.
const passedLastYear = row('XX-OLD', {
  isFulfilled: true,
  enrollmentCount: 1,
  fulfillmentDate: '05.01.2026',
  rawStatusText: 'SPLNĚNO (05.01.2026)',
});
// Enrolled now.
const enrolled = row('XX-NOW', { isEnrolled: true, enrollmentCount: 1, rawStatusText: 'ZAPSÁNO' });
// Taken before, failed, not taken again.
const failedBefore = row('XX-FAIL', { enrollmentCount: 1, rawStatusText: 'NESPLNĚNO' });
// Never enrolled: what a stale plan says about the new semester's subjects.
const neverEnrolled = row('XX-NEW', {});

describe('pastSubjectCodes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 7, 12, 0)); // 7 Nov 2026, winter semester
  });
  afterEach(() => vi.useRealTimers());

  it('names subjects the plan places in an earlier semester', () => {
    const past = pastSubjectCodes(plan(passedLastYear, enrolled, failedBefore, neverEnrolled));
    expect([...past].sort()).toEqual(['XX-FAIL', 'XX-OLD']);
  });

  it('knows nothing without a plan, so suppresses nothing', () => {
    expect(pastSubjectCodes(null).size).toBe(0);
    expect(isPastSubject(pastSubjectCodes(undefined), 'XX-OLD')).toBe(false);
  });

  // A stale plan (last semester's, from IndexedDB) lists the new semester's
  // subjects as never enrolled: they must still notify until it refreshes.
  it('never suppresses a subject the plan says was never enrolled', () => {
    expect(isPastSubject(pastSubjectCodes(plan(neverEnrolled)), 'XX-NEW')).toBe(false);
  });

  it('never suppresses a code the plan does not list, nor an unknown one', () => {
    const past = pastSubjectCodes(plan(passedLastYear));
    expect(isPastSubject(past, 'XX-ELSEWHERE')).toBe(false);
    expect(isPastSubject(past, null)).toBe(false);
    expect(isPastSubject(past, undefined)).toBe(false);
  });

  // Uznaný předmět: passed with no attempt here, still an earlier semester's.
  it('a subject recognised in an earlier semester is past too', () => {
    const recognised = row('XX-UZN', { isFulfilled: true, fulfillmentDate: '20.09.2025' });
    expect(isPastSubject(pastSubjectCodes(plan(recognised)), 'XX-UZN')).toBe(true);
  });

  it('a subject passed this semester is still this semester', () => {
    const passedNow = row('XX-DONE', {
      isFulfilled: true,
      enrollmentCount: 1,
      fulfillmentDate: '02.11.2026',
    });
    expect(isPastSubject(pastSubjectCodes(plan(passedNow)), 'XX-DONE')).toBe(false);
  });

  // IS repeats a subject across blocks; a retake is enrolled again.
  it('an enrolled row wins over a past row of the same code', () => {
    const retake = row('XX-FAIL', { isEnrolled: true, enrollmentCount: 2 });
    expect(isPastSubject(pastSubjectCodes(plan(failedBefore, retake)), 'XX-FAIL')).toBe(false);
  });

  it('Zaměření placeholder rows and blank codes are ignored', () => {
    expect(pastSubjectCodes(plan(row('', { enrollmentCount: 1 }))).size).toBe(0);
  });
});

describe('winter exam period', () => {
  afterEach(() => vi.useRealTimers());

  // A ZS subject the student has not passed yet stays enrolled through the
  // January–February exam period, so its exams and points still notify.
  it('a winter subject still enrolled in January or February is not past', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    for (const month of [0, 1]) {
      vi.setSystemTime(new Date(2027, month, 20, 12, 0));
      expect(isPastSubject(pastSubjectCodes(plan(enrolled)), 'XX-NOW')).toBe(false);
    }
  });
});

describe('codeForCourseId', () => {
  it('finds the code through the subjects store, which keeps past subjects under their old id', () => {
    const subjects = { 'XX-OLD': { subjectId: '111' }, 'XX-NOW': { subjectId: '222' } };
    expect(codeForCourseId('111', subjects)).toBe('XX-OLD');
    expect(codeForCourseId('999', subjects)).toBeNull();
    expect(codeForCourseId('', subjects)).toBeNull();
    expect(codeForCourseId('111', undefined)).toBeNull();
  });
});

describe('withoutPastSubjects', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 7, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('drops the past subjects from a code-keyed map and keeps the rest', () => {
    const past = pastSubjectCodes(plan(passedLastYear, enrolled));
    const found = {
      'XX-OLD': [{ label: 'T1', value: '5' }],
      'XX-NOW': [{ label: 'T1', value: '9' }],
    };
    expect(withoutPastSubjects(found, past)).toEqual({ 'XX-NOW': [{ label: 'T1', value: '9' }] });
  });
});
