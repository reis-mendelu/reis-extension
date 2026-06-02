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
});
