import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearDiagnostics, recordDiagnostic, type DiagnosticEntry } from '../diagnosticLog';
import { collectDiagnostics } from '../collectDiagnostics';

const platform = { kind: 'extension' as 'extension' | 'capacitor' | 'web' };
const syncState = {
  firstSyncSettled: true,
  syncLoaded: { schedule: true } as Record<string, boolean>,
  error: null as string | null,
  subjects: { data: {} } as { data: Record<string, unknown> } | null,
  subjectsLoading: false,
  extraZaznamnik: {} as Record<string, unknown>,
  studyPlanDual: null as unknown,
  studyPlanLoaded: true,
};
vi.mock('@/platform', () => ({ getPlatform: () => platform }));
vi.mock('@/api/proxyClient', () => ({ executeAction: vi.fn() }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      language: 'en',
      isSyncing: false,
      firstSyncSettled: syncState.firstSyncSettled,
      syncLoaded: syncState.syncLoaded,
      syncStatus: { lastSync: 1_700_000_000_000, isSyncing: false, error: syncState.error },
      schedule: { data: [1, 2, 3], status: 'success' },
      exams: { data: [], status: 'error', error: 'x' },
      lastExamsFetchedAt: null,
      subjects: syncState.subjects,
      subjectsLoading: syncState.subjectsLoading,
      syllabuses: {
        cache: {
          XX1: { requirementsText: 'text', requirementsTable: [] },
          XX2: { requirementsText: '', requirementsTable: [] },
        },
      },
      zaznamnik: {
        XX1: { ph: { sections: [1] }, vt: { tests: [] } },
        XX2: { ph: { sections: [] }, vt: { tests: [] } },
        XX3: null,
        ...syncState.extraZaznamnik,
      },
      studyPlanDual: syncState.studyPlanDual,
      studyPlanLoaded: syncState.studyPlanLoaded,
    }),
  },
}));

const contentEntry: DiagnosticEntry = {
  t: 5,
  level: 'error',
  source: 'content',
  ctx: 'Api.fetchExams',
  msg: 'from content',
};

