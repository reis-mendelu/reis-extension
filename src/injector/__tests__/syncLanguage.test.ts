import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The sync fetches IS in the student's language, read once per run.
 *
 * Each fetcher takes the language as a required argument, and this pins that
 * `syncAllData` hands every one of them the stored value rather than a
 * default — a fetcher left on `'cz'` would silently serve an English student
 * Czech, and one left dual would put `lang=en` back on a Czech student's wire.
 * What each fetcher then sends is fetchLanguageRequests.test.ts.
 */

let storedLanguage: 'cz' | 'en' = 'cz';
vi.mock('../../services/sync/syncLanguage', () => ({
  readSyncLanguage: async () => storedLanguage,
}));

const api = {
  subjects: vi.fn(),
  exams: vi.fn(),
  schedule: vi.fn(),
  studyPlan: vi.fn(),
  pastSubjects: vi.fn(),
  studyStats: vi.fn(),
  studyComparison: vi.fn(),
  cvicneTests: vi.fn(),
  odevzdavarny: vi.fn(),
  files: vi.fn(),
  syllabus: vi.fn(),
  zaznamnik: vi.fn(),
  groupIds: vi.fn(),
  classmates: vi.fn(),
};

vi.mock('../../api/subjects', () => ({
  fetchDualLanguageSubjects: (...a: unknown[]) => api.subjects(...a),
}));
vi.mock('../../api/exams', () => ({
  fetchDualLanguageExams: (...a: unknown[]) => api.exams(...a),
}));
vi.mock('../dataFetchers', () => ({
  fetchFullSemesterSchedule: (...a: unknown[]) => api.schedule(...a),
}));
vi.mock('../../api/studyPlan', () => ({
  fetchDualLanguageStudyPlan: (...a: unknown[]) => api.studyPlan(...a),
}));
vi.mock('../../api/pastSubjects', () => ({
  fetchDualLanguagePastSubjects: (...a: unknown[]) => api.pastSubjects(...a),
}));
vi.mock('../../api/studyStats', () => ({
  fetchStudyStats: (...a: unknown[]) => api.studyStats(...a),
}));
vi.mock('../../api/studyComparison', () => ({
  fetchStudyComparison: (...a: unknown[]) => api.studyComparison(...a),
}));
vi.mock('../../services/sync/syncCvicneTests', () => ({
  syncCvicneTests: (...a: unknown[]) => api.cvicneTests(...a),
}));
vi.mock('../../services/sync/syncOdevzdavarny', () => ({
  syncOdevzdavarny: (...a: unknown[]) => api.odevzdavarny(...a),
}));
vi.mock('../../api/documents', () => ({
  fetchFilesFromFolder: (...a: unknown[]) => api.files(...a),
}));
// importOriginal so SYLLABUS_FETCH_FAILED is the real sentinel, not a copy that
// would silently stop matching if the source changed.
vi.mock('../../api/syllabus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/syllabus')>()),
  fetchSyllabus: (...a: unknown[]) => api.syllabus(...a),
}));
vi.mock('../../services/sync/syncZaznamnik', () => ({
  syncZaznamnik: (...a: unknown[]) => api.zaznamnik(...a),
}));
vi.mock('../../api/classmates', () => ({
  fetchSeminarGroupIds: (...a: unknown[]) => api.groupIds(...a),
  fetchClassmates: (...a: unknown[]) => api.classmates(...a),
}));

vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => ({ studium: 'st1', obdobi: 'ob1' }),
}));
vi.mock('../iframeManager', () => ({ sendToIframe: vi.fn() }));
const mergePastSubjectsMock = vi.fn();
vi.mock('../../services/sync/mergePastSubjects', () => ({
  mergePastSubjects: (...a: unknown[]) => mergePastSubjectsMock(...a),
}));
vi.mock('../../services/sync/syncPastSemesters', () => ({
  syncPastSemesters: vi.fn(async () => {}),
}));
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) },
}));

