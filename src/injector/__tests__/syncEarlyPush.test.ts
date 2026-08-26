import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * When Phase 2 results reach the UI.
 *
 * Phase 2 fetches nine things in parallel and used to hand them to the UI in
 * one message once the SLOWEST had landed — so a student stared at a skeleton
 * while their schedule sat finished in memory, waiting on a study comparison
 * nobody had asked to see. These tests pin each screen's data to its own
 * arrival, not to the phase's.
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

const userParams: { studium?: string; obdobi?: string } | null = { studium: 'st1', obdobi: 'ob1' };
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => userParams,
}));
vi.mock('../iframeManager', () => ({ sendToIframe: vi.fn() }));
const mergePastSubjectsMock = vi.fn();
vi.mock('../../services/sync/mergePastSubjects', () => ({
  mergePastSubjects: (...a: unknown[]) => mergePastSubjectsMock(...a),
}));
vi.mock('../../services/sync/syncPastSemesters', () => ({
  syncPastSemesters: vi.fn(async () => {}),
}));
vi.mock('../../services/drive/driveBackup', () => ({ syncDriveBackup: vi.fn(async () => {}) }));
vi.mock('../../services/drive/driveNotesBackup', () => ({
  syncDriveNotesBackup: vi.fn(async () => {}),
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

describe('Phase 2 reaches the UI as it arrives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeResponses();
  });

  it('pushes schedule, exams and the study plan while a slow sibling is still pending', async () => {
    // studyComparison feeds no screen the student is waiting on, and it is
    // exactly the kind of straggler that used to hold the whole phase.
    let release!: (v: unknown) => void;
    api.studyComparison.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const { syncAllData } = await loadSync();
    const run = syncAllData();
    await flush();

    const posted = await updates();
    // Still mid-phase: the batch that ends the sync has not been sent.
    expect(posted.every((m) => m.data.isSyncing !== false)).toBe(true);
    expect(posted.some((m) => m.data.schedule)).toBe(true);
    expect(posted.some((m) => m.data.exams)).toBe(true);
    expect(posted.some((m) => m.data.studyPlan)).toBe(true);

    release({ rank: 1 });
    await run;
  });

  it('reports a domain as loaded even when its answer is empty', async () => {
    // Every summer: no lessons, no exam terms. Without an arrival signal the
    // screens cannot tell "none" from "not yet" and wait out the whole crawl —
    // twenty seconds, measured on a device, to be told nothing twice.
    api.exams.mockResolvedValue([]);
    api.schedule.mockResolvedValue([]);
    let release!: (v: unknown) => void;
    api.studyComparison.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const { syncAllData } = await loadSync();
    const run = syncAllData();
    await flush();

    const loaded = (await updates()).flatMap((m) => (m.data.loaded as string[]) ?? []);
    expect(loaded).toContain('exams');
    expect(loaded).toContain('schedule');
    // The study plan is deliberately not in here — see SyncDomain.
    expect(loaded).not.toContain('studyPlan');

    release({ rank: 1 });
    await run;
  });

  it('does not push an empty exam list as data, only as arrival', async () => {
    // The completed batch keeps the cached list when a read comes back empty,
    // because a parse failure looks exactly like an empty season. An empty
    // data push here would undo that guard.
    api.exams.mockResolvedValue([]);

    const { syncAllData } = await loadSync();
    await syncAllData();

    const carriedEmptyExams = (await updates()).some(
      (m) => Array.isArray(m.data.exams) && (m.data.exams as unknown[]).length === 0
    );
    expect(carriedEmptyExams).toBe(false);
  });

  it('still sends the completed batch when everything has landed', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();

    const posted = await updates();
    const final = posted[posted.length - 1]!;
    expect(final.data.isSyncing).toBe(false);
    expect(final.data.schedule).toBeTruthy();
    expect(final.data.exams).toBeTruthy();
  });
});
