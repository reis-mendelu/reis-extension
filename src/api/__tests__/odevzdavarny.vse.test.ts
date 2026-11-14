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

// A real InSIS VŠE odevzdavarny.pl page (trimmed, ids and people scrubbed).
// VŠE runs the same UIS as MENDELU, but every table has one more column,
// "Odkdy"/"Since", before "Dokdy"/"Until". One box, in the submitted table.
const fixture = (lang: 'cz' | 'en') =>
  readFileSync(join(__dirname, 'fixtures', 'odevzdavarny', `vse.${lang}.html`), 'utf-8');

const respond = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response;

function serve(cz: string, en: string) {
  vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
    respond(url.includes('lang=en') ? en : cz)
  );
}

const parse = (html: string, lang: 'cz' | 'en') =>
  parseOdevzdavarnyPage(new DOMParser().parseFromString(html, 'text/html'), lang);

describe('fetchOdevzdavarny — InSIS VŠE, with the extra "Odkdy" column', () => {
  beforeEach(() => {
    vi.mocked(fetchWithAuth).mockReset();
  });

  it('reads the submitted box with every field from the right column', async () => {
    serve(fixture('cz'), fixture('en'));
    const result = await fetchOdevzdavarny('100002', '9105');
    expect(result).not.toBeNull();
    const rows = result!.assignments;
    expect(rows).toHaveLength(1);
    expect(rows[0]!).toMatchObject({
      section: 'submitted',
      isOpen: true,
      courseId: '900001',
      courseCode: '5EN254',
      courseNameCs: 'Úvod do teorie her',
      courseNameEn: 'Introduction to Game Theory',
      name: 'Seminar paper',
      type: 'odevzdavarna-individualni',
      // Dokdy, not the Odkdy column before it (01.10.2026 08:00).
      deadline: '15.11.2026 22:00',
      odevzdavarnaId: '900002',
      fileCount: 1,
      instructions: 'Submit one PDF before the deadline. Include your name on the first page.',
    });
    // The "Body" cell is empty: no points, not zero.
    expect(rows[0]!.points).toBeUndefined();
    expect(rows[0]!.uploadUrl).toContain('odevzdavarny_odevzdani.pl');
    expect(rows[0]!.uploadUrl).toContain('odevzdavarna=900002');
    expect(result!.periods).toEqual(['9101', '9102', '9103', '9104', '9105']);
  });

  it('reads the English page by its English headers', () => {
    const rows = parse(fixture('en'), 'en');
    expect(rows).toHaveLength(1);
    expect(rows![0]!).toMatchObject({
      section: 'submitted',
      courseName: 'Introduction to Game Theory',
      name: 'Seminar paper',
      deadline: '15/11/2026 22:00',
      fileCount: 1,
    });
  });

  it('still answers null when a VŠE table has a column nobody knows', () => {
    const drifted = (html: string) =>
      html.replace(/(<th[^>]*>)(Vypsáno pro|Announced for)/, '<th>Nový sloupec</th>$1$2');
    expect(parse(drifted(fixture('cz')), 'cz')).toBeNull();
    expect(parse(drifted(fixture('en')), 'en')).toBeNull();
  });

  it('answers null when a needed column is missing, not a row read from the wrong cell', () => {
    const noFiles = fixture('cz').replace(/<th[^>]*>Počet souborů<\/th>/g, '<th>Odkdy</th>');
    expect(parse(noFiles, 'cz')).toBeNull();
  });
});