describe('collectDiagnostics', () => {
  beforeEach(() => {
    clearDiagnostics();
    platform.kind = 'extension';
    syncState.firstSyncSettled = true;
    syncState.syncLoaded = { schedule: true };
    syncState.error = null;
    syncState.subjects = { data: {} };
    syncState.subjectsLoading = false;
    syncState.extraZaznamnik = {};
    syncState.studyPlanDual = null;
    syncState.studyPlanLoaded = true;
  });

  it('merges app and content-script entries in time order', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValueOnce(9);
    recordDiagnostic({ level: 'warn', ctx: null, msg: 'app early' });
    recordDiagnostic({ level: 'warn', ctx: null, msg: 'app late' });
    const out = await collectDiagnostics({ fetchContent: async () => [contentEntry] });
    expect(out.entries.map((e) => e.msg)).toEqual(['app early', 'from content', 'app late']);
  });

  it('keeps the newest 50 overall', async () => {
    for (let i = 0; i < 40; i++) recordDiagnostic({ level: 'warn', ctx: null, msg: `a${i}` });
    const content = Array.from({ length: 40 }, (_, i) => ({ ...contentEntry, t: i }));
    const out = await collectDiagnostics({ fetchContent: async () => content });
    expect(out.entries).toHaveLength(50);
  });

  it('falls back to app entries when the content script does not answer', async () => {
    recordDiagnostic({ level: 'warn', ctx: null, msg: 'app' });
    const out = await collectDiagnostics({
      fetchContent: () => new Promise(() => {}),
      timeoutMs: 10,
    });
    expect(out.entries.map((e) => e.msg)).toEqual(['app']);
  });

  it('does not ask for content-script entries off the extension', async () => {
    platform.kind = 'capacitor';
    const fetchContent = vi.fn(async () => [contentEntry]);
    await collectDiagnostics({ fetchContent });
    expect(fetchContent).not.toHaveBeenCalled();
  });

  it('reports sync flags and counts, never content', async () => {
    const out = await collectDiagnostics({ fetchContent: async () => [] });
    expect(out.sync).toEqual({
      lastSync: 1_700_000_000_000,
      isSyncing: false,
      schedule: 'success',
      exams: 'error',
      scheduleCount: 3,
      examsCount: 0,
      examsFetchedAt: null,
      firstSyncSettled: true,
      syncLoaded: ['schedule'],
      syncFailed: false,
      subjects: 'success',
      subjectsCount: 0,
      syllabusCount: 2,
      syllabusEmpty: 1,
      zaznamnikCount: 3,
      zaznamnikFailed: 1,
      zaznamnikEmpty: 1,
      studyPlan: 'none',
      planBlocks: 0,
      planSubjects: 0,
      planEnrolledNow: 0,
    });
    expect(out.env.lang).toBe('en');
    expect(out.env.platform).toBe('extension');
    expect(typeof out.env.online).toBe('boolean');
    expect(JSON.stringify(out)).not.toMatch(/installId|https?:/);
    // Counts only: never which subject.
    expect(JSON.stringify(out)).not.toMatch(/XX\d/);
  });

  it('survives a zápisník record of an older shape', async () => {
    syncState.extraZaznamnik = { XX4: {} };
    const out = await collectDiagnostics({ fetchContent: async () => [] });
    expect(out.sync.zaznamnikCount).toBe(4);
    expect(out.sync.zaznamnikEmpty).toBe(2);
  });

  it('tells "no subjects yet" from "loading" from "answered, none"', async () => {
    syncState.subjects = null;
    expect((await collectDiagnostics({ fetchContent: async () => [] })).sync.subjects).toBe('none');
    syncState.subjectsLoading = true;
    expect((await collectDiagnostics({ fetchContent: async () => [] })).sync.subjects).toBe(
      'loading'
    );
    syncState.subjectsLoading = false;
    syncState.subjects = { data: { XX1: {}, XX2: {} } };
    const out = await collectDiagnostics({ fetchContent: async () => [] });
    expect(out.sync.subjects).toBe('success');
    expect(out.sync.subjectsCount).toBe(2);
  });
  // Suggestion 46: Předměty draws from the study plan, and the report said
  // nothing about it. These are the numbers the screen decides on.
  it('counts the study plan in the app language: blocks, subjects, enrolled now', async () => {
    const subj = (code: string, enrolled: boolean) => ({
      code,
      name: 'Secret name',
      credits: 5,
      status: 'X',
      isEnrolled: enrolled,
      isFulfilled: false,
    });
    const block = (title: string, subjects: unknown[]) => ({
      title,
      groups: [{ name: 'g', statusLabel: '', subjects }],
    });
    const plan = (blocks: unknown[]) => ({ title: 'Plan', blocks });
    syncState.studyPlanDual = {
      cz: plan([block('a', [])]),
      en: plan([
        block('a', [subj('XX1', false)]),
        block('b', [subj('XX2', true), subj('XX3', false)]),
      ]),
    };
    const out = await collectDiagnostics({ fetchContent: async () => [] });
    expect(out.sync.studyPlan).toBe('success');
    expect(out.sync.planBlocks).toBe(2);
    expect(out.sync.planSubjects).toBe(3);
    expect(typeof out.sync.planEnrolledNow).toBe('number');
    expect(JSON.stringify(out)).not.toMatch(/XX\d|Secret/);
  });

  it('tells a plan still loading from IndexedDB from no plan at all', async () => {
    syncState.studyPlanLoaded = false;
    expect((await collectDiagnostics({ fetchContent: async () => [] })).sync.studyPlan).toBe(
      'loading'
    );
  });

  it('keeps the report when the plan has an unexpected shape', async () => {
    syncState.studyPlanDual = { en: { blocks: 'nope' } };
    const out = await collectDiagnostics({ fetchContent: async () => [] });
    expect(out.sync.planBlocks).toBeUndefined();
    expect(out.sync.subjects).toBe('success');
  });
});

/**
 * Návrhy #26 arrived saying `exams: "success", examsCount: 0` — which read as
 * "IS answered: no exams". `exams` is the store's cache read, not a fetch. What
 * a reader needs is which domains a sync actually got an answer for, whether
 * any run has finished, and whether the last one threw.
 */
describe('collectDiagnostics — what the sync actually got', () => {
  beforeEach(() => {
    syncState.firstSyncSettled = true;
    syncState.syncLoaded = {};
    syncState.error = null;
  });

  it('names no domain as answered when the sync reached nothing', async () => {
    const out = await collectDiagnostics({ fetchContent: async () => [] });
    expect(out.sync.syncLoaded).toEqual([]);
    expect(out.sync.firstSyncSettled).toBe(true);
  });

  it('says the run failed as a flag, never with the error text', async () => {
    // syncStatus.error is String(e), uncleaned — it can hold a URL.
    syncState.error = 'TypeError: fetch https://is.mendelu.cz/auth/student/list.pl?studium=1';
    const out = await collectDiagnostics({ fetchContent: async () => [] });
    expect(out.sync.syncFailed).toBe(true);
    expect(JSON.stringify(out)).not.toContain('studium');
  });
});
