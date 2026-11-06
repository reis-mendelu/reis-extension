import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Two reports (suggestions 41 and 42, iOS, English) said "Subjects: list is
 * empty" and "Exams: list is empty", and their attached log said nothing:
 * no entries, because an empty answer from IS is not an error and nothing
 * recorded it. When a list comes back empty, the log has to say what IS's
 * page looked like and what the sync asked it with — shapes and counts only,
 * never a name, an id or a page's text.
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
const params = { value: { studium: 'st1', obdobi: 'ob1' } as Record<string, string> | null };
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => params.value,
}));
vi.mock('../iframeManager', () => ({ sendToIframe: vi.fn() }));
vi.mock('../../services/sync/mergePastSubjects', () => ({ mergePastSubjects: vi.fn() }));
vi.mock('../../services/sync/syncPastSemesters', () => ({
  syncPastSemesters: vi.fn(async () => {}),
}));
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) },
}));

const SHAPE_EMPTY = {
  tables: 1,
  table: true,
  rows: 4,
  syllabusLinks: 4,
  folderLinks: 0,
  signedIn: true,
};

function primeResponses() {
  api.subjects.mockResolvedValue({
    subjects: { version: 1, lastUpdated: 'now', data: {} },
    attendance: {},
    availablePeriods: [],
    shape: SHAPE_EMPTY,
  });
  api.exams.mockResolvedValue([]);
  api.schedule.mockResolvedValue([{ id: 'l1' }]);
  api.studyPlan.mockResolvedValue({ cz: { groups: [] }, en: { groups: [] } });
  api.pastSubjects.mockResolvedValue({ cz: {}, en: {} });
  api.studyStats.mockResolvedValue({ credits: 30 });
  api.studyComparison.mockResolvedValue({ rank: 1 });
  api.cvicneTests.mockResolvedValue({ tests: [] });
  api.odevzdavarny.mockResolvedValue({ assignments: [] });
  api.files.mockResolvedValue([]);
  api.syllabus.mockResolvedValue({ requirementsText: 'x', requirementsTable: [] });
  api.zaznamnik.mockResolvedValue({});
  api.groupIds.mockResolvedValue({});
  api.classmates.mockResolvedValue({ students: [] });
}

/** Fresh registry: cachedData, TTL stamps and the diagnostic log are module state. */
async function loadSync() {
  vi.resetModules();
  const sync = await import('../syncService');
  const log = await import('../../utils/diagnostics/diagnosticLog');
  return { ...sync, log };
}

async function loadedDomains(): Promise<string[]> {
  const { sendToIframe } = await import('../iframeManager');
  return vi
    .mocked(sendToIframe)
    .mock.calls.map((c) => c[0] as unknown as { type: string; data: { loaded?: string[] } })
    .filter((m) => m.type === 'REIS_SYNC_UPDATE')
    .flatMap((m) => m.data.loaded ?? []);
}

