import { describe, it, expect } from 'vitest';
import { courseStats, personaStats, personaVerdict, type PersonaRow } from '../personaStats';
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
        lesson('B', true, '20260930', '13:00'),
        lesson('B', true, '20260924', '13:00'), // another weekday: a 2nd slot
        lesson('B', true, '20261001', '13:00'),
        lesson('B', true, '20261120', '08:00'), // a one-off block day: not counted
      ],
      ['A', 'B', 'C']
    );
    expect(personaStats(r)).toEqual({
      planRows: 3,
      planSubjects: 2,
      subjects: 3,
      lectures: 2,
      seminars: 7,
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

describe('the Erasmus row', () => {
  const noPlan = (schedule: BlockLesson[], subjects: string[]): ImpersonationResult =>
    ({ ...result(schedule, subjects), plan: null }) as ImpersonationResult;
  const r = noPlan(
    [
      lesson('EBA-MAR', false, '20260923', '08:00'),
      lesson('EBA-MAR', true, '20260923', '10:00'),
      lesson('EBA-MI', false, '20260923', '11:00'),
    ],
    ['EBA-MAR', 'EBA-MI']
  );

  it('has no plan: 0 plan rows, every taught subject is "only in timetable"', () => {
    expect(personaStats(r)).toMatchObject({
      planRows: 0,
      planSubjects: 0,
      subjects: 2,
      timetableOnly: 2,
    });
  });

  it('counts each pinned course, resolved or not', () => {
    expect(courseStats(r, ['EBA-MAR', 'EBA-MI', 'EBA-GONE'])).toEqual([
      { code: 'EBA-MAR', lectures: 1, seminars: 1 },
      { code: 'EBA-MI', lectures: 1, seminars: 0 },
      { code: 'EBA-GONE', lectures: 0, seminars: 0 },
    ]);
  });

  const erasmus = (resolved: string[]): PersonaRow => ({
    id: 'erasmus',
    code: 'Z-EXC',
    group: null,
    stats: personaStats(r),
    courses: {
      pinned: ['EBA-MAR', 'EBA-MI', 'EBA-GONE'],
      resolved,
      stats: courseStats(r, ['EBA-MAR', 'EBA-MI', 'EBA-GONE']),
    },
  });

  it('fails a pinned code IS no longer lists, and a course with no lecture or seminar', () => {
    const v = personaVerdict(erasmus(['EBA-MAR', 'EBA-MI']));
    expect(v).toContain('unresolved: EBA-GONE');
    expect(v).toContain('EBA-MI: 0 seminars');
    // Not the programme personas' plan rules: Erasmus has no plan by design.
    expect(v).not.toContain('0 plan subjects');
  });

  it('passes when every course resolves with a lecture and a seminar', () => {
    const full = noPlan(
      ['EBA-MAR', 'EBA-MI'].flatMap((c) => [
        lesson(c, false, '20260923', '08:00'),
        lesson(c, true, '20260924', '10:00'),
      ]),
      ['EBA-MAR', 'EBA-MI']
    );
    const pinned = ['EBA-MAR', 'EBA-MI'];
    const row: PersonaRow = {
      id: 'erasmus',
      code: 'Z-EXC',
      group: null,
      stats: personaStats(full),
      courses: { pinned, resolved: pinned, stats: courseStats(full, pinned) },
    };
    expect(personaVerdict(row)).toEqual([]);
  });
});
