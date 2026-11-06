import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../client', () => ({ BASE_URL: 'https://is.mendelu.cz', fetchWithAuth: vi.fn() }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../../../utils/requestQueue', () => ({
  requestQueue: { add: vi.fn((fn: () => unknown) => fn()) },
  processWithDelay: vi.fn((items: unknown[], fn: (i: unknown) => unknown) =>
    Promise.all(items.map(fn))
  ),
}));

import { fetchWithAuth } from '../../client';
import { parseServerFiles } from '../parser';
import { fetchFolderListing } from '../service';

// Real IS dok_server pages, trimmed and anonymised (see the comment atop each).
const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', '..', '__tests__', 'fixtures', `${name}.cz.html`), 'utf-8');

const pageOf = (link: string) => Number(link.match(/[?;]on=(\d+)/)?.[1]);

/**
 * IS lists a folder ten documents a page. Student report (Nov 2026): a subject
 * with 11 files showed 10 — the last page held one document, and IS labels a
 * one-document page "11", not "11–11", which the old range-only link match
 * skipped. A folder of 96 showed 50: IS windows its page bar ("1–10 … 41–50
 * …") and reaches the rest only through the arrows, which carry no text.
 */
describe('folder pagination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('follows a last page labelled with a single number', () => {
    const { paginationLinks } = parseServerFiles(fixture('slozka-11.on0'));
    expect(paginationLinks.map(pageOf)).toEqual([1]);
  });

  it('reaches every page of a windowed page bar, not just the numbered ones', () => {
    const { paginationLinks } = parseServerFiles(fixture('slozka-96.on0'));
    expect(paginationLinks.map(pageOf)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps the page links IS printed, so the folder and its language stay put', () => {
    const { paginationLinks } = parseServerFiles(fixture('slozka-96.on0'));
    for (const link of paginationLinks) {
      expect(link).toMatch(/^slozka\.pl\?id=900002;typ=mod;on=\d+;lang=cz$/);
    }
  });

  it('lists all 11 documents of an 11-document folder', async () => {
    vi.mocked(fetchWithAuth).mockImplementation(
      async (url) =>
        new Response(fixture(/[?;]on=1[;&]/.test(String(url)) ? 'slozka-11.on1' : 'slozka-11.on0'))
    );

    const listing = await fetchFolderListing(
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=900001'
    );

    expect(listing.complete).toBe(true);
    expect(listing.files).toHaveLength(11);
    expect(listing.files.map((f) => f.file_name)).toContain('Zadani_seminarnich_praci');
    // Page 1 is the folder URL itself; only page 2 is fetched in addition.
    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
  });
});
