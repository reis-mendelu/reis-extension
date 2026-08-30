import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * What a second sync run actually costs.
 *
 * The whole point of the TTL tiers is that a run past the first fetches only
 * what could have changed, so this counts calls per API module across two
 * consecutive runs. It is a wiring regression guard, not evidence about IS:
 * the real request count still has to be measured on a device.
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

/** Fresh module registry per test — cachedData and the TTL stamps are module state. */
async function loadSync() {
  vi.resetModules();
  return import('../syncService');
}

const COLD = [
  'subjects',
  'schedule',
  'studyPlan',
  'pastSubjects',
  'studyStats',
  'studyComparison',
  'cvicneTests',
  'files',
  'syllabus',
  'groupIds',
  'classmates',
] as const;
const HOT = ['exams', 'odevzdavarny', 'zaznamnik'] as const;

describe('sync tiers across consecutive runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mergePastSubjectsMock.mockReset();
    primeResponses();
  });

  it('fetches everything on the first run', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();
    for (const name of [...COLD, ...HOT]) {
      expect(api[name], `${name} on a cold start`).toHaveBeenCalledTimes(1);
    }
  });

  it('refetches only the hot tier on the next run', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();
    await syncAllData();

    for (const name of COLD) {
      expect(api[name], `${name} must not be refetched while fresh`).toHaveBeenCalledTimes(1);
    }
    for (const name of HOT) {
      expect(api[name], `${name} is volatile and must be refetched`).toHaveBeenCalledTimes(2);
    }
  });

  // The escape hatch that makes the TTLs safe to be aggressive about.
  it('refetches everything after an explicit refresh clears the stamps', async () => {
    const { syncAllData } = await loadSync();
    const { resetSyncTtl } = await import('../syncTtl');

    await syncAllData();
    resetSyncTtl();
    await syncAllData();

    for (const name of [...COLD, ...HOT]) {
      expect(api[name], `${name} after an explicit refresh`).toHaveBeenCalledTimes(2);
    }
  });

  // A resource that failed is not fresh — one bad run must not blank it for a
  // whole TTL window. null and [] are what a failed parse or a lapsed session
  // return, which is why neither counts as a completed fetch.
  it('retries a cold resource whose first fetch failed', async () => {
    api.studyPlan.mockResolvedValue(null);
    api.schedule.mockResolvedValue([]);

    const { syncAllData } = await loadSync();
    await syncAllData();
    await syncAllData();

    expect(api.studyPlan, 'null is a failure, not an answer').toHaveBeenCalledTimes(2);
    expect(api.schedule, 'an empty list is a failure here too').toHaveBeenCalledTimes(2);
    expect(api.subjects, 'a healthy resource is still skipped').toHaveBeenCalledTimes(1);
  });

  // The other side of that rule: a successful "you have none" is an answer, and
  // refetching it every run would be exactly the waste this change removes.
  // syncCvicneTests returns null when the fetch fails and { tests: [] } when the
  // student genuinely has no practice tests.
  it('caches a genuinely empty result rather than retrying it', async () => {
    api.cvicneTests.mockResolvedValue({ tests: [] });

    const { syncAllData } = await loadSync();
    await syncAllData();
    await syncAllData();

    expect(api.cvicneTests).toHaveBeenCalledTimes(1);
  });

  // Regression: subjects (daily) comes due while pastSubjects (semester) is
  // still fresh. Without a retained copy of the past-subject payload that run
  // replaced the merged map with a current-semester-only one, and fulfilled
  // subjects vanished from the UI until the longer TTL expired.
  it('still merges past subjects when only the subject list came due', async () => {
    const { syncAllData } = await loadSync();
    const { markFetched, TTL } = await import('../syncTtl');

    await syncAllData();
    expect(mergePastSubjectsMock).toHaveBeenCalledTimes(1);

    // Age the subject list past its tier while pastSubjects stays fresh.
    markFetched('subjects', Date.now() - (TTL.DAILY + 1));
    await syncAllData();

    expect(api.subjects, 'subjects came due').toHaveBeenCalledTimes(2);
    expect(api.pastSubjects, 'past subjects stayed fresh').toHaveBeenCalledTimes(1);
    expect(
      mergePastSubjectsMock,
      'the merge still ran, on the retained copy'
    ).toHaveBeenCalledTimes(2);
    expect(mergePastSubjectsMock.mock.calls[1]![1]).toEqual({ cz: {}, en: {} });
  });

  // fetchSyllabus degrades to an error sentinel rather than throwing, and an
  // object always looks "useful" — so a transient failure could be stamped
  // fresh and pin the error for a whole semester.
  it('retries a syllabus whose fetch returned the failure sentinel', async () => {
    const { SYLLABUS_FETCH_FAILED } = await import('../../api/syllabus');
    api.syllabus.mockResolvedValue({
      requirementsText: SYLLABUS_FETCH_FAILED,
      requirementsTable: [],
    });

    const { syncAllData } = await loadSync();
    await syncAllData();
    await syncAllData();

    expect(api.syllabus).toHaveBeenCalledTimes(2);
  });

  // Phase 3 keys off the enrolled subjects, which it now reads from the cache
  // when the subjects fetch itself was skipped.
  it('still runs the per-subject phase when the subject list was skipped as fresh', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();
    await syncAllData();
    expect(api.zaznamnik).toHaveBeenCalledTimes(2);
  });
});

/**
 * The other half of "fetch only what is due": WHICH subjects.
 *
 * `subjects.data` has been through mergePastSubjects by the time Phase 3 reads
 * it, so it holds every subject the student ever enrolled in. Each one costs a
 * recursive, paginated file crawl plus a syllabus — for folders that stopped
 * changing years ago.
 */
describe('Phase 3 stays inside the current semester', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mergePastSubjectsMock.mockReset();
    primeResponses();
    // What the real merge does: past subjects appear in the same map, and only
    // in it — currentSemesterCodes was captured before this ran.
    mergePastSubjectsMock.mockImplementation((subjects: { data: Record<string, unknown> }) => {
      subjects.data['OLD-101'] = { subjectId: 'p-old', folderUrl: 'https://is.mendelu.cz/old' };
    });
  });

  it('crawls files and syllabus for the enrolled subject only', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();

    expect(api.files).toHaveBeenCalledTimes(1);
    expect(api.files.mock.calls[0]![0]).toBe('https://is.mendelu.cz/f');
    expect(api.syllabus).toHaveBeenCalledTimes(1);
    expect(api.syllabus.mock.calls[0]![0]).toBe('p1');
  });

  it('keeps the past subject out of the zaznamnik batch too', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();

    const batch = api.zaznamnik.mock.calls[0]![2] as { courseCode: string }[];
    expect(batch.map((i) => i.courseCode)).toEqual(['MT101']);
  });

  it('falls back to the whole map when the subject fetch never told us the semester', async () => {
    // Crawling everything is wasteful; crawling nothing would leave a student
    // with no files at all, so an unknown semester keeps the old behaviour.
    api.subjects.mockRejectedValue(new Error('IS down'));
    mergePastSubjectsMock.mockReset();

    const { syncAllData } = await loadSync();
    await syncAllData();

    expect(api.files).not.toHaveBeenCalled(); // no subject list at all this run
  });
});
