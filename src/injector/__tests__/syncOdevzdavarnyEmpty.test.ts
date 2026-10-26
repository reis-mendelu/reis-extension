import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * An empty submission-box answer is an answer.
 *
 * Unlike the schedule, odevzdavarny.pl is a real page whatever it contains, and
 * the parser returns null for anything it does not recognise. So `[]` here means
 * "IS lists no boxes for this period" and must replace the cached list — a box
 * the teacher deleted, or last period's list after the semester turns, used to
 * survive forever because every layer skipped empty results.
 *
 *   [...]  → data
 *   []     → data (the list is now empty)
 *   null   → nothing; the cache stays
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
vi.mock('../../services/sync/mergePastSubjects', () => ({ mergePastSubjects: vi.fn() }));
vi.mock('../../services/sync/syncPastSemesters', () => ({
  syncPastSemesters: vi.fn(async () => {}),
}));
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) },
}));

const LESSONS = [{ id: 'l1' }];

function primeResponses() {
  api.subjects.mockResolvedValue({
    subjects: { version: 1, lastUpdated: 'now', data: {} },
    attendance: {},
    availablePeriods: [],
  });
  api.exams.mockResolvedValue([{ code: 'MT101', sections: [] }]);
  api.schedule.mockResolvedValue(LESSONS);
  api.studyPlan.mockResolvedValue({ cz: { groups: [] }, en: { groups: [] } });
  api.pastSubjects.mockResolvedValue({ cz: {}, en: {} });
  api.studyStats.mockResolvedValue({ credits: 30 });
  api.studyComparison.mockResolvedValue({ rank: 1 });
  api.cvicneTests.mockResolvedValue({ tests: [] });
  api.odevzdavarny.mockResolvedValue({ assignments: [] });
  api.files.mockResolvedValue([]);
  api.syllabus.mockResolvedValue({ requirements: [] });
  api.zaznamnik.mockResolvedValue({});
  api.groupIds.mockResolvedValue({});
  api.classmates.mockResolvedValue({ students: [] });
}

/** Fresh module registry per test — cachedData and the TTL stamps are module state. */
async function loadSync() {
  vi.resetModules();
  return import('../syncService');
}

type SyncUpdate = { type: string; data: Record<string, unknown> };

async function updates(): Promise<SyncUpdate[]> {
  const { sendToIframe } = await import('../iframeManager');
  return vi
    .mocked(sendToIframe)
    .mock.calls.map((c) => c[0] as unknown as SyncUpdate)
    .filter((m) => m.type === 'REIS_SYNC_UPDATE');
}

const BOX = { courseId: '1', name: 'Projekt', odevzdavarnaId: '9' };

const lastBoxes = (posted: SyncUpdate[]) =>
  posted
    .map((m) => m.data.odevzdavarny)
    .filter((s) => s !== undefined)
    .at(-1);

describe('the submission-box list follows IS, including down to empty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeResponses();
  });

  it('replaces cached boxes when IS now lists none', async () => {
    const { syncAllData } = await loadSync();
    api.odevzdavarny.mockResolvedValue({ assignments: [BOX] });
    await syncAllData();
    expect(lastBoxes(await updates())).toEqual([BOX]);

    api.odevzdavarny.mockResolvedValue({ assignments: [] });
    await syncAllData();
    expect(lastBoxes(await updates())).toEqual([]);
  });

  it('keeps cached boxes when the read failed', async () => {
    const { syncAllData } = await loadSync();
    api.odevzdavarny.mockResolvedValue({ assignments: [BOX] });
    await syncAllData();

    api.odevzdavarny.mockResolvedValue(null);
    await syncAllData();
    expect(lastBoxes(await updates())).toEqual([BOX]);
  });
});
