import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchDualLanguageStudyPlan, parseStudyPlanDOM } from '../studyPlan';
import * as client from '../client';
import { logError } from '../../utils/reportError';

vi.mock('../client', async (orig) => ({
  ...(await orig<typeof import('../client')>()),
  fetchWithAuth: vi.fn(),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

/**
 * A study plan whose headings the parser did not recognise parsed to
 * `blocks: []` and was stored over the student's plan. Subject rows offered and none read is now a failed
 * read (`null`); a page with no subject rows is still returned as it was.
 */
const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');

function serve(cz: string, en: string) {
  vi.mocked(client.fetchWithAuth).mockImplementation(
    async (url: string) =>
      new Response(url.includes('lang=en') ? en : cz, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
  );
}

const parse = (html: string, lang: 'cz' | 'en') =>
  parseStudyPlanDOM(new DOMParser().parseFromString(html, 'text/html'), lang);

const CZ = fixture('study-plan-by-periods.two-plans.cz.html');
const EN = fixture('study-plan-by-periods.two-plans.en.html');

// IS rewording every block heading: no semester or whole-plan block forms, so
// the parser drops all 63 subject rows without a word.
const reworded = (html: string) =>
  html
    .replace(/(\d+)\. semestr/g, '$1. období')
    .replace('Skupiny předmětů pro celý plán', 'Celý plán')
    .replace(/Volitelné předměty za celé období daného studia/g, 'Volitelné předměty');

const notUnderstoodLines = () =>
  vi
    .mocked(logError)
    .mock.calls.map(([, e]) => (e instanceof Error ? e.message.split('\n')[0]! : ''))
    .filter((m) => m.includes('not understood'));

describe('fetchDualLanguageStudyPlan on a page it does not understand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('still reads a real fixture into the same plan', async () => {
    serve(CZ, EN);

    const plan = await fetchDualLanguageStudyPlan('1');

    expect(plan!.cz).toEqual(parse(CZ, 'cz'));
    expect(plan!.en.blocks).toEqual(parse(EN, 'en').blocks);
    expect(notUnderstoodLines()).toEqual([]);
  });

  it('still reads the VŠE (InSIS) fixtures as data', async () => {
    serve(fixture('studijni-povinnosti.vse.cz.html'), fixture('studijni-povinnosti.vse.en.html'));

    const plan = await fetchDualLanguageStudyPlan('1');

    expect(plan!.cz.blocks.length).toBeGreaterThan(0);
    expect(plan!.en.blocks.length).toBeGreaterThan(0);
    expect(notUnderstoodLines()).toEqual([]);
  });

  it('R1: subject rows offered and none read is a failed read', async () => {
    expect(parse(reworded(CZ), 'cz').blocks).toEqual([]); // the premise
    serve(reworded(CZ), EN);

    await expect(fetchDualLanguageStudyPlan('1')).resolves.toBeNull();

    const [line] = notUnderstoodLines();
    expect(line).toMatch(/^study plan \(cz\) page not understood: rows=63 blocks=0\b/);
    expect(line).not.toMatch(/semestr|EBC|předmět/i);
  });

  it('R2: the login form is a failed read, not an empty plan', async () => {
    const login = '<html><body><input type="password" name="credential_1"></body></html>';
    serve(login, login);

    await expect(fetchDualLanguageStudyPlan('1')).resolves.toBeNull();
  });

  it('keeps a page with no subject rows as it was', async () => {
    // A trimmed page with zaměření but no plan table: no subject rows offered.
    const page = fixture('study-plan-zameranis.cz.html');
    serve(page, fixture('study-plan-zameranis.en.html'));

    const plan = await fetchDualLanguageStudyPlan('1');

    expect(plan!.cz).toEqual(parse(page, 'cz'));
    expect(notUnderstoodLines()).toEqual([]);
  });
});
