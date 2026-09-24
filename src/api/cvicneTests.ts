import { fetchWithAuth, BASE_URL } from './client';
import { logError } from '../utils/reportError';
import { asksCzech, asksEnglish, type FetchLanguage } from './fetchLanguage';
import { iconSysid } from './documents/iconSysid';

export interface CvicnyTest {
  courseId: string;
  courseNameCs: string;
  courseNameEn: string;
  name: string;
  url: string;
  status: 'accessible' | 'inaccessible';
}

interface RawTest {
  courseId: string;
  courseName: string;
  name: string;
  url: string;
  status: 'accessible' | 'inaccessible';
}

async function fetchLang(studium: string, lang: 'cz' | 'en'): Promise<RawTest[] | null> {
  try {
    const url = `${BASE_URL}/auth/elis/student/seznam_osnov.pl?studium=${studium};lang=${lang}`;
    // fetchWithAuth, not a bare fetch: IS denies CORS to every origin, so
    // this cannot reach it from the Capacitor app's own origin. Transport
    // only — the parser below is untouched (CLAUDE.md > Parser Rules).
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch seznam_osnov');

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const table = doc.getElementById('tmtab_1') ?? findOsnovyTable(doc);
    if (!table) return [];

    const rows = table.getElementsByTagName('tr');
    const tests: RawTest[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cols = row.getElementsByTagName('td');

      if (cols.length < 8) continue;

      // Sometimes the table has a "Poř." (Order) column at index 0, sometimes not.
      const offset = cols.length - 8;

      const courseLink = cols[offset + 0].getElementsByTagName('a')[0];
      const courseName = courseLink
        ? courseLink.textContent?.trim() || ''
        : cols[offset + 0].textContent?.trim() || '';

      const syllabusHref = courseLink?.getAttribute('href') || '';
      const predmetMatch = syllabusHref.match(/predmet=(\d+)/);
      const courseId = predmetMatch ? predmetMatch[1] : '';

      const osnovaName = cols[offset + 1].textContent?.trim() || '';

      // iconSysid reads both markups: IS now serves <span data-sysid> where it
      // served <img sysid>, and only the legacy one was read here.
      const statusSysId = iconSysid(cols[offset + 2]);
      const status: 'accessible' | 'inaccessible' =
        statusSysId === 'osnova-pristupna' ? 'accessible' : 'inaccessible';

      const linkElement = cols[offset + 7].getElementsByTagName('a')[0];
      let href = linkElement?.getAttribute('href') || '';

      if (href && !href.startsWith('http')) {
        href = `https://is.mendelu.cz${href.startsWith('/') ? '' : '/'}${href}`;
      }

      if (courseName && osnovaName && href) {
        tests.push({ courseId, courseName, name: osnovaName, url: href, status });
      }
    }

    return tests;
  } catch (error) {
    logError('Api.fetchCvicneTests', error);
    return null;
  }
}

/**
 * The e-osnovy table when IS gave it no id. IS attaches its table manager, and
 * with it `id="tmtab_1"`, only to a list of more than one osnova: with a single
 * one the table is a bare `<table>`, and requiring the id showed the student no
 * practice tests while IS listed one. Real sample: seznam_osnov.pl on
 * 2026-09-23, one osnova, in both locales (fixtures/seznam-osnov-single.*.html).
 *
 * Matched by the "Vstup" link (`osnova=`) in a cell of the table's own rows,
 * exactly where the real markup has it. The portal menu above links
 * seznam_osnov.pl too, but never with `osnova=`.
 */
function findOsnovyTable(doc: Document): Element | null {
  return (
    Array.from(doc.querySelectorAll('table')).find(
      (t) => !!t.querySelector(':scope > tbody > tr > td > a[href*="osnova="]')
    ) ?? null
  );
}

export interface CvicneTestsResult {
  tests: CvicnyTest[];
  lastFetched: number;
}

/** Practice tests in the languages `lang` asks for, merged like fetchOdevzdavarny. */
export async function fetchCvicneTests(
  studium: string,
  lang: FetchLanguage
): Promise<CvicneTestsResult | null> {
  const [czTests, enTests] = await Promise.all([
    asksCzech(lang) ? fetchLang(studium, 'cz') : undefined,
    asksEnglish(lang) ? fetchLang(studium, 'en') : undefined,
  ]);

  const base = asksCzech(lang) ? czTests : enTests;
  if (!base) return null;

  const merged: CvicnyTest[] = base.map((test, i) => ({
    courseId: test.courseId,
    courseNameCs: czTests?.[i]?.courseName ?? test.courseName,
    courseNameEn: enTests?.[i]?.courseName ?? test.courseName,
    name: test.name,
    url: test.url,
    status: test.status,
  }));

  return { tests: merged, lastFetched: Date.now() };
}
