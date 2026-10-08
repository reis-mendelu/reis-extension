import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearDiagnostics, recordDiagnostic, type DiagnosticEntry } from '../diagnosticLog';
import { collectDiagnostics, osOf } from '../collectDiagnostics';

const platform = { kind: 'extension' as 'extension' | 'capacitor' | 'web' };
const syncState = {
  firstSyncSettled: true,
  syncLoaded: { schedule: true } as Record<string, boolean>,
  error: null as string | null,
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
    });
    expect(out.env.lang).toBe('en');
    expect(out.env.platform).toBe('extension');
    expect(typeof out.env.online).toBe('boolean');
    expect(JSON.stringify(out)).not.toMatch(/installId|https?:/);
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

describe('osOf', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', 'iOS 26'],
    ['Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X)', 'iOS 18'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) wv', 'Android 14'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux'],
    ['', 'unknown'],
  ])('%s → %s', (ua, os) => {
    expect(osOf(ua)).toBe(os);
  });
});
