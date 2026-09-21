import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * IS answers a zero-result schedule query with HTML, not with empty JSON.
 *
 * Measured against live IS on 2026-09-21, same session, same POST body, only
 * `konani_od`/`konani_do` varying:
 *
 *   21.09.2026–27.09.2026  → application/json, 10 lessons
 *   01.09.2026–31.08.2027  → application/json, 136 lessons  (what the app sends)
 *   01.09.2026–20.09.2026  → text/html, no results
 *   01.03.2026–31.03.2026  → text/html, no results
 *   01.07.2027–31.08.2027  → text/html, no results
 *
 * So HTML comes back only when the WHOLE window is empty; a window with some
 * lessons and an empty tail still answers JSON. The page carries `logout.pl`,
 * so it passes `isAuthenticatedHtml()` in capacitorTransport and is handed to
 * this module as if it were data.
 *
 * `fixtures/is-rozvrh-no-results.html` is that real response, scrubbed of
 * personal data (name → Jan Novák, ids replaced) and otherwise untouched.
 */
const noResultsHtml = readFileSync(
  resolve(process.cwd(), 'src/api/__tests__/fixtures/is-rozvrh-no-results.html'),
  'utf8'
);

/**
 * The SAME page in English, because `fetchDualLanguageSchedule` asks IS for
 * both languages on every sync and IS translates this sentence.
 *
 * Measured against live IS on 2026-09-21, same empty window, same session:
 * `lang=cz` answers `nevyhovuje žádná rozvrhová akce`, `lang=en` answers
 * `No class match the selected criteria.` — IS's own wording, grammar and all.
 * Matching only the Czech one made every EN leg report a FAILURE for a window
 * that simply has no lessons, and file a false error report for each one.
 */
const noResultsHtmlEn = readFileSync(
  resolve(process.cwd(), 'src/api/__tests__/fixtures/is-rozvrh-no-results-en.html'),
  'utf8'
);

const fetchWithAuth = vi.fn();
vi.mock('../client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));
vi.mock('../user', () => ({ getUserId: async () => 'u1' }));
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => ({ studium: 'st1', obdobi: 'ob1' }),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { fetchWeekSchedule } from '../schedule';
import { logError } from '../../utils/reportError';

const RANGE = { start: new Date(2026, 2, 1), end: new Date(2026, 2, 31) };

function respond(body: string, contentType: string): void {
  fetchWithAuth.mockResolvedValue(
    new Response(body, { status: 200, headers: { 'Content-Type': contentType } })
  );
}

describe('fetchWeekSchedule distinguishes an empty window from a failure', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] for IS's real zero-result HTML page", async () => {
    respond(noResultsHtml, 'text/html; charset=utf-8');
    await expect(fetchWeekSchedule(RANGE, 'cz')).resolves.toEqual([]);
  });

  it('returns null for any other non-JSON body, so a failure is not an empty timetable', async () => {
    // Anything from a redirected login page to an IS error page lands here.
    // Before this change every one of them became `[]`, which then overwrote
    // the student's cached timetable at three layers above this one.
    respond('<html><body>Interní chyba serveru</body></html>', 'text/html; charset=utf-8');
    await expect(fetchWeekSchedule(RANGE, 'cz')).resolves.toBeNull();
  });

  it('still parses a JSON answer', async () => {
    respond(JSON.stringify({ blockLessons: [{ id: 'l1' }] }), 'application/json');
    await expect(fetchWeekSchedule(RANGE, 'cz')).resolves.toEqual([{ id: 'l1' }]);
  });

  it("returns [] for IS's English zero-result page, and reports no failure", async () => {
    respond(noResultsHtmlEn, 'text/html; charset=utf-8');
    await expect(fetchWeekSchedule(RANGE, 'en')).resolves.toEqual([]);
    expect(vi.mocked(logError)).not.toHaveBeenCalled();
  });

  it('still reports a genuine non-JSON failure, in either language', async () => {
    respond('<html><body>Internal server error</body></html>', 'text/html; charset=utf-8');
    await expect(fetchWeekSchedule(RANGE, 'en')).resolves.toBeNull();
    expect(vi.mocked(logError)).toHaveBeenCalled();
  });

  it('the English fixture really is the page IS serves', () => {
    expect(noResultsHtmlEn).toContain('No class match the selected criteria');
    expect(noResultsHtmlEn).toContain('logout.pl');
    // The whole point of the second marker: the Czech sentence is absent here.
    expect(noResultsHtmlEn).not.toContain('nevyhovuje žádná rozvrhová akce');
  });

  it('the fixture really is the page IS serves — marker present, session still valid', () => {
    // If IS ever stops sending this sentence the marker match stops firing and
    // every empty window becomes a failure (ScreenError, not "no lessons").
    // `logout.pl` is why the transport's auth check waves the page through.
    expect(noResultsHtml).toContain('nevyhovuje žádná rozvrhová akce');
    expect(noResultsHtml).toContain('logout.pl');
  });
});
