import { describe, it, expect } from 'vitest';
import { personaStats, personaVerdict, type PersonaRow } from '../personaStats';
import type { ImpersonationResult } from '../../../src/api/impersonation/types';
import type { BlockLesson } from '../../../src/types/schedule';

const lesson = (code: string, seminar: boolean, date: string, start: string): BlockLesson =>
  ({
    courseCode: code,
    isSeminar: seminar ? 'true' : 'false',
    date,
    startTime: start,
  }) as BlockLesson;

const result = (schedule: BlockLesson[], subjects: string[]): ImpersonationResult =>
  ({
    plan: {
      cz: {
        blocks: [
          {
            title: '1',
            groups: [{ subjects: subjects.map((code) => ({ code, isEnrolled: code !== 'B' })) }],
          },
        ],
      },
    },
    schedule,
    subjects: { data: Object.fromEntries(subjects.map((c) => [c, {}])) },
  }) as unknown as ImpersonationResult;

describe('personaStats', () => {
  it('counts plan rows, subjects, lectures, seminars and the busiest subject’s seminar slots', () => {
    const r = result(
      [
        lesson('A', false, '20260921', '09:00'),
        lesson('A', false, '20260928', '09:00'),
        lesson('A', true, '20260922', '11:00'),
        lesson('A', true, '20260929', '11:00'), // same weekly slot
        lesson('B', true, '20260923', '13:00'),
        lesson('B', true, '20260924', '13:00'), // another weekday: a 2nd slot
      ],
      ['A', 'B', 'C']
    );
    expect(personaStats(r)).toEqual({
      planRows: 3,
      planSubjects: 2,
      subjects: 3,
      lectures: 2,
      seminars: 4,
      maxSeminarSlots: 2,
      subjectsWithoutLessons: 1,
      timetableOnly: 1,
    });
  });
});

describe('personaVerdict', () => {
  const ok: PersonaRow = {
    id: 'it',
    code: 'B-OI',
    group: 1,
    stats: {
      planRows: 9,
      planSubjects: 6,
      subjects: 6,
      lectures: 40,
      seminars: 50,
      maxSeminarSlots: 1,
      subjectsWithoutLessons: 0,
      timetableOnly: 0,
    },
  };
  it('passes a full row', () => expect(personaVerdict(ok)).toEqual([]));
  it('fails an unresolved code, an error, 0 subjects, 0 lectures, 0 seminars with a group', () => {
    expect(personaVerdict({ ...ok, code: null, stats: null, error: 'noPlan' })).toContain(
      'unresolved'
    );
    expect(personaVerdict({ ...ok, stats: null, error: 'timetable' })).toContain(
      'error: timetable'
    );
    expect(personaVerdict({ ...ok, stats: { ...ok.stats!, subjects: 0 } })).toContain('0 subjects');
    expect(personaVerdict({ ...ok, stats: { ...ok.stats!, planSubjects: 0 } })).toContain(
      '0 plan subjects'
    );
    expect(personaVerdict({ ...ok, stats: { ...ok.stats!, lectures: 0 } })).toContain('0 lectures');
    expect(personaVerdict({ ...ok, stats: { ...ok.stats!, seminars: 0 } })).toContain('0 seminars');
  });
  it('flags a subject with several seminar slots: the group filter did not narrow it', () => {
    expect(personaVerdict({ ...ok, stats: { ...ok.stats!, maxSeminarSlots: 6 } })).toContain(
      'seminars not narrowed to one group'
    );
  });
});
