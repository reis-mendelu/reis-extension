import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDualLanguageExams } from '../exams';
import * as client from '../client';
import * as userParams from '../../utils/userParams';
import { logError } from '../../utils/reportError';
import { SIGNUP_BLOCKED_PAGE } from '../../test/fixtures/examsSignupBlockedPage';

vi.mock('../client');
vi.mock('../../utils/userParams');
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

/**
 * Report 41, "prázdné zkoušky": a terminy_seznam page whose term rows the
 * parser could not read came back as `[]`, which the sync takes for "IS
 * answered, no exams". Such a page is now a failed read in that language —
 * the same throw an unreachable IS gives (#511) — while a page that offered
 * no term rows is still the empty answer it was.
 *
 * SIGNUP_BLOCKED_PAGE is a clone of a real table_3 row with made-up ids.
 */
const html = (body: string) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });

function serve(cz: string, en = cz) {
  vi.mocked(client.fetchWithAuth).mockImplementation(async (url: string) =>
    html(url.includes('lang=en') ? en : cz)
  );
}

// IS switching its date format is the kind of change that empties every row:
// the parser finds no date cell and skips the row without a word.
const ISO_DATES = SIGNUP_BLOCKED_PAGE.replace(/(\d{2})\.(\d{2})\.(\d{4})/g, '$3-$2-$1');
const LOGIN = '<html><body><input type="password" name="credential_1"></body></html>';
const THEAD =
  '<thead><tr><th>Poř.</th><th>Kód</th><th>Předmět</th><th>Datum termínu</th></tr></thead>';

const notUnderstoodLines = () =>
  vi
    .mocked(logError)
    .mock.calls.map(([, e]) => (e instanceof Error ? e.message.split('\n')[0]! : ''))
    .filter((m) => m.includes('not understood'));

describe('fetchDualLanguageExams on a page it does not understand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userParams.getUserParams).mockResolvedValue({
      studium: '111',
      obdobi: '222',
    } as Awaited<ReturnType<typeof userParams.getUserParams>>);
  });

  it('still reads a real-shaped page into the same exams', async () => {
    serve(SIGNUP_BLOCKED_PAGE);

    const exams = await fetchDualLanguageExams();

    expect(exams.map((e) => e.code)).toEqual(['ETWHZ']);
    expect(notUnderstoodLines()).toEqual([]);
  });

  it('R1: term rows offered and none read rejects, so the cached exams stay', async () => {
    serve(ISO_DATES);

    await expect(fetchDualLanguageExams()).rejects.toThrow(/not understood/);

    const lines = notUnderstoodLines();
    expect(lines).toContain(
      'exams (cz) page not understood: rows=1 registered=0 available=0 blocked=1 tables=3 signedIn=false loginForm=false'
    );
    for (const l of lines) expect(l).not.toMatch(/ETWHZ|Etologie|Vyškov|termin|\d{5,}/);
  });

  it('one language not understood is that language failing, as before', async () => {
    serve(SIGNUP_BLOCKED_PAGE, ISO_DATES);

    const exams = await fetchDualLanguageExams();

    expect(exams.map((e) => e.code)).toEqual(['ETWHZ']);
    expect(notUnderstoodLines()).toHaveLength(1);
  });

  it('R2: the login form rejects instead of answering "no exams"', async () => {
    serve(LOGIN);

    await expect(fetchDualLanguageExams()).rejects.toThrow(/not understood/);
  });

  it('keeps a page with no term rows empty, exactly as today', async () => {
    // No real empty terminy_seznam page is on file, so every way IS might draw
    // "nothing" stays the empty answer: no tables, empty tables, and a
    // one-cell placeholder row (the parser's own cell guard skips it too).
    for (const page of [
      '<html><body><p>Žádné termíny</p></body></html>',
      `<table id="table_1">${THEAD}<tbody></tbody></table><table id="table_2">${THEAD}<tbody></tbody></table>`,
      `<table id="table_2">${THEAD}<tbody><tr><td colspan="12">Žádné termíny</td></tr></tbody></table>`,
    ]) {
      serve(page);
      await expect(fetchDualLanguageExams()).resolves.toEqual([]);
    }
    expect(notUnderstoodLines()).toEqual([]);
  });
});
