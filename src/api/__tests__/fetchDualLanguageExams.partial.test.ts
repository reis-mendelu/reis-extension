import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDualLanguageExams } from '../exams';
import * as client from '../client';
import * as userParams from '../../utils/userParams';

vi.mock('../client');
vi.mock('../../utils/userParams');

const CZ_ROW = `
<table id="table_2"><thead><tr>
  <th>#</th><th>Op</th><th>Kód</th><th>Název</th><th>Datum</th><th>Místnost</th>
  <th>Druh</th><th>Vyučující</th><th>Kapacita</th>
</tr></thead><tbody><tr>
  <td>1</td><td></td><td>ALG</td><td>Algoritmizace</td><td>21.09.2026 11:00</td><td>P1014</td>
  <td>Zápis na cvičení</td><td>Ing. Novák</td><td>2/15</td>
  <td><a href="terminy_seznam.pl?termin=901;prihlasit_ihned=1">p</a></td>
</tr></tbody></table>`;

const EN_ROW = CZ_ROW.replace('Zápis na cvičení', 'Registration for seminar');

describe('a partial bilingual exam fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userParams.getUserParams).mockResolvedValue({
      studium: '111',
      obdobi: '222',
    } as Awaited<ReturnType<typeof userParams.getUserParams>>);
  });

  /**
   * `fetchExamData` swallows a failure into `[]`, so a Czech fetch that dies
   * while the English one succeeds used to produce an English-only dataset:
   * sections with `nameEn` and no `nameCs`. Seminar-group signup then slipped
   * past `isGroupSignupSection`, which matches the Czech druh, and the row and
   * its menu badge came back.
   *
   * Returning nothing is the honest answer — `setExams` already keeps the
   * currently-displayed exams when handed an empty list, so the student sees
   * the last good data rather than a silently all-English screen.
   */
  it('reports nothing rather than an English-only dataset', async () => {
    vi.mocked(client.fetchWithAuth).mockImplementation(async (url: string) =>
      url.includes('lang=en')
        ? new Response(EN_ROW, { status: 200, headers: { 'Content-Type': 'text/html' } })
        : Promise.reject(new Error('IS is having a moment'))
    );

    await expect(fetchDualLanguageExams()).resolves.toEqual([]);
  });

  it('still merges normally when both languages come back', async () => {
    vi.mocked(client.fetchWithAuth).mockImplementation(
      async (url: string) =>
        new Response(url.includes('lang=en') ? EN_ROW : CZ_ROW, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
    );

    const merged = await fetchDualLanguageExams();
    expect(merged).toHaveLength(1);
    const section = merged[0]!.sections[0]!;
    expect(section.nameCs).toBe('Zápis na cvičení');
    expect(section.nameEn).toBe('Registration for seminar');
  });
});
