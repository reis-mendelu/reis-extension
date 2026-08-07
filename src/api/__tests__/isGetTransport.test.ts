import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { fetchCvicneTests } from '../cvicneTests';
import { fetchOdevzdavarny } from '../odevzdavarny';
import { fetchKontrolaData } from '../kontrola';
import { fetchWithAuth } from '../client';

const html = (body = '<html><body></body></html>') =>
  ({ ok: true, status: 200, text: async () => body }) as Response;

/**
 * The three plain-GET rows of Task 4. Each is fetched in both languages (or
 * once, for kontrola) and parsed; none of them may reach IS through a bare
 * fetch, which is CORS-blocked from the Capacitor app's own origin.
 *
 * Parsers are deliberately not exercised here — these assert transport only.
 * cvicneTests.ts in particular is a protected parser file (CLAUDE.md > Parser
 * Rules); the migration touched its network line and nothing else.
 */
describe('IS GET endpoints use the shared transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.mocked(fetchWithAuth).mockResolvedValue(html());
  });

  it.each([
    ['fetchCvicneTests', () => fetchCvicneTests('123'), 2],
    ['fetchOdevzdavarny', () => fetchOdevzdavarny('123', '456'), 2],
    ['fetchKontrolaData', () => fetchKontrolaData(), 1],
  ])('%s goes through fetchWithAuth, never the bare browser fetch', async (_n, run, calls) => {
    await run();

    expect(fetchWithAuth).toHaveBeenCalledTimes(calls);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetchCvicneTests still requests both languages of seznam_osnov', async () => {
    await fetchCvicneTests('123');

    expect(vi.mocked(fetchWithAuth).mock.calls.map((c) => c[0])).toEqual([
      'https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=123;lang=cz',
      'https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=123;lang=en',
    ]);
  });

  it('fetchOdevzdavarny still requests both languages for the period', async () => {
    await fetchOdevzdavarny('123', '456');

    expect(vi.mocked(fetchWithAuth).mock.calls.map((c) => c[0])).toEqual([
      'https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=123;obdobi=456;lang=cz',
      'https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=123;obdobi=456;lang=en',
    ]);
  });

  it('fetchKontrolaData still requests the Czech kontrola page', async () => {
    await fetchKontrolaData();

    expect(vi.mocked(fetchWithAuth).mock.calls[0]?.[0]).toBe(
      'https://is.mendelu.cz/auth/kontrola/?lang=cz'
    );
  });

  // All three already degraded to null on failure and must keep doing so:
  // fetchWithAuth THROWS on a non-ok status where a bare fetch resolved, so a
  // dropped catch would turn a lapsed session into an unhandled rejection
  // inside a sync run rather than a missing panel.
  it.each([
    ['fetchCvicneTests', () => fetchCvicneTests('123')],
    ['fetchOdevzdavarny', () => fetchOdevzdavarny('123', '456')],
    ['fetchKontrolaData', () => fetchKontrolaData()],
  ])('%s degrades to null when the request throws', async (_n, run) => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new Error('Request failed with status 500'));

    await expect(run()).resolves.toBeNull();
  });

  it.each([
    ['fetchCvicneTests', () => fetchCvicneTests('123')],
    ['fetchOdevzdavarny', () => fetchOdevzdavarny('123', '456')],
    ['fetchKontrolaData', () => fetchKontrolaData()],
  ])('%s degrades to null on a non-ok response', async (_n, run) => {
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    } as Response);

    await expect(run()).resolves.toBeNull();
  });
});
