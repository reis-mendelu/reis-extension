import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * An empty schedule read must never travel as data.
 *
 * IS answers a zero-result schedule window with an HTML page carrying
 * `logout.pl`, so it survives the transport's auth check and arrives here as
 * `[]` (see `src/api/__tests__/scheduleEmptyWindow.test.ts`). `[]` is truthy,
 * so both the early push and the end-of-sync merge used to treat it as the
 * student's answer and overwrite a real timetable with nothing.
 *
 * The exams path next door already gets this right and says why in a comment.
 * These tests hold the schedule path to the same three shapes:
 *   non-empty → data + arrival
 *   []        → arrival only, cache untouched
 *   null      → nothing at all, so CalendarScreen can reach ScreenError
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

const carriedSchedules = (posted: SyncUpdate[]) =>
  posted.map((m) => m.data.schedule).filter((s) => s !== undefined);

describe('an empty or failed schedule read never overwrites the timetable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeResponses();
  });

  it('does not push an empty lesson list as data, only as arrival', async () => {
    api.schedule.mockResolvedValue([]);

    const { syncAllData } = await loadSync();
    await syncAllData();

    const posted = await updates();
    expect(carriedSchedules(posted)).toEqual([]);
    // The arrival signal still goes out, so CalendarScreen shows the empty
    // state rather than waiting out the crawl on a skeleton.
    expect(posted.flatMap((m) => (m.data.loaded as string[]) ?? [])).toContain('schedule');
  });

  it('keeps the cached timetable when a later run comes back empty', async () => {
    const { syncAllData } = await loadSync();
    const { resetSyncTtl } = await import('../syncTtl');

    await syncAllData();
    api.schedule.mockResolvedValue([]);
    resetSyncTtl();
    vi.mocked((await import('../iframeManager')).sendToIframe).mockClear();
    await syncAllData();

    const posted = await updates();
    // Every schedule the second run emitted is the real one it already held.
    expect(carriedSchedules(posted)).not.toHaveLength(0);
    for (const s of carriedSchedules(posted)) expect(s).toEqual(LESSONS);
    const final = posted[posted.length - 1]!;
    expect(final.data.isSyncing).toBe(false);
    expect(final.data.schedule).toEqual(LESSONS);
  });

  it('pushes nothing at all when the fetch fails, so the screen can offer a retry', async () => {
    // A null is the only way CalendarScreen reaches ScreenError — the one place
    // with a retry button. An arrival signal here would route the student to
    // "you have no lessons" with no way back.
    api.schedule.mockResolvedValue(null);

    const { syncAllData } = await loadSync();
    await syncAllData();

    const posted = await updates();
    expect(carriedSchedules(posted)).toEqual([]);
    expect(posted.flatMap((m) => (m.data.loaded as string[]) ?? [])).not.toContain('schedule');
  });

  it('still pushes a real timetable as data and as arrival', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();

    const posted = await updates();
    expect(carriedSchedules(posted).every((s) => s === LESSONS)).toBe(true);
    expect(posted.flatMap((m) => (m.data.loaded as string[]) ?? [])).toContain('schedule');
  });
});
