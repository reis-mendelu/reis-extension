import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { fetchCvicneTests } from '../cvicneTests';
import { fetchWithAuth } from '../client';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
const SINGLE_CZ = fixture('seznam-osnov-single.cz.html');
const SINGLE_EN = fixture('seznam-osnov-single.en.html');

const respond = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response;

/** Serve one body per language, the way fetchLang asks for them. */
function serve(cz: string, en: string) {
  vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
    respond(url.includes('lang=en') ? en : cz)
  );
}

/** The legacy markup: table manager id, ordinal column, `<img sysid>` icons. */
function legacyPage(status: string) {
  const row = `<tr>
      <td><small>1.</small></td>
      <td><a href="/auth/katalog/syllabus.pl?predmet=42">Course</a></td>
      <td>Osnova</td>
      <td><img sysid="${status}"></td>
      <td>A. Author</td><td>01.09.2026</td><td></td><td></td>
      <td><a href="/auth/elis/student/seznam_osnov.pl?studium=1;osnova=7;lang=cz"><img sysid="base-op"></a></td>
    </tr>`;
  return `<html><body><table id="tmtab_1"><thead><tr><th>x</th></tr></thead><tbody>${row}</tbody></table></body></html>`;
}

describe('fetchCvicneTests parsing', () => {
  beforeEach(() => vi.clearAllMocks());

  // IS attaches its table manager, and with it id="tmtab_1", only to a list of
  // more than one osnova. One osnova comes as a bare <table>, and requiring the
  // id showed the student no practice tests while IS listed one.
  it('reads the one osnova of a real single-row page without tmtab_1', async () => {
    const doc = new DOMParser().parseFromString(SINGLE_CZ, 'text/html');
    expect(doc.getElementById('tmtab_1')).toBeNull();
    serve(SINGLE_CZ, SINGLE_EN);

    const result = await fetchCvicneTests('1');

    expect(result?.tests).toHaveLength(1);
    expect(result?.tests).toMatchObject([
      {
        courseId: '164062',
        courseNameCs: 'Odborná terminologie v AJ: IS/ICT',
        courseNameEn: 'English Terminology: IS/ICT',
        name: 'Textbook',
        url: expect.stringContaining('osnova=10550') as unknown,
      },
    ]);
  });

  // IS now marks the state with <span data-sysid="osnova-pristupna">, not
  // <img sysid>. Read only the legacy attribute, an open osnova was inaccessible.
  it('reads an accessible osnova from the modern data-sysid icon', async () => {
    serve(SINGLE_CZ, SINGLE_EN);
    const result = await fetchCvicneTests('1');
    expect(result?.tests[0]?.status).toBe('accessible');
  });

  it.each([
    ['osnova-pristupna', 'accessible'],
    ['osnova-nepristupna', 'inaccessible'],
  ])('keeps the legacy tmtab_1 + <img sysid="%s"> markup reading as %s', async (sysid, want) => {
    serve(legacyPage(sysid), legacyPage(sysid));
    const result = await fetchCvicneTests('1');
    expect(result?.tests).toMatchObject([{ courseId: '42', name: 'Osnova', status: want }]);
  });
});
