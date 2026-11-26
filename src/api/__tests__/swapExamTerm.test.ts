import { describe, it, expect, vi, beforeEach } from 'vitest';
import { swapExamTerm } from '../examSwap';
import * as client from '../client';
import * as userParams from '../../utils/userParams';

vi.mock('../client');
vi.mock('../../utils/userParams');

const html = (body: string) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });

// What IS answered when the swap form was pressed in a real browser
// (2026-11-25): a page headed "Odhlášení z termínu" ending in this sentence.
const DONE = '<div class="uis_msg"><div class="text">Operace byla úspěšně provedena.</div></div>';

describe('swapExamTerm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userParams.getUserParams).mockResolvedValue({
      studium: '111',
      obdobi: '222',
    } as Awaited<ReturnType<typeof userParams.getUserParams>>);
    vi.mocked(client.fetchWithAuth).mockResolvedValue(html(DONE));
  });

  // IS's own "Přihlásit na termín" form: it names the term being left in
  // `odhlas_termin`, and IS registers the new term and drops the old one as one
  // operation, so there is no moment with no seat.
  it('posts the same form IS shows: the new term, the term to leave, the submit button', async () => {
    await swapExamTerm('old-1', 'new-2');
    const [url, init] = vi.mocked(client.fetchWithAuth).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://is.mendelu.cz/auth/student/terminy_prihlaseni.pl');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({
      lang: 'cz',
      termin: 'new-2',
      studium: '111',
      obdobi: '222',
      odhlas_termin: 'old-1',
      odhlasit_prihlasit: 'Přihlásit na termín',
    });
  });

  it('reports success when IS says the operation went through', async () => {
    expect(await swapExamTerm('old-1', 'new-2')).toEqual({ success: true });
  });

  // The page is only a hint: the caller reads the list back for the truth.
  it('reports failure, with IS’s page unread, when the confirmation is missing', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(html('<p>Termín je již plný</p>'));
    const res = await swapExamTerm('old-1', 'new-2');
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('fails without a request when the study params are missing', async () => {
    vi.mocked(userParams.getUserParams).mockResolvedValue(
      null as Awaited<ReturnType<typeof userParams.getUserParams>>
    );
    expect((await swapExamTerm('old-1', 'new-2')).success).toBe(false);
    expect(client.fetchWithAuth).not.toHaveBeenCalled();
  });

  it('fails when the request rejects', async () => {
    vi.mocked(client.fetchWithAuth).mockRejectedValue(new Error('network down'));
    expect((await swapExamTerm('old-1', 'new-2')).success).toBe(false);
  });
});
