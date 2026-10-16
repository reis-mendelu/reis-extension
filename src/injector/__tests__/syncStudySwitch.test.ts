import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The study switcher, as the content script sees it: the same module state
 * (`cachedData`, the TTL stamps) carried from a crawl of one study into the
 * next crawl of the other. Harness copied from syncEarlyPush.test.ts.
 */

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

const userParams: { studium: string; obdobi: string } = { studium: 'st1', obdobi: 'ob1' };
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => userParams,
  adoptStoredStudy: async () => {},
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

/** Fresh module registry per test — cachedData and the TTL stamps are module state. */
async function loadSync() {
  vi.resetModules();
  return import('../syncService');
}

/** Lets the microtask queue and a macrotask turn drain, repeatedly. */
async function flush(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

type SyncUpdate = { type: string; data: Record<string, unknown> };

async function updates(): Promise<SyncUpdate[]> {
  const { sendToIframe } = await import('../iframeManager');
  return vi
    .mocked(sendToIframe)
    .mock.calls.map((c) => c[0] as unknown as SyncUpdate)
    .filter((m) => m.type === 'REIS_SYNC_UPDATE');
}

describe('a crawl after a study switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeResponses();
    userParams.studium = 'st1';
  });

  // The concurrent-study student moves to a study with no exam terms and no
  // practice tests: the previous study's must not be shown as this one's.
  it("never hands the UI the previous study's exams, tests or subjects", async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();
    await flush();

    userParams.studium = 'st2';
    api.exams.mockResolvedValue([]);
    api.cvicneTests.mockResolvedValue({ tests: [] });
    api.subjects.mockRejectedValue(new Error('IS hiccup'));
    const { sendToIframe } = await import('../iframeManager');
    vi.mocked(sendToIframe).mockClear();
    await syncAllData();
    await flush();

    const posted = await updates();
    const withExams = posted.filter((m) => 'exams' in m.data && m.data.exams !== undefined);
    expect(withExams.length).toBeGreaterThan(0);
    for (const m of withExams) expect(m.data.exams).toEqual([]);
    for (const m of posted) {
      expect(m.data.cvicneTests ?? []).toEqual([]);
      expect(m.data.subjects).toBeUndefined();
    }
  });

  // The stamps belong to the previous study: a fresh one must not skip the
  // new study's fetches.
  it("refetches everything for the new study, though the old one's is fresh", async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();
    await flush();
    const before = api.studyPlan.mock.calls.length;

    await syncAllData();
    await flush();
    expect(api.studyPlan.mock.calls.length, 'same study: served fresh').toBe(before);

    userParams.studium = 'st2';
    await syncAllData();
    await flush();
    expect(api.studyPlan.mock.calls.length).toBe(before + 1);
  });

  // An exam refresh started on the old study and answered after the switch
  // must not put the old study's terms into the new study's cache.
  it("keeps a late exam refresh of the old study out of the new study's cache", async () => {
    const { syncAllData, refreshExams } = await loadSync();
    await syncAllData();
    await flush();

    let answer!: (v: unknown) => void;
    api.exams.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    const refresh = refreshExams();
    await flush();
    userParams.studium = 'st2';
    api.exams.mockResolvedValue([]);
    await syncAllData();
    await flush();
    answer([{ code: 'OLD', sections: [] }]);
    await refresh;

    const { sendToIframe } = await import('../iframeManager');
    vi.mocked(sendToIframe).mockClear();
    await syncAllData();
    await flush();
    for (const m of await updates())
      if (m.data.studium === 'st2') expect(JSON.stringify(m.data.exams ?? [])).not.toContain('OLD');
  });
});
