import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/userParams', () => ({
  getUserParams: vi.fn(async () => ({ studium: 'S1', obdobi: 'O1' })),
}));
vi.mock('@/injector/dataFetchers', () => ({
  fetchFullSemesterSchedule: vi.fn(async () => [{ id: 'lesson1' }]),
}));
vi.mock('@/api/exams', () => ({ fetchDualLanguageExams: vi.fn(async () => [{ code: 'X' }]) }));
vi.mock('@/api/subjects', () => ({
  fetchDualLanguageSubjects: vi.fn(async () => ({
    subjects: { data: {} },
    attendance: {},
    availablePeriods: [],
  })),
}));
vi.mock('@/api/pastSubjects', () => ({ fetchDualLanguagePastSubjects: vi.fn(async () => null) }));
vi.mock('@/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn(async () => null) }));
vi.mock('@/api/studyStats', () => ({ fetchStudyStats: vi.fn(async () => null) }));
vi.mock('@/api/studyComparison', () => ({ fetchStudyComparison: vi.fn(async () => null) }));
vi.mock('@/services/sync/syncCvicneTests', () => ({ syncCvicneTests: vi.fn(async () => null) }));
vi.mock('@/services/sync/syncOdevzdavarny', () => ({ syncOdevzdavarny: vi.fn(async () => null) }));
vi.mock('@/services/sync/mergePastSubjects', () => ({ mergePastSubjects: vi.fn() }));
vi.mock('@/services/sync/examDurations', () => ({
  enrichExamsWithDurations: vi.fn(async (exams: unknown) => exams),
}));

vi.mock('@/api/termDetail', () => ({
  fetchTermDetail: vi.fn(async (id: string) => ({
    note: id === 'T2' ? { text: 'S sebou kalkulačku.', isEmphasized: true } : null,
    durationMinutes: null,
  })),
}));

import { collectRealData } from '../collectRealData';

describe('collectRealData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assembles schedule/exams/subjects into SyncedData', async () => {
    const data = await collectRealData();
    expect(data.schedule).toEqual([{ id: 'lesson1' }]);
    expect(data.exams).toEqual([{ code: 'X' }]);
    expect(data.subjects).toEqual({ data: {} });
    expect(typeof data.lastSync).toBe('number');
  });

  // The dev webapp has no IS session to read a note with, so the scrape
  // brings every term's Poznámka along — null where IS has none.
  it("records every term's Poznámka, registered term included", async () => {
    const { fetchDualLanguageExams } = await import('@/api/exams');
    (fetchDualLanguageExams as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        code: 'X',
        sections: [{ registeredTerm: { id: 'T1' }, terms: [{ id: 'T1' }, { id: 'T2' }] }],
      },
    ]);
    const data = await collectRealData();
    expect(data.examNotes).toEqual({
      T1: null,
      T2: { text: 'S sebou kalkulačku.', isEmphasized: true },
    });
  });

  it('tolerates a failing endpoint (exams rejects) and still returns data', async () => {
    const { fetchDualLanguageExams } = await import('@/api/exams');
    (fetchDualLanguageExams as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const data = await collectRealData();
    expect(data.schedule).toEqual([{ id: 'lesson1' }]);
    expect(data.exams).toBeUndefined();
  });
});
