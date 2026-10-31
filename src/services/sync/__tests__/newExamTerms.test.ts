import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExamSubject } from '../../../types/exams';

/** A map stands in for IndexedDB, as in newSubmissionBoxes.test.ts. */
const { db } = vi.hoisted(() => ({ db: new Map<string, unknown>() }));
vi.mock('../../storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, v: unknown) => db.set(`${store}/${key}`, v)),
    delete: vi.fn(async (store: string, key: string) => db.delete(`${store}/${key}`)),
  },
}));

import { persistExamTerms, resetExamTerms, KNOWN_TERMS_META_KEY } from '../newExamTerms';

const exams = (...ids: string[]): ExamSubject[] => [
  {
    version: 1,
    id: 'A',
    name: 'A',
    code: 'EBC-A',
    sections: [
      {
        id: 's1',
        name: 'zkouška',
        type: 'exam',
        status: 'available',
        terms: ids.map((id) => ({ id, date: '12.01.2027', time: '08:00' })),
      },
    ],
  },
];

const signIn = () => db.set('meta/reis_user_params', { studium: 'st', obdobi: 'P1' });

describe('persistExamTerms', () => {
  beforeEach(() => db.clear());

  it('records the first list as the baseline and announces nothing', async () => {
    signIn();
    expect(await persistExamTerms(exams('1', '2'))).toEqual([]);
    expect((db.get(`meta/${KNOWN_TERMS_META_KEY}`) as { ids: string[] }).ids).toHaveLength(2);
  });

  it('announces a term that appears later, once', async () => {
    signIn();
    await persistExamTerms(exams('1'));
    expect((await persistExamTerms(exams('1', '2'))).map((t) => t.date)).toEqual(['12.01.2027']);
    expect(await persistExamTerms(exams('1', '2'))).toEqual([]);
  });

  it('an empty list keeps what is known and a later term is news', async () => {
    signIn();
    await persistExamTerms([]);
    expect(await persistExamTerms(exams('1'))).toHaveLength(1);
    await persistExamTerms([]);
    expect(await persistExamTerms(exams('1'))).toEqual([]);
  });

  it('writes nothing for a signed-out device', async () => {
    expect(await persistExamTerms(exams('1'))).toEqual([]);
    expect(db.has(`meta/${KNOWN_TERMS_META_KEY}`)).toBe(false);
  });

  it('reset forgets the record', async () => {
    signIn();
    await persistExamTerms(exams('1'));
    await resetExamTerms();
    expect(db.has(`meta/${KNOWN_TERMS_META_KEY}`)).toBe(false);
  });
});
