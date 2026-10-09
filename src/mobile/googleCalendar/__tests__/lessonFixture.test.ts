import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeLessons } from '../normalize';
import { toDesired } from '../toGoogleEvent';
import type { BlockLesson } from '../../../types/calendarTypes';

/**
 * Golden output of the mapping. A change here changes every hash, so every
 * future event is rewritten once on each student's next sync. Make it on purpose.
 * Regenerate deliberately: UPDATE_GCAL_FIXTURES=1 npx vitest run lessonFixture
 */
const PATH = resolve(__dirname, '../__fixtures__/lessonEvents.json');

interface Case {
  name: string;
  lang: 'cz' | 'en';
  /** The MERGED lesson shape both paths produce: CZ base + EN name/room (mergeDualLanguageLessons). */
  lesson: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    courseName: string;
    courseNameCs: string;
    courseNameEn: string;
    room: string;
    roomCs: string;
    roomEn: string;
    isSeminar: string;
    teachers: string[];
  };
  expected?: { id: string; hash: string; body: unknown };
}

const L = (
  o: Partial<Case['lesson']> & Pick<Case['lesson'], 'id' | 'courseName' | 'room'>
): Case['lesson'] => ({
  date: '20261012',
  startTime: '09:00',
  endTime: '10:50',
  isSeminar: 'false',
  teachers: [],
  courseNameCs: o.courseName,
  courseNameEn: o.courseName,
  roomCs: o.room,
  roomEn: o.room,
  ...o,
});
const INPUTS: Omit<Case, 'expected'>[] = [
  {
    name: 'cz lecture',
    lang: 'cz',
    lesson: L({ id: '123', courseName: 'Ekonomie I', room: 'Q01', teachers: ['doc. Jan Novák'] }),
  },
  {
    name: 'en seminar, EN name and room differ, two teachers',
    lang: 'en',
    lesson: L({
      id: '124',
      date: '20261013',
      startTime: '13:00',
      endTime: '14:50',
      courseName: 'Ekonomie I',
      courseNameEn: 'Economics I',
      room: 'Q02',
      roomEn: 'Q02 (EN)',
      isSeminar: 'true',
      teachers: ['A B', 'C D'],
    }),
  },
  {
    name: 'no teacher, no room, diacritics',
    lang: 'cz',
    lesson: L({
      id: '9',
      date: '20270301',
      startTime: '07:00',
      endTime: '08:50',
      courseName: 'Účetnictví – úvod',
      room: '',
    }),
  },
];

const toBlock = (l: Case['lesson']): BlockLesson =>
  ({
    ...l,
    teachers: l.teachers.map((fullName, i) => ({ fullName, shortName: fullName, id: String(i) })),
  }) as unknown as BlockLesson;

async function compute(c: Omit<Case, 'expected'>): Promise<Case> {
  const [n] = normalizeLessons([toBlock(c.lesson)], c.lang);
  const d = await toDesired(n!);
  return { ...c, expected: { id: d.id, hash: d.hash, body: d.body } };
}

describe('golden lesson fixture', () => {
  it('TS mapping equals the frozen fixture', async () => {
    const computed = await Promise.all(INPUTS.map(compute));
    if (process.env.UPDATE_GCAL_FIXTURES)
      writeFileSync(PATH, JSON.stringify(computed, null, 2) + '\n');
    expect(JSON.parse(readFileSync(PATH, 'utf8'))).toEqual(computed);
  });
});
