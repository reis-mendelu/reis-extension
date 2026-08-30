import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));

import {
  searchGlobal,
  searchPeople,
  searchSubjects,
  searchSubjectsCatalog,
  fetchPersonProfile,
} from '../searchService';
import { fetchWithAuth } from '../../client';

const html = (body = '<html></html>') => ({ ok: true, text: async () => body }) as Response;

type Init = { method?: string; body?: string; headers?: Record<string, string> };
const initOf = (i: number) => (vi.mocked(fetchWithAuth).mock.calls[i]?.[1] ?? {}) as Init;

describe('search transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.mocked(fetchWithAuth).mockResolvedValue(html());
  });

  // Search is the one Task 4 row the student drives by hand, so a CORS block
  // here is a dead search box rather than a quietly missing panel. All five
  // sites ran a bare fetch, which works in the extension only because the
  // iframe inherits host_permissions — a privilege the Capacitor app has not
  // got.
  it.each([
    ['searchGlobal', () => searchGlobal('marketing')],
    ['searchPeople', () => searchPeople('Novak')],
    ['searchSubjects', () => searchSubjects('webove')],
    ['searchSubjectsCatalog', () => searchSubjectsCatalog('webove')],
    ['fetchPersonProfile', () => fetchPersonProfile('12345')],
  ])('%s goes through fetchWithAuth, never the bare browser fetch', async (_name, run) => {
    await run();

    expect(fetchWithAuth).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // The defect the plan recorded on the deleted outlookSync.ts, avoided here.
  // Passing a
  // capitalised `Content-Type` into fetchWithAuth does NOT overwrite
  // DEFAULT_HEADERS' lowercase one — both keys survive the object spread and
  // `Headers` APPENDS, so IS receives the value twice, parses no body, and
  // still answers 200. Every POST here needs form-urlencoded, and both
  // transports already supply exactly that: DEFAULT_HEADERS on the extension,
  // and capacitorTransport's POST-only default on native.
  it.each([
    ['searchGlobal', () => searchGlobal('marketing')],
    ['searchPeople', () => searchPeople('Novak')],
    ['searchSubjects', () => searchSubjects('webove')],
    ['searchSubjectsCatalog', () => searchSubjectsCatalog('webove')],
  ])('%s sets no Content-Type of its own', async (_name, run) => {
    await run();

    for (const call of vi.mocked(fetchWithAuth).mock.calls) {
      const headers = ((call[1] ?? {}) as Init).headers ?? {};
      const names = Object.keys(headers).map((k) => k.toLowerCase());
      expect(names).not.toContain('content-type');
    }
  });

  it('still POSTs the urlencoded form body each search depends on', async () => {
    await searchGlobal('marketing');

    const init = initOf(0);
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(init.body);
    expect(body.get('vzorek')).toBe('marketing');
    expect(body.getAll('oblasti')).toEqual(['lide', 'predmety']);
  });

  it('fetchPersonProfile stays a GET', async () => {
    await fetchPersonProfile('12345');

    expect(vi.mocked(fetchWithAuth).mock.calls[0]?.[0]).toBe(
      'https://is.mendelu.cz/auth/lide/clovek.pl?id=12345;lang=cz'
    );
    expect(initOf(0).method).toBeUndefined();
  });

  // Every one of these already swallowed failures into an empty result, and
  // that must survive: a lapsed session on mobile now throws out of
  // fetchWithAuth where a bare fetch used to resolve, so an uncaught throw here
  // would take down the whole search UI instead of showing no results.
  it.each([
    ['searchPeople', () => searchPeople('Novak'), []],
    ['searchSubjects', () => searchSubjects('webove'), []],
    ['searchSubjectsCatalog', () => searchSubjectsCatalog('webove'), []],
    ['fetchPersonProfile', () => fetchPersonProfile('12345'), null],
  ])('%s degrades to an empty result when the request throws', async (_name, run, expected) => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new Error('Request failed with status 401'));

    await expect(run()).resolves.toEqual(expected);
  });

  // searchGlobal's catch falls back to searchPeople, which has its own catch —
  // so a total failure must still resolve rather than reject.
  it('searchGlobal degrades to an empty result when every request throws', async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new Error('Request failed with status 401'));

    await expect(searchGlobal('marketing')).resolves.toEqual({
      people: [],
      subjects: [],
      subjectsTruncated: false,
    });
  });
});
