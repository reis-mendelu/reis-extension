/**
 * registerExam had no tests while unregisterExam had a full suite — the
 * asymmetric direction was the untested one, and it is the direction that
 * CREATES an obligation for the student. A false "success" here is the worst
 * outcome in the app: reIS says you have a seat, the student stops looking, and
 * IS never registered them.
 *
 * IS signals nothing useful in the status code — a refusal is a 200 with prose
 * in the body — so registration is confirmed by reading the page back. These
 * tests pin that reading.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerExam } from '../exams';
import * as client from '../client';
import * as userParams from '../../utils/userParams';
import * as reportError from '../../utils/reportError';

vi.mock('../client');
vi.mock('../../utils/userParams');
vi.mock('../../utils/reportError');

function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
}

/** The page IS returns once the term really is registered: an unregister link. */
const registeredPage = (termId: string) =>
  `<a href="terminy_seznam.pl?termin=${termId};odhlasit_ihned=1">Odhlásit</a>`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userParams.getUserParams).mockResolvedValue({
    studium: '111',
    obdobi: '222',
  } as Awaited<ReturnType<typeof userParams.getUserParams>>);
});

describe('registerExam', () => {
  it('confirms success only when the term comes back registered', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(registeredPage('555')));

    await expect(registerExam('555')).resolves.toEqual({ success: true });
  });

  it('does not accept another term being registered as proof', async () => {
    // The exam list shows every term. Matching an unregister link anywhere on
    // the page would report success because some OTHER term is registered.
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(registeredPage('999')));

    const res = await registerExam('555');

    expect(res.success).toBe(false);
  });

  // REGRESSION: verifyRegistrationSuccess checked `termin=<id>` and
  // `odhlasit_ihned=1` INDEPENDENTLY. On a real exam list — which shows every
  // term for every subject — the first matched the register link for the term
  // that had just been refused, and the second matched a DIFFERENT exam the
  // student was already registered for. Registering for a full term therefore
  // reported success. Any student already holding one exam seat could be told
  // they had a second one they did not have.
  it("does not read another term's registration as this one succeeding", async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(
      htmlResponse(
        '<a href="terminy_seznam.pl?termin=555;prihlasit_ihned=1">Přihlásit</a>' +
          '<a href="terminy_seznam.pl?termin=999;odhlasit_ihned=1">Odhlásit</a>'
      )
    );

    const res = await registerExam('555');

    expect(res.success).toBe(false);
  });

  it('does not confuse a term id with a longer one that starts the same', async () => {
    // 555 vs 5550 — the same collision the unregister path already guards.
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(registeredPage('5550')));

    const res = await registerExam('555');

    expect(res.success).toBe(false);
  });

  it('reports a full term in words the student can act on', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse('<p>Termín je již plný</p>'));

    const res = await registerExam('555');

    expect(res).toEqual({ success: false, error: 'Termín je již plný.' });
  });

  it('reports a term that cannot be registered for', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(
      htmlResponse('<p>Na tento termín se nelze přihlásit</p>')
    );

    const res = await registerExam('555');

    expect(res.success).toBe(false);
    expect(res.error).toContain('nelze přihlásit');
  });

  it('refuses to claim success when the page says both registered and full', async () => {
    // A page carrying an error is not a confirmation even if an unregister link
    // is present — telling the student they have a seat they do not have is the
    // one outcome that must never happen.
    vi.mocked(client.fetchWithAuth).mockResolvedValue(
      htmlResponse(registeredPage('555') + '<p>Termín je již plný</p>')
    );

    const res = await registerExam('555');

    expect(res.success).toBe(false);
  });

  it('falls back to "check IS yourself" when the page is unrecognisable', async () => {
    // Honest uncertainty. IS changed something and we cannot tell — saying so is
    // better than guessing in either direction.
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse('<p>something new</p>'));

    const res = await registerExam('555');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Zkontrolujte v IS');
  });

  it('sends the registration intent, the term and the study context', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(registeredPage('555')));

    await registerExam('555');

    const url = vi.mocked(client.fetchWithAuth).mock.calls[0]![0] as string;
    expect(url).toContain('termin=555');
    expect(url).toContain('studium=111');
    expect(url).toContain('obdobi=222');
    // The flag that makes this a registration rather than a page view — and the
    // one that must never be the unregister flag.
    expect(url).toContain('prihlasit_ihned=1');
    expect(url).not.toContain('odhlasit_ihned=1');
  });

  it('refuses to try without study parameters', async () => {
    // Without studium the URL would address the wrong study, and IS would either
    // refuse or register the student on a term belonging to another programme.
    vi.mocked(userParams.getUserParams).mockResolvedValue(null);

    const res = await registerExam('555');

    expect(res.success).toBe(false);
    expect(client.fetchWithAuth).not.toHaveBeenCalled();
  });

  it('reports a network failure as a connection error, and logs it', async () => {
    vi.mocked(client.fetchWithAuth).mockRejectedValue(new Error('offline'));

    const res = await registerExam('555');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Chyba připojení');
    expect(reportError.logError).toHaveBeenCalledWith('Api.registerExam', expect.any(Error));
  });
});
