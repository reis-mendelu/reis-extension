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

const html = (body: string) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });

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
   * while the English one succeeds yields sections with `nameEn` and no
   * `nameCs` — and `isGroupSignupSection` matches the Czech druh by design, so
   * seminar signup would slip through.
   *
   * The Czech half is worth one retry rather than a guess at IS's English
   * wording. A transient blip is the overwhelmingly likely cause, and a retry
   * turns the degraded case back into the normal one.
   */
  it('retries the Czech half and merges normally when the retry succeeds', async () => {
    let czCalls = 0;
    vi.mocked(client.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url.includes('lang=en')) return html(EN_ROW);
      czCalls++;
      if (czCalls === 1) throw new Error('IS had a moment');
      return html(CZ_ROW);
    });

    const merged = await fetchDualLanguageExams();
    expect(czCalls).toBe(2);
    const section = merged[0]!.sections[0]!;
    expect(section.nameCs).toBe('Zápis na cvičení');
    expect(section.nameEn).toBe('Registration for seminar');
  });

  /**
   * When even the retry fails we hand back the English data rather than
   * nothing. On a first load there is no cached Czech data to fall back on, so
   * discarding here would leave the student with no exams and no way to
   * register for a real one — a worse outcome than an unfiltered signup row
   * they can ignore. The gap is logged and accepted, not hidden.
   */
  it('returns the English data rather than nothing when the retry also fails', async () => {
    vi.mocked(client.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url.includes('lang=en')) return html(EN_ROW);
      throw new Error('IS is down');
    });

    const merged = await fetchDualLanguageExams();
    expect(merged).toHaveLength(1);
    expect(merged[0]!.sections[0]!.nameEn).toBe('Registration for seminar');
  });

  it('does not retry when both languages come back first time', async () => {
    let czCalls = 0;
    vi.mocked(client.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url.includes('lang=en')) return html(EN_ROW);
      czCalls++;
      return html(CZ_ROW);
    });

    const merged = await fetchDualLanguageExams();
    expect(czCalls).toBe(1);
    const section = merged[0]!.sections[0]!;
    expect(section.nameCs).toBe('Zápis na cvičení');
    expect(section.nameEn).toBe('Registration for seminar');
  });

  it('does not retry when the student genuinely has no terms in either language', async () => {
    let czCalls = 0;
    vi.mocked(client.fetchWithAuth).mockImplementation(async (url: string) => {
      if (!url.includes('lang=en')) czCalls++;
      return html('<table id="table_2"><tbody></tbody></table>');
    });

    await expect(fetchDualLanguageExams()).resolves.toEqual([]);
    expect(czCalls).toBe(1);
  });
});
