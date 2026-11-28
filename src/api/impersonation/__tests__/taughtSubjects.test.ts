import { describe, it, expect } from 'vitest';
import { taughtSubjects } from '../taughtSubjects';
import type { BlockLesson } from '../../../types/schedule';

const lesson = (courseCode: string, courseName: string) =>
  ({
    courseCode,
    courseName,
    courseNameEn: `${courseName} EN`,
    courseId: `id-${courseCode}`,
  }) as BlockLesson;

describe('taughtSubjects', () => {
  it('adds what the group is taught and the plan semester does not list', () => {
    const out = taughtSubjects(
      [lesson('BOTAZ', 'Botanika'), lesson('BOTAZ', 'Botanika')],
      new Set(),
      't'
    );
    expect(Object.keys(out)).toEqual(['BOTAZ']);
    expect(out['BOTAZ']).toMatchObject({
      nameCs: 'Botanika',
      nameEn: 'Botanika EN',
      subjectId: 'id-BOTAZ',
    });
  });

  it('leaves out every code of the plan semester, an elective beyond the minimum too', () => {
    const planned = new Set(['EKOE1', 'VOLIT1']);
    const out = taughtSubjects([lesson('EKOE1', 'E'), lesson('VOLIT1', 'V')], planned, 't');
    expect(out).toEqual({});
  });
});
