import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A page reIS does not understand must never be stored as "the student has
 * nothing". The real subjects and study-plan fetchers run here against a
 * mocked transport, so the whole chain is exercised: unrecognised page → the
 * fetcher's failed-read value → the sync keeps its cached copy, sends no
 * arrival flag and stamps nothing fresh. Harness from syncScheduleEmpty.test.ts.
 */

const api = {
  fetch: vi.fn(),
  exams: vi.fn(),
  schedule: vi.fn(),
  pastSubjects: vi.fn(),
  odevzdavarny: vi.fn(),
};

vi.mock('../../api/client', async (orig) => ({
  ...(await orig<typeof import('../../api/client')>()),
  fetchWithAuth: (url: string) => api.fetch(url),
}));
vi.mock('../../api/exams', () => ({ fetchDualLanguageExams: () => api.exams() }));
vi.mock('../dataFetchers', () => ({ fetchFullSemesterSchedule: () => api.schedule() }));
vi.mock('../../api/pastSubjects', () => ({
  fetchDualLanguagePastSubjects: () => api.pastSubjects(),
}));
vi.mock('../../api/studyStats', () => ({ fetchStudyStats: async () => null }));
vi.mock('../../api/studyComparison', () => ({ fetchStudyComparison: async () => null }));
vi.mock('../../services/sync/syncCvicneTests', () => ({ syncCvicneTests: async () => null }));
vi.mock('../../services/sync/syncOdevzdavarny', () => ({
  syncOdevzdavarny: () => api.odevzdavarny(),
}));
vi.mock('../../api/documents', () => ({ fetchFilesFromFolder: async () => [] }));
vi.mock('../../api/syllabus', async (orig) => ({
  ...(await orig<typeof import('../../api/syllabus')>()),
  fetchSyllabus: async () => ({ requirements: [] }),
}));
vi.mock('../../services/sync/syncZaznamnik', () => ({ syncZaznamnik: async () => ({}) }));
vi.mock('../../api/classmates', () => ({
  fetchSeminarGroupIds: async () => ({}),
  fetchClassmates: async () => ({ students: [] }),
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
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../../api/__tests__/fixtures', name), 'utf8');

// Made-up list.pl rows in the real row's shape (see subjectsNotUnderstood.test.ts).
const subjectRow = (folder: string) =>
  `<tr class=" uis-hl-table"><td><a href="/auth/katalog/syllabus.pl?predmet=101;lang=cz">XX1 Smyšlený předmět</a></td><td><a href="${folder}">D</a></td></tr>`;
const listPage = (folder: string) =>
  `<html><body><a href="/system/logout.pl">x</a><table id="tmtab_1">${subjectRow(folder)}</table></body></html>`;

const PLAN_CZ = fixture('study-plan-by-periods.two-plans.cz.html');
const PLAN_EN = fixture('study-plan-by-periods.two-plans.en.html');
const PAGES = {
  good: { list: listPage('../dok_server/slozka.pl?id=1'), cz: PLAN_CZ, en: PLAN_EN },
  // The folder link and the semester headings both changed shape.
  unrecognised: {
    list: listPage('../dokumenty/slozka.pl?id=1'),
    cz: PLAN_CZ.replace(/(\d+)\. semestr/g, '$1. období').replace(
      /Skupiny předmětů pro celý plán|Volitelné předměty za celé období daného studia/g,
      'Celý plán'
    ),
    en: PLAN_EN,
  },
};

function serve(set: keyof typeof PAGES) {
  const p = PAGES[set];
  api.fetch.mockImplementation(async (url: string) => {
    const body = url.includes('list.pl') ? p.list : url.includes('lang=en') ? p.en : p.cz;
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
  });
}

const listFetches = () =>
  api.fetch.mock.calls.filter(([u]) => String(u).includes('list.pl')).length;

type SyncUpdate = { type: string; data: Record<string, unknown> };
async function updates(): Promise<SyncUpdate[]> {
  const { sendToIframe } = await import('../iframeManager');
  return vi
    .mocked(sendToIframe)
    .mock.calls.map((c) => c[0] as unknown as SyncUpdate)
    .filter((m) => m.type === 'REIS_SYNC_UPDATE');
}

describe('an unrecognised IS page never replaces cached subjects or study plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.exams.mockResolvedValue([]);
    api.schedule.mockResolvedValue([{ id: 'l1' }]);
    api.pastSubjects.mockResolvedValue(null);
    api.odevzdavarny.mockResolvedValue(null);
  });

  it('keeps the cached copy, sends no arrival and stamps nothing fresh', async () => {
    vi.resetModules();
    const { syncAllData } = await import('../syncService');
    const { resetSyncTtl } = await import('../syncTtl');
    const { sendToIframe } = await import('../iframeManager');

    serve('good');
    await syncAllData();
    const first = (await updates()).at(-1)!.data;
    expect(Object.keys((first.subjects as { data: object }).data)).toEqual(['XX1']);
    expect((first.studyPlan as { cz: { blocks: unknown[] } }).cz.blocks.length).toBeGreaterThan(0);

    serve('unrecognised');
    resetSyncTtl();
    vi.mocked(sendToIframe).mockClear();
    await syncAllData();

    const posted = await updates();
    const last = posted.at(-1)!.data;
    expect(last.isSyncing).toBe(false);
    expect(last.subjects).toEqual(first.subjects);
    expect(last.studyPlan).toEqual(first.studyPlan);
    expect(posted.flatMap((m) => (m.data.loaded as string[]) ?? [])).not.toContain('subjects');

    // Not stamped fresh: the very next run asks IS again instead of trusting it.
    const before = listFetches();
    await syncAllData();
    expect(listFetches()).toBeGreaterThan(before);
  });
});