describe('an empty answer leaves a trace in the diagnostic log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params.value = { studium: 'st1', obdobi: 'ob1' };
    primeResponses();
  });

  it('records an empty subject list with the page shape and what it was asked with', async () => {
    const { syncAllData, log } = await loadSync();
    await syncAllData();

    const lines = log.getDiagnostics().filter((e) => e.ctx === 'Sync.subjects');
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line!.level).toBe('warn');
    expect(line!.msg).toContain('0 subjects from 4 rows');
    expect(line!.msg).toContain('folder links 0');
    expect(line!.msg).toContain('study id present');
    expect(line!.msg).toContain('period present');
    // Never the values themselves.
    expect(line!.msg).not.toMatch(/st1|ob1/);
  });

  it('says the subjects domain answered, so the report can tell it from "never asked"', async () => {
    const { syncAllData } = await loadSync();
    await syncAllData();
    expect(await loadedDomains()).toContain('subjects');
  });

  it('neither traces nor marks subjects when the fetch failed (null)', async () => {
    api.subjects.mockResolvedValue(null);
    const { syncAllData, log } = await loadSync();
    await syncAllData();
    expect(log.getDiagnostics().filter((e) => e.ctx === 'Sync.subjects')).toHaveLength(0);
    expect(await loadedDomains()).not.toContain('subjects');
  });

  it('traces a list that lost rows on the way, not only an empty one', async () => {
    api.subjects.mockResolvedValue({
      subjects: { version: 1, lastUpdated: 'now', data: { XX1: { subjectCode: 'XX1' } } },
      attendance: {},
      availablePeriods: [],
      shape: { ...SHAPE_EMPTY, rows: 2, syllabusLinks: 2, folderLinks: 1 },
    });
    const { syncAllData, log } = await loadSync();
    await syncAllData();
    const line = log.getDiagnostics().find((e) => e.ctx === 'Sync.subjects');
    expect(line?.msg).toContain('1 subjects from 2 rows');
    expect(line?.msg).not.toContain('XX1');
  });

  it('records an empty exam list once per session, not on every run', async () => {
    const { syncAllData, log } = await loadSync();
    const { resetSyncTtl } = await import('../syncTtl');
    await syncAllData();
    resetSyncTtl();
    await syncAllData();

    const lines = log.getDiagnostics().filter((e) => e.ctx === 'Sync.exams');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.msg).toContain('IS answered, 0 exams');
    expect(lines[0]!.msg).toContain('study id present');
  });

  it('says when IS gave no study id, which every list is then asked without', async () => {
    params.value = null;
    const { syncAllData, log } = await loadSync();
    await syncAllData();

    const line = log.getDiagnostics().find((e) => e.ctx === 'Sync.userParams');
    expect(line?.level).toBe('warn');
    expect(line?.msg).toContain('study id absent');
    expect(log.getDiagnostics().find((e) => e.ctx === 'Sync.subjects')?.msg).toContain(
      'study id absent'
    );
  });

  it('counts syllabus fetches that failed', async () => {
    api.subjects.mockResolvedValue({
      subjects: {
        version: 1,
        lastUpdated: 'now',
        data: { XX1: { subjectId: '1' }, XX2: { subjectId: '2' } },
      },
      attendance: {},
      availablePeriods: [],
    });
    const { SYLLABUS_FETCH_FAILED } = await import('../../api/syllabus');
    api.syllabus
      .mockResolvedValueOnce({ requirementsText: SYLLABUS_FETCH_FAILED, requirementsTable: [] })
      .mockRejectedValueOnce(new Error('boom'));
    const { syncAllData, log } = await loadSync();
    await syncAllData();

    const line = log.getDiagnostics().find((e) => e.ctx === 'Sync.syllabus');
    expect(line?.msg).toBe('2 of 2 failed');
  });

  it('says when zápisník was skipped for want of a study id', async () => {
    params.value = null;
    api.subjects.mockResolvedValue({
      subjects: { version: 1, lastUpdated: 'now', data: { XX1: { subjectId: '1' } } },
      attendance: {},
      availablePeriods: [],
    });
    api.schedule.mockResolvedValue([{ id: 'l1' }]);
    const { syncAllData, log } = await loadSync();
    await syncAllData();

    const line = log.getDiagnostics().find((e) => e.ctx === 'Sync.zaznamnik');
    expect(line?.msg).toContain('skipped');
    expect(api.zaznamnik).not.toHaveBeenCalled();
  });

  it('records nothing for a healthy run', async () => {
    api.subjects.mockResolvedValue({
      subjects: { version: 1, lastUpdated: 'now', data: { XX1: { subjectId: '1' } } },
      attendance: {},
      availablePeriods: [],
      // A real healthy list.pl: more rows than subjects (group rows), and
      // every row with a syllabus link also has a folder link.
      shape: { ...SHAPE_EMPTY, rows: 3, syllabusLinks: 1, folderLinks: 1 },
    });
    api.exams.mockResolvedValue([{ code: 'XX1', sections: [] }]);
    const { syncAllData, log } = await loadSync();
    await syncAllData();
    expect(log.getDiagnostics()).toEqual([]);
  });
});
