import { describe, it, expect } from 'vitest';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import { boxKey, findNewBoxes } from '../newSubmissionBoxes';
import { newBoxAlerts } from '../newSubmissionBoxAlerts';

const NOW = new Date(2026, 9, 29, 12, 0).getTime();

const box = (over: Partial<Odevzdavarna>): Odevzdavarna => ({
  courseId: '164074',
  courseNameCs: 'Matematika',
  courseNameEn: 'Mathematics',
  name: 'Build MATLAB Proficiency (bonus body)',
  type: '',
  deadline: '20.12.2026 23:59',
  odevzdavarnaId: '9001',
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
  section: 'open',
  isOpen: true,
  ...over,
});

describe('boxKey', () => {
  it("is IS's own box id", () => {
    expect(boxKey(box({}))).toBe('9001');
  });

  // Two subjects can both have a "Projekt": the name alone would merge them.
  it('falls back to the subject and the name, never the name alone', () => {
    const a = boxKey(box({ odevzdavarnaId: '', courseId: '1', name: 'Projekt' }));
    const b = boxKey(box({ odevzdavarnaId: '', courseId: '2', name: 'Projekt' }));
    expect(a).not.toBe(b);
  });
});

describe('findNewBoxes', () => {
  it('announces nothing on first sight: what is there is the baseline', () => {
    expect(findNewBoxes(undefined, [box({})], NOW)).toEqual([]);
  });

  it('a box missing from the known ids is new', () => {
    expect(findNewBoxes(new Set(['1']), [box({ odevzdavarnaId: '1' }), box({})], NOW)).toEqual([
      '9001',
    ]);
  });

  // An empty baseline is still a baseline: the first boxes of a semester that
  // started with none are exactly the news.
  it('an empty known list still makes the next box new', () => {
    expect(findNewBoxes(new Set(), [box({})], NOW)).toEqual(['9001']);
  });

  it('a box the student cannot upload to is not news', () => {
    expect(findNewBoxes(new Set(), [box({ section: 'closed', isOpen: false })], NOW)).toEqual([]);
  });

  it('a box whose deadline already passed is not news', () => {
    expect(findNewBoxes(new Set(), [box({ deadline: '01.10.2026 10:00' })], NOW)).toEqual([]);
  });

  it('a box already handed in is not news', () => {
    expect(findNewBoxes(new Set(), [box({ section: 'submitted', fileCount: 1 })], NOW)).toEqual([]);
  });
});

describe('newBoxAlerts', () => {
  const subjects = { 'EBC-MAT': { nameCs: 'Matematika', subjectId: '164074' } };

  it('one row per new box: subject, box name and deadline, opening the subject', () => {
    const [row, ...rest] = newBoxAlerts(['9001'], [box({})], subjects, {}, 'cz', NOW);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      id: 'odev-new-9001',
      type: 'assignment-new',
      title: 'Matematika',
      courseCode: 'EBC-MAT',
      courseId: '164074',
    });
    expect(row?.body).toBe('Build MATLAB Proficiency (bonus body)');
    expect(row?.deadline).toEqual(new Date(2026, 11, 20, 23, 59));
    // No clock: it would print hundreds of hours and sort among the deadlines.
    expect(row?.hoursUntil).toBeUndefined();
  });

  it('uses the nickname the student gave the subject', () => {
    const [row] = newBoxAlerts(['9001'], [box({})], subjects, { 'EBC-MAT': 'Mata' }, 'cz', NOW);
    expect(row?.title).toBe('Mata');
  });

  it('a box that left the list, closed or was handed in drops its row', () => {
    expect(newBoxAlerts(['9001'], [], subjects, {}, 'cz', NOW)).toEqual([]);
    expect(newBoxAlerts(['9001'], [box({ isOpen: false })], subjects, {}, 'cz', NOW)).toEqual([]);
    expect(
      newBoxAlerts(['9001'], [box({ section: 'submitted' })], subjects, {}, 'cz', NOW)
    ).toEqual([]);
  });

  it('a box whose subject reIS cannot place has no row to open', () => {
    expect(newBoxAlerts(['9001'], [box({ courseId: '999' })], subjects, {}, 'cz', NOW)).toEqual([]);
  });
});
