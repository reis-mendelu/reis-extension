import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));

import { fetchTermDetail } from '../termDetail';
import { fetchWithAuth } from '../client';

const REAL_FIXTURE = readFileSync(
  resolve(__dirname, 'fixtures/terminy-info-duration.html'),
  'utf8'
);

/**
 * One terminy_info.pl request, both facts the phone shows from it: the
 * teacher's Poznámka and "Délka trvání akce". They live on the same page, so
 * reading them in two requests would double the traffic to IS for nothing.
 */
describe('fetchTermDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the duration from the real detail page in one request', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(new Response(REAL_FIXTURE));
    const detail = await fetchTermDetail('343995', '1', '2');
    expect(detail.durationMinutes).toBe(10);
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchWithAuth).mock.calls[0]![0]).toContain('termin=343995');
  });

  it('throws on a page that is not a term detail (auth redirect)', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(new Response('<html><body>login</body></html>'));
    await expect(fetchTermDetail('1', '1', '2')).rejects.toThrow();
  });
});
