import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerExam } from '../exams';
import * as client from '../client';
import * as userParams from '../../utils/userParams';

vi.mock('../client');
vi.mock('../../utils/userParams');

function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
}

// The link shapes are the real ones (registeredTermsParser.test.ts): termin first,
// odhlasit_ihned / prihlasit_ihned later in the same href.
const registeredLink = (id: string) =>
  `<a href="terminy_seznam.pl?termin=${id};studium=111;obdobi=222;odhlasit_ihned=1;lang=cz">odhlásit</a>`;
const availableLink = (id: string) =>
  `<a href="terminy_seznam.pl?termin=${id};studium=111;obdobi=222;prihlasit_ihned=1;lang=cz">přihlásit</a>`;

describe('registerExam verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userParams.getUserParams).mockResolvedValue({
      studium: '111',
      obdobi: '222',
    } as Awaited<ReturnType<typeof userParams.getUserParams>>);
  });

  it('succeeds when this term now carries the unregister link', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(registeredLink('555')));
    expect((await registerExam('555')).success).toBe(true);
  });

  // The switch rolls back by re-registering the OLD term. After a failed
  // rollback that term sits in the available table with a register link, and
  // any OTHER registered exam supplies an odhlasit_ihned=1 elsewhere on the
  // page. Two bare includes() read that as "registered again" and the student
  // is told their seat was restored while they are on no term at all.
  it('does not count another exam’s unregister link as this term being registered', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(
      htmlResponse(availableLink('555') + registeredLink('999'))
    );
    const res = await registerExam('555');
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('does not confuse a longer term id (5550) with the target (555)', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(registeredLink('5550')));
    expect((await registerExam('555')).success).toBe(false);
  });

  // Success is the student's own row flipping to registered; a stray "Chyba"
  // elsewhere on the page (help text, a subject name) cannot undo that.
  it('still succeeds when the page mentions "Chyba" elsewhere', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(
      htmlResponse(registeredLink('555') + '<p>Chyba? Napište nám.</p>')
    );
    expect((await registerExam('555')).success).toBe(true);
  });

  it('reports a full term with IS’s reason', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(
      htmlResponse(availableLink('555') + '<p>Termín je již plný</p>')
    );
    const res = await registerExam('555');
    expect(res).toEqual({ success: false, error: 'Termín je již plný.' });
  });

  it('fails when the page is IS’s login form', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(
      htmlResponse('<form name="login"><input type="password" name="heslo"></form>')
    );
    expect((await registerExam('555')).success).toBe(false);
  });
});
