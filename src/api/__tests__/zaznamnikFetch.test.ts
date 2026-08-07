import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));

import { fetchSubjectZaznamnik } from '../zaznamnik';
import { fetchWithAuth } from '../client';
import { logError } from '../../utils/reportError';

const html = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response;

const EMPTY_PH = '<html><body></body></html>';
const EMPTY_VT = '<html><body>Neexistuje žádný Vámi napsaný test.</body></html>';

describe('fetchSubjectZaznamnik', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
      url.includes('test=1') ? html(EMPTY_VT) : html(EMPTY_PH)
    );
  });

  // The reason this migration exists. syncZaznamnik runs inside the main sync
  // run (injector/syncService.ts:381), which on Capacitor executes in the app,
  // not a content script — and IS denies CORS to every origin, so a bare fetch
  // from the app's own origin cannot reach it. Continuous assessment silently
  // never arrived on the phone while everything around it did.
  it('goes through fetchWithAuth, never the bare browser fetch', async () => {
    await fetchSubjectZaznamnik('123', '456', '789');

    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // IS separates query params with `;`, not `&`, and the two pages differ only
  // by the trailing `prubezne=1` / `test=1` flag. Getting either wrong returns
  // a valid page that parses to nothing rather than an error.
  it('requests the prubezne and test pages with IS semicolon params', async () => {
    await fetchSubjectZaznamnik('123', '456', '789');

    const urls = vi.mocked(fetchWithAuth).mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      'https://is.mendelu.cz/auth/student/list.pl?studium=123;obdobi=456;predmet=789;prubezne=1;lang=cz',
      'https://is.mendelu.cz/auth/student/list.pl?studium=123;obdobi=456;predmet=789;test=1;lang=cz',
    ]);
  });

  it('parses both pages into a ph/vt pair', async () => {
    const result = await fetchSubjectZaznamnik('123', '456', '789');

    expect(result?.ph.sections).toEqual([]);
    expect(result?.vt.tests).toEqual([]);
  });

  // The soft failure is load-bearing: syncZaznamnik swallows per-subject
  // failures and the slice's merge guard keeps the previously synced values, so
  // one bad subject must never take down the batch or blank existing scores.
  it('returns null and reports rather than throwing when a request fails', async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new Error('Request failed with status 500'));

    await expect(fetchSubjectZaznamnik('123', '456', '789')).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith('Api.fetchSubjectZaznamnik', expect.any(Error));
  });

  // fetchWithAuth throws on a non-ok status in the content-script branch, but
  // the iframe-proxy branch synthesises a 200 for everything. The explicit
  // check stays so a proxied failure cannot be parsed as a real page.
  it('returns null when either page comes back non-ok', async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
      url.includes('test=1')
        ? ({ ok: false, status: 500, text: async () => '' } as Response)
        : html(EMPTY_PH)
    );

    await expect(fetchSubjectZaznamnik('123', '456', '789')).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith('Api.fetchSubjectZaznamnik', expect.any(Error));
  });
});
