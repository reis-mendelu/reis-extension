import { describe, it, expect } from 'vitest';
import { composeBackgroundNotifications } from '../backgroundNotifications';

const nameOf = (code: string) => `Předmět ${code}`;

describe('composeBackgroundNotifications', () => {
  it('says nothing when nothing is new', () => {
    expect(
      composeBackgroundNotifications({ terms: [], boxes: [], points: {} }, 'cz', nameOf)
    ).toEqual([]);
  });

  it('one notification per kind, however many items', () => {
    const out = composeBackgroundNotifications(
      {
        terms: [
          {
            courseCode: 'EBC-A',
            subjectCs: 'A',
            subjectEn: 'A',
            date: '12.01.2027',
            time: '08:00',
          },
          {
            courseCode: 'EBC-B',
            subjectCs: 'B',
            subjectEn: 'B',
            date: '13.01.2027',
            time: '09:00',
          },
        ],
        boxes: [{ courseCode: 'EBC-A', name: 'Projekt' }],
        points: { 'EBC-A': [{ label: 'Test', value: '9' }] },
      },
      'cz',
      nameOf
    );
    expect(out.map((n) => n.kind)).toEqual(['exams', 'boxes', 'points']);
    expect(out[0]).toMatchObject({ title: 'Nové termíny zkoušek', body: 'A, B' });
    expect(out[1]).toMatchObject({ title: 'Nová odevzdávárna: Předmět EBC-A', body: 'Projekt' });
    expect(out[2]?.title).toBe('Nové body: Předmět EBC-A');
  });

  it('carries the subject a tap should open: one subject, or none for a summary', () => {
    const out = composeBackgroundNotifications(
      {
        terms: [],
        boxes: [
          { courseCode: 'EBC-A', name: 'Projekt' },
          { courseCode: 'EBC-B', name: 'Esej' },
        ],
        points: { 'EBC-A': [{ label: 'Test', value: '9' }] },
      },
      'cz',
      nameOf
    );
    expect(out.find((n) => n.kind === 'boxes')?.courseCode).toBeNull();
    expect(out.find((n) => n.kind === 'points')?.courseCode).toBe('EBC-A');
  });

  it('a single term names its date and time, in the student language', () => {
    const [n] = composeBackgroundNotifications(
      {
        terms: [
          {
            courseCode: 'EBC-A',
            subjectCs: 'Alg',
            subjectEn: 'Algo',
            date: '12.01.2027',
            time: '08:00',
          },
        ],
        boxes: [],
        points: {},
      },
      'en',
      nameOf
    );
    expect(n).toMatchObject({ title: 'New exam date: Algo', body: '12.01.2027 at 08:00' });
  });

  it('several boxes of one subject read as that subject, of several as a list', () => {
    const one = composeBackgroundNotifications(
      {
        terms: [],
        boxes: [
          { courseCode: 'X', name: 'a' },
          { courseCode: 'X', name: 'b' },
        ],
        points: {},
      },
      'cz',
      nameOf
    )[0];
    expect(one).toMatchObject({ title: 'Nová odevzdávárna: Předmět X', body: 'a, b' });
    const many = composeBackgroundNotifications(
      {
        terms: [],
        boxes: [
          { courseCode: 'X', name: 'a' },
          { courseCode: 'Y', name: 'b' },
        ],
        points: {},
      },
      'cz',
      nameOf
    )[0];
    expect(many).toMatchObject({ title: 'Nové odevzdávárny', body: 'Předmět X, Předmět Y' });
  });
});
