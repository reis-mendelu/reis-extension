import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));

vi.mock('../../utils/reportError', () => ({
  logError: vi.fn(),
}));

import { fetchWithAuth } from '../client';
import { fetchClassmates, fetchSubjectClassmates } from '../classmates';

// Real IS pages of a 519-student lecture (on=0, on=8, on=12), trimmed to two
// rows each and anonymised — see the comment at the top of each fixture.
const fixture = (on: number) =>
  readFileSync(join(__dirname, 'fixtures', `spoluzaci-predmet.on${on}.cz.html`), 'utf-8');
const CAPTURED: Record<number, string> = { 0: fixture(0), 8: fixture(8), 12: fixture(12) };

/**
 * The pages between the captured ones: the on=8 page with its two people
 * renumbered, so every page contributes two distinct students.
 */
function pageHtml(on: number, rewrite: (html: string) => string = (h) => h): string {
  const captured = CAPTURED[on];
  if (captured) return rewrite(captured);
  return rewrite(
    CAPTURED[8]!
      .replaceAll('id=900080', `id=${900000 + on * 10}`)
      .replaceAll('id=900081', `id=${900000 + on * 10 + 1}`)
  );
}

const onOf = (url: string) => Number(url.match(/;on=(\d+)/)?.[1] ?? 0);

function serve(rewrite?: (html: string) => string) {
  vi.mocked(fetchWithAuth).mockImplementation(
    async (url: string) => new Response(pageHtml(onOf(url), rewrite))
  );
}

const requested = () => vi.mocked(fetchWithAuth).mock.calls.map(([url]) => url as string);

describe('fetchSubjectClassmates — the whole-subject list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks IS for the subject without a skupina, the URL IS itself links from Moji spolužáci', async () => {
    serve();
    await fetchSubjectClassmates('111111', '222222', '333');
    expect(requested()[0]).toBe(
      'https://is.mendelu.cz/auth/student/spoluzaci.pl?predmet=111111;;studium=222222;obdobi=333;lang=cz'
    );
  });

  it('reaches the pages past the windowed bar, and fetches each page once although IS prints the bar twice', async () => {
    serve();
    const all = await fetchSubjectClassmates('111111', '222222', '333');

    // on=0 links numerically only to on=8; on=9..11 appear only on later pages.
    const pages = requested()
      .map(onOf)
      .sort((a, b) => a - b);
    expect(pages).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(all).toHaveLength(26);
    expect(new Set(all.map((c) => c.personId)).size).toBe(26);
  });

  it('keeps IS order: page by page, first page first', async () => {
    serve();
    const all = await fetchSubjectClassmates('111111', '222222', '333');
    expect(all[0]!.name).toBe('Nováková Tereza');
    expect(all.at(-1)!.personId).toBe(900121);
  });

  it('never follows the English or Slovak switch, which carries on= too', async () => {
    serve((html) =>
      html.replace(
        '</body>',
        '<a href="https://is.mendelu.cz/auth/student/spoluzaci.pl?predmet=111111;studium=222222;obdobi=333;on=5;lang=en">English </a></body>'
      )
    );
    await fetchSubjectClassmates('111111', '222222', '333');
    expect(requested().filter((u) => !u.includes('lang=cz'))).toEqual([]);
  });

  it('lists a person once when IS repeats them across pages', async () => {
    serve((html) => html.replaceAll(/id=9000[89]\d/g, 'id=900000'));
    const all = await fetchSubjectClassmates('111111', '222222', '333');
    expect(all.filter((c) => c.personId === 900000)).toHaveLength(1);
  });

  it('fails as a whole when one page fails — a partial list would show a wrong count', async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async (url: string) => {
      if (onOf(url) === 12) throw new Error('IS 500');
      return new Response(pageHtml(onOf(url)));
    });
    await expect(fetchSubjectClassmates('111111', '222222', '333')).rejects.toThrow('IS 500');
  });
});

describe('fetchClassmates — the seminar group', () => {
  beforeEach(() => vi.clearAllMocks());

  // A seminar's page bar carries its skupina; follow only links to that group.
  const asSeminar = (html: string) =>
    html.replaceAll('obdobi=333;on=', 'obdobi=333;skupina=444;on=');

  it('fetches every page once, through the same crawler', async () => {
    serve(asSeminar);
    const roster = await fetchClassmates('111111', '222222', '333', '444');
    expect(requested()[0]).toBe(
      'https://is.mendelu.cz/auth/student/spoluzaci.pl?predmet=111111;;studium=222222;obdobi=333;skupina=444;lang=cz'
    );
    expect(
      requested()
        .map(onOf)
        .sort((a, b) => a - b)
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(roster).toHaveLength(26);
  });

  it('does not wander from the seminar into the whole-subject list', async () => {
    serve(); // bar links carry no skupina — they are the whole subject's pages
    const roster = await fetchClassmates('111111', '222222', '333', '444');
    expect(requested()).toHaveLength(1);
    expect(roster).toHaveLength(2);
  });
});
