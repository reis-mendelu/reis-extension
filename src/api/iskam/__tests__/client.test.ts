/**
 * The WebISKAM transport, and the only place a lapsed ISKAM session is detected.
 *
 * WebISKAM does not answer an expired session with a 401. It 302s to the
 * Shibboleth IdP and returns 200 with a sign-in page, so every one of these
 * requests succeeds by HTTP's reckoning. If the detection below misses, that
 * sign-in HTML goes straight into the parsers, which find no tables and return
 * empty arrays — and the student sees an account with no balance, no room and no
 * reservations rather than a prompt to sign in again.
 *
 * Per CLAUDE.md the IskamAuthError is what makes the handler redirect to
 * re-authenticate, so throwing it is the behaviour, not an implementation detail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIskam, postIskam, requestIskam, ISKAM_BASE } from '../client';
import { IskamAuthError } from '../errors';

/** A Response stand-in: `url` is the POST-REDIRECT url, which is the tell. */
function response(over: { url?: string; ok?: boolean; status?: number; body?: string } = {}) {
  return {
    url: over.url ?? `${ISKAM_BASE}/Konta`,
    ok: over.ok ?? true,
    status: over.status ?? 200,
    text: async () => over.body ?? '<html>data</html>',
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(response());
});

describe('session expiry detection', () => {
  // The three hosts/paths a Shibboleth bounce lands on.
  it.each([
    ['the IdP host', 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO'],
    ['an /idp/ path', `${ISKAM_BASE}/idp/login`],
    ['the unauthenticated home', `${ISKAM_BASE}/Home/Index`],
  ])('throws IskamAuthError when the response redirected to %s', async (_label, url) => {
    fetchMock.mockResolvedValue(response({ url }));

    await expect(fetchIskam('/Konta')).rejects.toBeInstanceOf(IskamAuthError);
  });

  it('throws IskamAuthError when the BODY is a sign-in page despite a clean url', async () => {
    // The redirect chain can be invisible to response.url; the body is the
    // second, independent tell. Without it a 200 of login HTML is parsed as data.
    fetchMock.mockResolvedValue(
      response({ body: '<form action="https://alibaba.mendelu.cz/idp/profile">' })
    );

    await expect(fetchIskam('/Konta')).rejects.toBeInstanceOf(IskamAuthError);
  });

  it('does not mistake ordinary content for a sign-in page', async () => {
    fetchMock.mockResolvedValue(response({ body: '<table id="konta">1234 Kč</table>' }));

    await expect(fetchIskam('/Konta')).resolves.toContain('konta');
  });

  it('reports a genuine server error as an error, not as expiry', async () => {
    // A 500 is WebISKAM being broken, not the student being logged out — telling
    // them to sign in again would send them round a loop that cannot help.
    fetchMock.mockResolvedValue(response({ ok: false, status: 500 }));

    await expect(fetchIskam('/Konta')).rejects.toThrow('500');
    await expect(fetchIskam('/Konta')).rejects.not.toBeInstanceOf(IskamAuthError);
  });
});

describe('fetchIskam request shape', () => {
  it('sends cookies — the whole request depends on the session', async () => {
    await fetchIskam('/Konta');

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { credentials: 'include' });
  });

  it('DOUBLE-encodes the path, which is what the server expects', async () => {
    // %252f decodes to %2f decodes to '/'. Single-encoding makes ChangeLang
    // redirect to the wrong page and the parsers receive the dashboard instead.
    await fetchIskam('/PrehledUbytovani/Detail');

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(encodeURIComponent(encodeURIComponent('/PrehledUbytovani/Detail')));
    // Uppercase: that is what encodeURIComponent emits.
    expect(url).toContain('%252F');
  });

  it('asks for the Czech locale by default and English on request', async () => {
    await fetchIskam('/Konta');
    expect(fetchMock.mock.calls[0]![0]).toContain('lang=cs-CZ');

    fetchMock.mockClear();
    await fetchIskam('/Konta', 'en');
    expect(fetchMock.mock.calls[0]![0]).toContain('lang=en-US');
  });

  it('goes through ChangeLang so the locale cookie is set in the same hop', async () => {
    await fetchIskam('/Konta');

    expect(fetchMock.mock.calls[0]![0]).toContain('/Localize/ChangeLang');
  });
});

describe('postIskam', () => {
  it('form-encodes the body and sends cookies', async () => {
    await postIskam('/Rezervace/Create', new URLSearchParams({ blockId: '7' }));

    expect(fetchMock).toHaveBeenCalledWith(
      `${ISKAM_BASE}/Rezervace/Create`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'blockId=7',
      })
    );
  });

  it('detects expiry on a write exactly as on a read', async () => {
    // A write silently landing on the sign-in page is worse than a read: the
    // student believes a reservation was made.
    fetchMock.mockResolvedValue(response({ url: 'https://alibaba.mendelu.cz/idp/' }));

    await expect(postIskam('/Rezervace/Create', new URLSearchParams())).rejects.toBeInstanceOf(
      IskamAuthError
    );
  });

  it('surfaces a failed write', async () => {
    fetchMock.mockResolvedValue(response({ ok: false, status: 400 }));

    await expect(postIskam('/Rezervace/Create', new URLSearchParams())).rejects.toThrow('400');
  });
});

describe('requestIskam', () => {
  it('requests the path verbatim, with cookies and no locale switch', async () => {
    await requestIskam('/Konta/PrevodyUhrady/0');

    expect(fetchMock).toHaveBeenCalledWith(`${ISKAM_BASE}/Konta/PrevodyUhrady/0`, {
      credentials: 'include',
    });
  });

  it('detects expiry by body as well as by url', async () => {
    fetchMock.mockResolvedValue(response({ body: 'alibaba.mendelu.cz/idp' }));

    await expect(requestIskam('/Konta')).rejects.toBeInstanceOf(IskamAuthError);
  });
});
