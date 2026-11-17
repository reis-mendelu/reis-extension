import { describe, it, expect, vi } from 'vitest';
import { runBackgroundCheck, type BackgroundDeps } from '../backgroundCheck';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import type { ExamSubject } from '../../types/exams';

const box = (id: string): Odevzdavarna =>
  ({
    courseId: '1',
    courseNameCs: 'Matematika',
    courseNameEn: 'Maths',
    name: `Box ${id}`,
    odevzdavarnaId: id,
  }) as Odevzdavarna;

const exam = { version: 1, id: 'EBC-A', name: 'Alg', code: 'EBC-A', sections: [] } as ExamSubject;

function deps(over: Partial<BackgroundDeps> = {}): BackgroundDeps {
  return {
    hasSession: async () => true,
    params: async () => ({ studium: 's', obdobi: 'o' }),
    language: async () => 'cz',
    withSyncLock: async (job) => {
      await job();
      return true;
    },
    fetchSubjects: async () => ({
      version: 1,
      lastUpdated: '',
      data: {
        'EBC-A': {
          displayName: 'Alg',
          fullName: 'Algoritmy',
          nameCs: 'Algoritmy',
          subjectCode: 'EBC-A',
          subjectId: '1',
          folderUrl: '',
          fetchedAt: '',
          hasPrubezne: true,
        },
      },
    }),
    fetchExams: async () => [exam],
    recordTerms: vi.fn(async () => undefined),
    syncBoxes: async () => ({ assignments: [box('b1')], lastFetched: 0, periods: [] }),
    persistBoxes: vi.fn(async () => undefined),
    syncZaznamnik: async () => ({}),
    persistZaznamnik: vi.fn(async () => undefined),
    announce: vi.fn(async () => undefined),
    logError: vi.fn(),
    ...over,
  };
}

describe('runBackgroundCheck', () => {
  it('does nothing without a session or without the student params', async () => {
    const signedOut = deps({ hasSession: async () => false });
    expect(await runBackgroundCheck(signedOut)).toBe('signed-out');
    expect(signedOut.announce).not.toHaveBeenCalled();
    const noParams = deps({ params: async () => null });
    expect(await runBackgroundCheck(noParams)).toBe('no-params');
    expect(noParams.announce).not.toHaveBeenCalled();
  });

  it('skips the whole run while a sync holds the lock', async () => {
    const d = deps({ withSyncLock: async () => false, fetchExams: vi.fn() });
    expect(await runBackgroundCheck(d)).toBe('busy');
    expect(d.fetchExams).not.toHaveBeenCalled();
    expect(d.announce).not.toHaveBeenCalled();
  });

  // The terms go through the app's own step, so a new one is a Novinky row too.
  it('records the terms, persists boxes and points, then announces with the fresh lists', async () => {
    const d = deps();
    expect(await runBackgroundCheck(d)).toBe('done');
    expect(d.recordTerms).toHaveBeenCalledWith([exam]);
    expect(d.persistBoxes).toHaveBeenCalledWith([box('b1')], 'o');
    expect(d.persistZaznamnik).toHaveBeenCalled();
    expect(d.announce).toHaveBeenCalledWith(
      {
        exams: [exam],
        boxes: [box('b1')],
        subjects: expect.objectContaining({ 'EBC-A': expect.anything() }),
      },
      'cz'
    );
  });

  it('IS failing for one step costs only that step', async () => {
    const d = deps({
      fetchExams: async () => {
        throw new Error('IS hiccup');
      },
    });
    expect(await runBackgroundCheck(d)).toBe('done');
    expect(d.recordTerms).not.toHaveBeenCalled();
    expect(d.persistBoxes).toHaveBeenCalled();
    expect(d.announce).toHaveBeenCalledWith(expect.objectContaining({ exams: [] }), 'cz');
  });

  it('a failed language read costs only the wording', async () => {
    const d = deps({
      language: async () => {
        throw new Error('IndexedDB unavailable');
      },
    });
    await runBackgroundCheck(d);
    expect(d.announce).toHaveBeenCalledWith(expect.anything(), 'cz');
  });

  // A half-failed fetch reads as no exams: recorded, it would make the next
  // full read announce every term.
  it('does not record an empty exam read as the baseline', async () => {
    const d = deps({ fetchExams: async () => [] });
    await runBackgroundCheck(d);
    expect(d.recordTerms).not.toHaveBeenCalled();
  });
});
