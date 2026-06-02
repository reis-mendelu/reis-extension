import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unregisterExam } from '../exams';
import * as client from '../client';
import * as userParams from '../../utils/userParams';

vi.mock('../client');
vi.mock('../../utils/userParams');

function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
}

describe('unregisterExam verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userParams.getUserParams).mockResolvedValue({ studium: '111', obdobi: '222' } as Awaited<ReturnType<typeof userParams.getUserParams>>);
  });

  it('returns success when the unregister link for the term is gone afterward', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(
      '<a href="terminy_seznam.pl?termin=555;prihlasit_ihned=1">register</a>'
    ));
    const res = await unregisterExam('555');
    expect(res.success).toBe(true);
  });

  it('returns failure when the term is still shown as registered afterward', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(
      '<a href="terminy_seznam.pl?termin=555;odhlasit_ihned=1">unregister</a>'
    ));
    const res = await unregisterExam('555');
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('returns failure with error when studium params are missing', async () => {
    vi.mocked(userParams.getUserParams).mockResolvedValue(null as Awaited<ReturnType<typeof userParams.getUserParams>>);
    const res = await unregisterExam('555');
    expect(res.success).toBe(false);
  });

  it('returns success when only an UNRELATED exam remains registered', async () => {
    // Target term 555 is now a register link; a different term 999 is still registered.
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(
      '<a href="terminy_seznam.pl?termin=555;studium=111;prihlasit_ihned=1">register</a>' +
      '<a href="terminy_seznam.pl?termin=999;studium=111;odhlasit_ihned=1">unregister other</a>'
    ));
    const res = await unregisterExam('555');
    expect(res.success).toBe(true);
  });

  it('does not confuse a longer term id (5550) with the target (555)', async () => {
    vi.mocked(client.fetchWithAuth).mockResolvedValue(htmlResponse(
      '<a href="terminy_seznam.pl?termin=5550;studium=111;odhlasit_ihned=1">unregister 5550</a>'
    ));
    const res = await unregisterExam('555');
    expect(res.success).toBe(true);
  });

  it('returns failure when network fetch rejects', async () => {
    vi.mocked(client.fetchWithAuth).mockRejectedValue(new Error('network down'));
    const res = await unregisterExam('555');
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
