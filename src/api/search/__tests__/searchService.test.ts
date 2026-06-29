import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchGlobal } from '../searchService';

function bodyOf(call: unknown): URLSearchParams {
  const [, init] = call as [unknown, { body: string }];
  return new URLSearchParams(init.body);
}

const htmlResponse = (html: string) => ({ text: async () => html }) as unknown as Response;

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
    const peopleReq = bodies.find(b => b.getAll('oblasti').includes('lide'))!;
    const subjectReq = bodies.find(b => b.getAll('oblasti').includes('predmety'))!;

    expect(peopleReq.getAll('oblasti')).toEqual(['lide']);
    expect(peopleReq.get('subjekt')).toBeNull(); // people NOT faculty-scoped
    expect(peopleReq.get('lang')).toBe('en');

    expect(subjectReq.getAll('oblasti')).toEqual(['predmety']);
    expect(subjectReq.get('subjekt')).toBe('43110'); // subjects scoped
    expect(subjectReq.get('lang')).toBe('en');
  });

  it('flags truncation when the subject result count hits the cap', async () => {
    const links = Array.from({ length: 100 }, (_, i) =>
      `<a href="../katalog/syllabus.pl?predmet=${i}">EBC-X${i} Subj ${i}</a>`
    ).join('');
    fetchMock.mockResolvedValue(htmlResponse(`<html><body>${links}</body></html>`));
    const res = await searchGlobal('a');
    expect(res.subjectsTruncated).toBe(true);
  });

  it('does not flag truncation for a small result set', async () => {
    fetchMock.mockResolvedValue(htmlResponse('<html><body><a href="../katalog/syllabus.pl?predmet=1">EBC-WGD Web</a></body></html>'));
    const res = await searchGlobal('webova');
    expect(res.subjectsTruncated).toBe(false);
    expect(res.subjects).toHaveLength(1);
  });
});
