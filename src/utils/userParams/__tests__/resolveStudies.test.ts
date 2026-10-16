import { describe, it, expect, vi, beforeEach } from 'vitest';
import { studyPage, INTERRUPTED, CONCURRENT, type FixtureStudy } from './studyPage.fixture';

const fetchWithAuth = vi.fn();
vi.mock('../../../api/client', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args),
  BASE_URL: 'https://is.mendelu.cz',
}));

const { resolveStudies } = await import('../resolveStudies');

/** IS answers `studium.pl?studium=X` with X's own page and status. */
function serve(studies: FixtureStudy[], status: Record<string, string>, extra?: string) {
  fetchWithAuth.mockImplementation((url: string) => {
    const id = /studium=(\d+)/.exec(url)?.[1] ?? '';
    // Not a study page (the test setup's own requests): an empty body.
    if (!studies.some((s) => s.studium === id)) return Promise.resolve({ text: () => '' });
    const html = studyPage({ studies, selected: id, status: status[id] ?? '', extra });
    return Promise.resolve({ text: () => Promise.resolve(html) });
  });
}

const options = (studies: FixtureStudy[]) =>
  studies.map((s) => ({ studium: s.studium, label: s.label }));

describe('resolveStudies', () => {
  beforeEach(() => fetchWithAuth.mockReset());

  // The interrupted-study report (Supabase suggestion 2026-10-07). The two
  // non-current statuses are SYNTHETIC — the real pages are still owed.
  it('offers only the active study, and corrects a cached interrupted one', async () => {
    serve(INTERRUPTED, {
      '900001': 'řádně zapsán',
      '900002': 'studium ukončeno',
      '900003': 'studium přerušeno',
    });
    const r = await resolveStudies(options(INTERRUPTED), '900003');
    expect(r.active.map((s) => s.studium)).toEqual(['900001']);
    expect(r.chosen).toMatchObject({ studium: '900001', obdobi: '829' });
    expect(r.chosen.label).toBe('PEF B-EM prez [sem 1, roč 1]');
  });

  it('asks IS for each study by id, in Czech', async () => {
    serve(CONCURRENT, { '900011': 'řádně zapsán', '900012': 'řádně zapsán' });
    await resolveStudies(options(CONCURRENT));
    const urls = fetchWithAuth.mock.calls
      .map((c) => c[0] as string)
      .filter((u) => u?.includes('studium='))
      .sort();
    expect(urls).toEqual([
      'https://is.mendelu.cz/auth/student/studium.pl?studium=900011;lang=cz',
      'https://is.mendelu.cz/auth/student/studium.pl?studium=900012;lang=cz',
    ]);
  });

  // The concurrent-study report (suggestion 2026-10-02).
  it('offers both concurrent studies and picks the first in IS order', async () => {
    serve(CONCURRENT, { '900011': 'řádně zapsán', '900012': 'řádně zapsán' });
    const r = await resolveStudies(options(CONCURRENT));
    expect(r.active.map((s) => s.studium)).toEqual(['900011', '900012']);
    expect(r.chosen.studium).toBe('900011');
  });

  it("keeps the student's own choice while it is still active", async () => {
    serve(CONCURRENT, { '900011': 'řádně zapsán', '900012': 'řádně zapsán' });
    const r = await resolveStudies(options(CONCURRENT), '900012');
    expect(r.chosen.studium).toBe('900012');
  });

  it('reads Erasmus per study, not from whichever page IS opened first', async () => {
    fetchWithAuth.mockImplementation((url: string) => {
      const id = /studium=(\d+)/.exec(url)?.[1] ?? '';
      if (!id) return Promise.resolve({ text: () => '' });
      const html = studyPage({
        studies: CONCURRENT,
        selected: id,
        status: 'řádně zapsán',
        extra: id === '900012' ? 'Erasmus+ program' : 'Ekonomika',
      });
      return Promise.resolve({ text: () => Promise.resolve(html) });
    });
    const r = await resolveStudies(options(CONCURRENT));
    expect(r.active.map((s) => s.isErasmus)).toEqual([false, true]);
  });

  /**
   * The safety net for the status rule being a guess. When no study reads as
   * active — an IS wording the rule does not know — reIS does what it did
   * before this change: the stored study if IS still lists it, else the one IS
   * lists first. One study, so no switcher.
   */
  it('falls back to the stored study when no status is recognised', async () => {
    serve(CONCURRENT, { '900011': 'neznámý stav', '900012': 'neznámý stav' });
    const r = await resolveStudies(options(CONCURRENT), '900012');
    expect(r.active.map((s) => s.studium)).toEqual(['900012']);
    expect(r.chosen.studium).toBe('900012');
  });

  it('falls back to the first study IS lists when the stored one is gone', async () => {
    serve(CONCURRENT, { '900011': '', '900012': '' });
    const r = await resolveStudies(options(CONCURRENT), '123456');
    expect(r.chosen.studium).toBe('900011');
    expect(r.active).toHaveLength(1);
  });

  it('rejects when a study page cannot be read, so the caller keeps what it has', async () => {
    fetchWithAuth.mockImplementation((url: string) =>
      url?.includes('studium=')
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ text: () => '' })
    );
    await expect(resolveStudies(options(CONCURRENT))).rejects.toThrow();
  });

  // IS refusing an old study's page must not block the correction for good.
  it('decides from the pages it could read when another one fails', async () => {
    serve(INTERRUPTED, { '900001': 'řádně zapsán', '900002': 'studium ukončeno' });
    const inner = fetchWithAuth.getMockImplementation()!;
    fetchWithAuth.mockImplementation((url: string) =>
      url?.includes('studium=900002') ? Promise.reject(new Error('HTTP 500')) : inner(url)
    );
    const r = await resolveStudies(options(INTERRUPTED), '900003');
    expect(r.chosen.studium).toBe('900001');
  });

  // IS answering an error for the interrupted study's own page must not
  // keep the student on it: another active study wins.
  it("moves to an active study when the kept study's own page fails", async () => {
    serve(INTERRUPTED, { '900001': 'řádně zapsán', '900002': 'studium ukončeno' });
    const inner = fetchWithAuth.getMockImplementation()!;
    fetchWithAuth.mockImplementation((url: string) =>
      url?.includes('studium=900003') ? Promise.reject(new Error('HTTP 500')) : inner(url)
    );
    const r = await resolveStudies(options(INTERRUPTED), '900003');
    expect(r.chosen.studium).toBe('900001');
  });

  it("rejects when the kept study's page fails and nothing else is active", async () => {
    serve(CONCURRENT, { '900011': 'neznámý stav' });
    const inner = fetchWithAuth.getMockImplementation()!;
    fetchWithAuth.mockImplementation((url: string) =>
      url?.includes('studium=900012') ? Promise.reject(new Error('HTTP 500')) : inner(url)
    );
    await expect(resolveStudies(options(CONCURRENT), '900012')).rejects.toThrow('HTTP 500');
  });

  it("reads the kept study's page last", async () => {
    serve(CONCURRENT, { '900011': 'řádně zapsán', '900012': 'řádně zapsán' });
    await resolveStudies(options(CONCURRENT), '900011');
    const urls = fetchWithAuth.mock.calls
      .map((c) => c[0] as string)
      .filter((u) => u?.includes('studium='));
    expect(urls.at(-1)).toContain('studium=900011');
  });
});
