import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchGlobal, searchPeople } from '../searchService';
import { setPlatform, __resetPlatformForTests } from '../../../platform';
import type { ReisPlatform } from '../../../platform/types';

function bodyOf(call: unknown): URLSearchParams {
  const [, init] = call as [unknown, { body: string }];
  return new URLSearchParams(init.body);
}

// A real Response, not `{ text }`: these calls go through fetchWithAuth, which
// reads `response.ok`. A bare-object stub has no `ok`, so it would read as a
// failed request — the stub has to produce what the transport actually returns.
const htmlResponse = (html: string) =>
  new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

function stubPlatform(): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind: 'extension',
    storage: {
      async get(k) {
        return bag.get(k);
      },
      async set(k, v) {
        bag.set(k, v);
      },
      async remove(k) {
        bag.delete(k);
      },
    },
    getAssetUrl: (p) => `/${p}`,
  };
}

describe('searchGlobal', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => htmlResponse('<html></html>'));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('university-wide (no subjekt): single combined request for people + subjects, default lang cz', async () => {
    await searchGlobal('marketing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.get('lang')).toBe('cz');
    expect(body.get('vzorek')).toBe('marketing');
    expect(body.getAll('oblasti')).toEqual(['lide', 'predmety']);
    expect(body.get('subjekt')).toBeNull();
    expect(Number(body.get('pocet'))).toBeGreaterThanOrEqual(100);
  });

  it('faculty-scoped: people stay university-wide, subjects restricted to the faculty subjekt', async () => {
    await searchGlobal('management', 'en', '43110');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(bodyOf);
    const peopleReq = bodies.find((b) => b.getAll('oblasti').includes('lide'))!;
    const subjectReq = bodies.find((b) => b.getAll('oblasti').includes('predmety'))!;

    expect(peopleReq.getAll('oblasti')).toEqual(['lide']);
    expect(peopleReq.get('subjekt')).toBeNull(); // people NOT faculty-scoped
    expect(peopleReq.get('lang')).toBe('en');

    expect(subjectReq.getAll('oblasti')).toEqual(['predmety']);
    expect(subjectReq.get('subjekt')).toBe('43110'); // subjects scoped
    expect(subjectReq.get('lang')).toBe('en');
  });

  it('flags truncation when the subject result count hits the cap', async () => {
    const links = Array.from(
      { length: 100 },
      (_, i) => `<a href="../katalog/syllabus.pl?predmet=${i}">EBC-X${i} Subj ${i}</a>`
    ).join('');
    fetchMock.mockResolvedValue(htmlResponse(`<html><body>${links}</body></html>`));
    const res = await searchGlobal('a');
    expect(res.subjectsTruncated).toBe(true);
  });

  it('does not flag truncation for a small result set', async () => {
    fetchMock.mockResolvedValue(
      htmlResponse(
        '<html><body><a href="../katalog/syllabus.pl?predmet=1">EBC-WGD Web</a></body></html>'
      )
    );
    const res = await searchGlobal('webova');
    expect(res.subjectsTruncated).toBe(false);
    expect(res.subjects).toHaveLength(1);
  });
});

/**
 * Search reaches IS through a bare `fetch`, so it is CORS-blocked on Capacitor —
 * on the phone, searching for a person or a subject finds nothing. The fix is to
 * route it through fetchWithAuth, but these are POSTs that set their own
 * `Content-Type`, which walks straight into the defect already found twice in
 * this codebase (eduroam's generate POST, and outlookSync, which still has it):
 *
 * DEFAULT_HEADERS carries a lowercase `content-type`; a caller's `Content-Type`
 * survives the object spread as a SECOND key, and `Headers` APPENDS rather than
 * replaces. IS then receives the value twice, parses no body, and returns a
 * page with `ok: true` — so search silently yields zero results and nothing
 * anywhere reports an error.
 *
 * Keys are counted on the object handed to fetch rather than read back through
 * `new Headers`, because happy-dom's Headers is the one implementation that
 * REPLACES on a duplicate name — asserting through it would pass while the wire
 * stayed malformed.
 */
describe('search POSTs on the wire', () => {
  beforeEach(() => setPlatform(stubPlatform()));
  afterEach(() => {
    __resetPlatformForTests();
    vi.restoreAllMocks();
  });

  function captureInit() {
    const seen: { init?: RequestInit } = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, i) => {
      seen.init = i;
      return htmlResponse('<html></html>');
    });
    return seen;
  }

  const contentTypesOn = (init: RequestInit | undefined) =>
    Object.entries((init?.headers ?? {}) as Record<string, string>)
      .filter(([key]) => key.toLowerCase() === 'content-type')
      .map(([, value]) => value);

  it('routes the people POST through the authenticated transport', async () => {
    const seen = captureInit();

    await searchPeople('Novák');

    // DEFAULT_HEADERS is the transport's fingerprint: a bare fetch sends none of it.
    const headers = (seen.init?.headers ?? {}) as Record<string, string>;
    expect(headers['accept-language']).toBeDefined();
    expect(seen.init?.credentials).toBe('include');
    // The body must survive the hop — an empty POST is the exact failure mode here.
    expect(new URLSearchParams(seen.init?.body as string).get('vzorek')).toBe('Novák');
  });

  // Guard, not a driver: this holds today with a bare fetch and must still hold
  // once the caller's Content-Type meets DEFAULT_HEADERS' lowercase one.
  it('sends exactly one content-type on the people POST', async () => {
    const seen = captureInit();
    await searchPeople('Novák');
    expect(contentTypesOn(seen.init)).toEqual(['application/x-www-form-urlencoded']);
  });

  it('sends exactly one content-type on the subject catalog POST', async () => {
    const seen = captureInit();
    await searchGlobal('marketing');
    expect(contentTypesOn(seen.init)).toEqual(['application/x-www-form-urlencoded']);
  });
});
