import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fetchWithAuth = vi.fn();
vi.mock('../client', () => ({ BASE_URL: 'https://is.mendelu.cz', fetchWithAuth }));

const { fetchIsNotices } = await import('../isNotices');
const notices = readFileSync(join(__dirname, 'fixtures', 'zasadky-prod.cz.html'), 'utf-8');

beforeEach(() => fetchWithAuth.mockReset());

describe('fetchIsNotices', () => {
  it("reads the student's own home page in the asked language", async () => {
    const page = notices.replace(
      '</body>',
      '<a href="/auth/system/logout.pl?lang=cz">x</a></body>'
    );
    fetchWithAuth.mockResolvedValue(new Response(page));
    const list = await fetchIsNotices('en');
    expect(fetchWithAuth).toHaveBeenCalledWith('https://is.mendelu.cz/auth/index.pl?lang=en');
    expect(list.map((n) => n.key)).toEqual(['zasadka:157890']);
  });

  // A login page answered as 200 must not read as "no notices": the slice
  // keeps its last list when this throws.
  it('throws on a page that is not a signed-in home page', async () => {
    fetchWithAuth.mockResolvedValue(new Response('<html><form name="login"></form></html>'));
    await expect(fetchIsNotices('cz')).rejects.toThrow();
  });
});
