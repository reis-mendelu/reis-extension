import { describe, it, expect, vi } from 'vitest';
import { runBackgroundCheck, type BackgroundDeps } from '../backgroundCheck';
import type { Odevzdavarna } from '../../api/odevzdavarny';

const box = (id: string): Odevzdavarna =>
  ({
    courseId: '1',
    courseNameCs: 'Matematika',
    courseNameEn: 'Maths',
    name: `Box ${id}`,
    odevzdavarnaId: id,
  }) as Odevzdavarna;

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
    fetchExams: async () => [],
    persistExamTerms: async () => [],
    syncBoxes: async () => ({ assignments: [box('b1')], lastFetched: 0, periods: [] }),
    persistBoxes: async () => ({ found: [], unseen: [] }),
    boxKey: (b) => b.odevzdavarnaId,
    syncZaznamnik: async () => ({}),
    persistZaznamnik: async () => ({ found: {} }),
    notify: vi.fn(),
    logError: vi.fn(),
    ...over,
  };
}

describe('runBackgroundCheck', () => {
  it('does nothing without a session or without the student params', async () => {
    const signedOut = deps({ hasSession: async () => false });
    expect(await runBackgroundCheck(signedOut)).toBe('signed-out');
    expect(signedOut.notify).not.toHaveBeenCalled();
    const noParams = deps({ params: async () => null });
    expect(await runBackgroundCheck(noParams)).toBe('no-params');
    expect(noParams.notify).not.toHaveBeenCalled();
  });

  it('skips the whole run while a sync holds the lock', async () => {
    const d = deps({ withSyncLock: async () => false, fetchExams: vi.fn() });
    expect(await runBackgroundCheck(d)).toBe('busy');
    expect(d.fetchExams).not.toHaveBeenCalled();
  });

  it('stays silent when nothing is new', async () => {
    const d = deps();
    expect(await runBackgroundCheck(d)).toBe('done');
    expect(d.notify).not.toHaveBeenCalled();
  });

  it('notifies once per kind for a new box, term and point', async () => {
    const d = deps({
      persistExamTerms: async () => [
        {
          key: 'k',
          courseCode: 'EBC-A',
          subjectCs: 'Algoritmy',
          subjectEn: 'Algo',
          date: '1.2.2027',
          time: '8:00',
        },
      ],
      persistBoxes: async () => ({ found: ['b1'], unseen: ['b1'] }),
      persistZaznamnik: async () => ({ found: { 'EBC-A': [{ label: 'Test', value: '9' }] } }),
    });
    await runBackgroundCheck(d);
    expect(d.notify).toHaveBeenCalledTimes(1);
    const [list] = (d.notify as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { kind: string; title: string }[],
    ];
    expect(list.map((n) => n.kind)).toEqual(['exams', 'boxes', 'points']);
    expect(list[1]?.title).toBe('Nová odevzdávárna: Algoritmy');
  });

  it('a failing language read still announces what was found, in Czech', async () => {
    const d = deps({
      language: async () => {
        throw new Error('idb gone');
      },
      persistBoxes: async () => ({ found: ['b1'], unseen: ['b1'] }),
    });
    await runBackgroundCheck(d);
    expect(d.notify).toHaveBeenCalledTimes(1);
    const [list] = (d.notify as ReturnType<typeof vi.fn>).mock.calls[0] as [{ title: string }[]];
    expect(list[0]?.title).toMatch(/^Nová odevzdávárna/);
  });

  it('one failing step does not cost the others', async () => {
    const d = deps({
      fetchExams: async () => {
        throw new Error('IS down');
      },
      persistBoxes: async () => ({ found: ['b1'], unseen: ['b1'] }),
    });
    expect(await runBackgroundCheck(d)).toBe('done');
    expect(d.logError).toHaveBeenCalledWith('Background.exams', expect.any(Error));
    expect(d.notify).toHaveBeenCalledTimes(1);
  });

  it('asks záznamník only for the current semester subjects it fetched', async () => {
    const syncZaznamnik = vi.fn(async () => ({}));
    await runBackgroundCheck(deps({ syncZaznamnik }));
    expect(syncZaznamnik).toHaveBeenCalledWith('s', 'o', [
      { courseCode: 'EBC-A', subjectId: '1', hasPrubezne: true, hasTest: undefined },
    ]);
  });
});
