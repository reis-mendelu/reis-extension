import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { fetchOdevzdavarny } from '../odevzdavarny';
import { fetchWithAuth } from '../client';
import { parseOdevzdavarnyPage } from '../../utils/parsers/odevzdavarnyParser';

// The "Pokyny" column: IS embeds the teacher's instructions in the icon's
// onclick, uis.box.open_fixed('n','<b>{box}:</b><p></p><p></p>{text}'), and
// draws no icon when there are none. Real pages, see odevzdavarny.parse.test.ts.
const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'odevzdavarny', name), 'utf-8');

const page = (name: string) => new DOMParser().parseFromString(fixture(name), 'text/html');

const respond = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response;

function serve(obdobi: string) {
  const cz = fixture(`obdobi-${obdobi}.cz.html`);
  const en = fixture(`obdobi-${obdobi}.en.html`);
  vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
    respond(url.includes('lang=en') ? en : cz)
  );
}

const OTII =
  'A document in MS Word or PDF format must be submitted by one team member at least three working days before the exam date.';

describe('odevzdávárny — Pokyny (teacher instructions)', () => {
  beforeEach(() => {
    vi.mocked(fetchWithAuth).mockReset();
  });

  it('reads the open table, as plain text without the repeated box name', () => {
    for (const lang of ['cz', 'en'] as const) {
      const rows = parseOdevzdavarnyPage(page(`obdobi-829.${lang}.html`), lang)!;
      const otii = rows.find((r) => r.courseCode === 'EBA-OTII')!;
      expect(otii.instructions).toBe(OTII);
    }
  });

  it('leaves a box without the icon without instructions', () => {
    const rows = parseOdevzdavarnyPage(page('obdobi-829.cz.html'), 'cz')!;
    const pj = rows.find((r) => r.courseCode === 'EBC-PJ')!;
    expect(pj).not.toHaveProperty('instructions');
  });

  it('reads the submitted table, keeping a link as text', () => {
    const rows = parseOdevzdavarnyPage(page('obdobi-812.cz.html'), 'cz')!;
    const box = rows.find((r) => r.name === 'Zadání projektu')!;
    expect(box.section).toBe('submitted');
    expect(box.instructions).toBe(
      'Odevzdejte dokument, který bude popisovat zamýšlenou aplikaci dle zadání na https://user.mendelu.cz/xturcin0/pyt/python_projekt.pdf.'
    );
  });

  it('reads the closed table: <br /> lines stay lines, a blank line stays one', () => {
    const rows = parseOdevzdavarnyPage(page('obdobi-812.cz.html'), 'cz')!;
    const box = rows.find((r) => r.name === 'Zkouška DSND 01. 06.')!;
    expect(box.section).toBe('closed');
    expect(box.instructions).toBe(
      [
        'Do odevzdávárny odevzdejte následující soubory:',
        '- obrázek logického modelu,',
        '- obrázek fyzického modelu,',
        '- příkazy pro vytvoření datové struktury,',
        '- řešení zbývajících příkladů.',
        '',
        'Při zpracování můžete používat externí zdroje. V takovém případě zdroj uveďte. Není možné používat nástroje umělé inteligence.',
      ].join('\n')
    );
  });

  it('reads past a parenthesis, and drops a heading whose name has &nbsp;', () => {
    const rows = parseOdevzdavarnyPage(page('obdobi-812.cz.html'), 'cz')!;
    const films = rows.find((r) => r.name.startsWith('Dobrovolná domácí úloha 7.'))!;
    expect(films.instructions).toMatch(
      /^Na adrese https:\/\/user\.mendelu\.cz\/xturcin0\/dsnd\/filmy\/ \(ve vnitřní síti/
    );
    expect(films.instructions).toContain('naleznete schéma pro databázi s filmy.');

    const tasks = rows.find((r) => r.name.startsWith('Zpracování úkolů'))!;
    expect(tasks.instructions).toMatch(/^Instrukce, k tomu, co přesně odevzdat/);
  });

  it('every box with the icon has instructions, every box without has none', () => {
    const html = fixture('obdobi-812.cz.html');
    const rows = parseOdevzdavarnyPage(page('obdobi-812.cz.html'), 'cz')!;
    const icons = html.split('data-sysid="prohlizeni-info"').length - 1;
    expect(rows.filter((r) => r.instructions).length).toBe(icons);
    for (const r of rows) {
      if (r.instructions) expect(r.instructions).not.toMatch(/<|&[a-z]+;|\\\//);
    }
  });

  it('carries the instructions onto the box', async () => {
    serve('829');
    const result = await fetchOdevzdavarny('100001', '829');
    const otii = result!.assignments.find((b) => b.courseCode === 'EBA-OTII')!;
    expect(otii.instructions).toBe(OTII);
    const pj = result!.assignments.find((b) => b.courseCode === 'EBC-PJ')!;
    expect(pj).not.toHaveProperty('instructions');
  });
});
