import { describe, it, expect } from 'vitest';
import { pushForStudy } from '../pushForStudy';

const push = {
  studium: '900011',
  schedule: [{ id: 'l1' }],
  exams: [{ code: 'OLD' }],
  cvicneTests: [{ id: 't1' }],
  subjects: { data: {} },
  odevzdavarny: [],
  loaded: ['schedule', 'exams'] as ('schedule' | 'exams')[],
  isSyncing: true,
  lastSync: 5,
};

describe('pushForStudy', () => {
  it('takes a push for the study in use whole', () => {
    expect(pushForStudy(push, '900011')).toBe(push);
  });

  // The crawl that was running when the student switched to 900012.
  it('keeps only the timetable and the sync status from the study the student left', () => {
    expect(pushForStudy(push, '900012')).toEqual({
      studium: '900011',
      schedule: [{ id: 'l1' }],
      isSyncing: true,
      lastSync: 5,
      error: undefined,
      loaded: ['schedule'],
    });
  });

  it('takes an unstamped push, or any push before a study is known', () => {
    const { studium: _s, ...unstamped } = push;
    expect(pushForStudy(unstamped, '900012')).toBe(unstamped);
    expect(pushForStudy(push, null)).toBe(push);
  });
});
