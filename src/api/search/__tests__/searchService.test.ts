import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks fetchWithAuth rather than global.fetch: search moved onto the shared
// transport so it survives Capacitor, where a bare fetch is CORS-blocked. The
// assertions below are unchanged — the request body is what they care about,
// and it rides through fetchWithAuth untouched.
vi.mock('../../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));

import { searchGlobal } from '../searchService';
import { fetchWithAuth } from '../../client';

function bodyOf(call: unknown): URLSearchParams {
  const [, init] = call as [unknown, { body: string }];
  return new URLSearchParams(init.body);
}

const htmlResponse = (html: string) =>
  ({ ok: true, text: async () => html }) as unknown as Response;

describe('searchGlobal', () => {
  let fetchMock: ReturnType<typeof vi.mocked<typeof fetchWithAuth>>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.mocked(fetchWithAuth);
    fetchMock.mockResolvedValue(htmlResponse('<html></html>'));
  });

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
