import { describe, it, expect } from 'vitest';
import { foldPastSemesterSubjects } from '../pastSemesterSubjects';

const info = (code: string) => ({
  subjectCode: code,
  subjectId: `id-${code}`,
  displayName: code,
  fullName: code,
  folderUrl: 'https://is.mendelu.cz/x',
  fetchedAt: '2026-01-01',
  hasPrubezne: true,
});

describe('foldPastSemesterSubjects', () => {
  it('adds a past subject with the period it came from, so its points can be fetched there', () => {
    const target: Record<string, ReturnType<typeof info>> = {};
    foldPastSemesterSubjects(target, { PS: info('PS') }, '300');
    expect(target['PS']).toMatchObject({ subjectId: 'id-PS', periodId: '300' });
  });

  it('never overwrites a subject the current semester already lists', () => {
    const current = info('PS');
    const target = { PS: current };
    foldPastSemesterSubjects(target, { PS: info('PS') }, '300');
    expect(target['PS']).toBe(current);
    expect(target['PS']).not.toHaveProperty('periodId');
  });

  it('keeps the first period for a subject taken in two', () => {
    const target: Record<string, ReturnType<typeof info>> = {};
    foldPastSemesterSubjects(target, { PS: info('PS') }, '300');
    foldPastSemesterSubjects(target, { PS: info('PS') }, '200');
    expect(target['PS']).toMatchObject({ periodId: '300' });
  });
});
