import { describe, it, expect } from 'vitest';
import { groupTeachersByRole } from '../teacherGroups';

// Ekonometrie 1 as IS lists it: one garant who also lectures, tutors and
// examines, and three people who only tutor.
const EKONOMETRIE = [
  { name: 'doc. Ing. Václav Adamec, Ph.D.', id: '12162', roles: 'cvičící' },
  { name: 'Ing. Martin Baťka', id: '76293', roles: 'cvičící' },
  {
    name: 'doc. Ing. Luboš Střelec, Ph.D.',
    id: '2244',
    roles: 'cvičící, garant, přednášející, zkoušející',
  },
  { name: 'Ing. Terézia Vančová, Ph.D.', id: '50706', roles: 'cvičící' },
];

describe('groupTeachersByRole', () => {
  /**
   * The drawer used to print every teacher in one comma-joined line — for
   * Ekonometrie four names and six titles wrapping over two lines, with
   * nothing saying who runs the course and who teaches a seminar.
   */
  it('files each teacher once, under the most senior role they hold', () => {
    const groups = groupTeachersByRole(EKONOMETRIE);
    expect(groups.map((g) => g.role)).toEqual(['guarantor', 'tutor']);
    expect(groups[0]!.teachers.map((t) => t.id)).toEqual(['2244']);
    // Střelec also tutors, and is not listed a second time among the tutors.
    expect(groups[1]!.teachers.map((t) => t.id)).toEqual(['12162', '76293', '50706']);
  });

  it('orders groups garant, přednášející, cvičící, zkoušející', () => {
    const groups = groupTeachersByRole([
      { name: 'Z', id: '4', roles: 'zkoušející' },
      { name: 'C', id: '3', roles: 'cvičící' },
      { name: 'P', id: '2', roles: 'přednášející' },
      { name: 'G', id: '1', roles: 'garant' },
    ]);
    expect(groups.map((g) => g.role)).toEqual(['guarantor', 'lecturer', 'tutor', 'examiner']);
  });

  it('reads the English syllabus the same way', () => {
    const groups = groupTeachersByRole([
      { name: 'A', id: '1', roles: 'guarantor, lecturer' },
      { name: 'B', id: '2', roles: 'seminar supervisor' },
    ]);
    expect(groups.map((g) => g.role)).toEqual(['guarantor', 'tutor']);
  });

  it('keeps a role it does not know rather than dropping the person', () => {
    // "tutor" appears in real data, and IS may add others; losing a teacher
    // from the list is worse than an unsorted group at the end.
    const groups = groupTeachersByRole([{ name: 'T', id: '9', roles: 'konzultant' }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.role).toBe('other');
    expect(groups[0]!.teachers[0]!.name).toBe('T');
  });

  it('gives nothing for nobody', () => {
    expect(groupTeachersByRole(undefined)).toEqual([]);
    expect(groupTeachersByRole([])).toEqual([]);
  });
});