function primeResponses() {
  api.subjects.mockResolvedValue({
    subjects: {
      version: 1,
      lastUpdated: 'now',
      data: { MT101: { subjectId: 'p1', folderUrl: 'https://is.mendelu.cz/f', hasPrubezne: true } },
    },
    attendance: {},
    availablePeriods: [],
  });
  api.exams.mockResolvedValue([{ code: 'MT101', sections: [] }]);
  api.schedule.mockResolvedValue([{ id: 'l1' }]);
  api.studyPlan.mockResolvedValue({ cz: { groups: [] }, en: { groups: [] } });
  api.pastSubjects.mockResolvedValue({ cz: {}, en: {} });
  api.studyStats.mockResolvedValue({ credits: 30 });
  api.studyComparison.mockResolvedValue({ rank: 1 });
  api.cvicneTests.mockResolvedValue({ tests: [{ id: 't1' }] });
  api.odevzdavarny.mockResolvedValue({ assignments: [{ id: 'a1' }] });
  api.files.mockResolvedValue([{ file_name: 'lecture.pdf', files: [] }]);
  api.syllabus.mockResolvedValue({ requirements: [] });
  api.zaznamnik.mockResolvedValue({ MT101: { rows: [] } });
  api.groupIds.mockResolvedValue({ p1: 's1' });
  api.classmates.mockResolvedValue({ students: [] });
}

async function loadSync() {
  vi.resetModules();
  return import('../syncService');
}

/** The language argument each fetcher received, by its position in the call. */
function languagesPassed(): Record<string, unknown> {
  const last = (fn: { mock: { calls: unknown[][] } }, i: number) => fn.mock.calls.at(-1)?.[i];
  return {
    subjects: last(api.subjects, 2),
    exams: last(api.exams, 0),
    schedule: last(api.schedule, 0),
    studyPlan: last(api.studyPlan, 1),
    pastSubjects: last(api.pastSubjects, 0),
    cvicneTests: last(api.cvicneTests, 1),
    odevzdavarny: last(api.odevzdavarny, 2),
    files: last(api.files, 1),
    syllabus: last(api.syllabus, 1),
  };
}

describe('syncAllData fetches in the stored language', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mergePastSubjectsMock.mockReset();
    primeResponses();
  });

  for (const lang of ['cz', 'en'] as const) {
    it(`passes '${lang}' to every language-bearing fetch`, async () => {
      storedLanguage = lang;
      const { syncAllData } = await loadSync();
      await syncAllData();
      const passed = languagesPassed();
      for (const [name, value] of Object.entries(passed)) expect(value, name).toBe(lang);
    });
  }

  it('says which language the data is in', async () => {
    storedLanguage = 'en';
    const sync = await loadSync();
    await sync.syncAllData();
    expect(sync.cachedData.language).toBe('en');
  });

  // Folder URLs come off the Czech subjects page with `lang=cz` inside, and
  // fetchFilesFromFolder keeps a lang it finds — so passing 'en' alone fetched
  // Czech files and stamped them English. Measured against live IS 2026-09-24.
  it("fetches an English student's files in English, not the folder URL's Czech", async () => {
    storedLanguage = 'en';
    api.subjects.mockResolvedValue({
      subjects: {
        version: 1,
        lastUpdated: 'now',
        data: {
          MT101: {
            subjectId: 'p1',
            folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=2;lang=cz',
          },
        },
      },
      attendance: {},
      availablePeriods: [],
    });
    const { syncAllData } = await loadSync();
    await syncAllData();
    expect(api.files.mock.calls.at(-1)?.slice(0, 2)).toEqual([
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=2',
      'en',
    ]);
  });

  // The calendar's and the exam screen's own refreshes, which skip syncAllData.
  it('refreshes the timetable and exams in the stored language too', async () => {
    storedLanguage = 'en';
    const { refreshSchedule, refreshExams } = await loadSync();
    await refreshSchedule();
    await refreshExams();
    expect(api.schedule.mock.calls.at(-1)?.[0]).toBe('en');
    expect(api.exams.mock.calls.at(-1)?.[0]).toBe('en');
  });

  // A switch normally arrives as a 'user' sync, which clears the stamps. If
  // one runs without that (a tick after the switch), a fresh TTL must still
  // not serve the previous language's timetable.
  it('refetches TTL-gated data when the language changed since the last run', async () => {
    storedLanguage = 'cz';
    const { syncAllData } = await loadSync();
    await syncAllData();
    storedLanguage = 'en';
    await syncAllData();
    expect(api.schedule).toHaveBeenCalledTimes(2);
    expect(api.schedule.mock.calls[1]?.[0]).toBe('en');
    expect(api.studyPlan).toHaveBeenCalledTimes(2);
  });
});
