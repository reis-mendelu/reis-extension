import { fetchWithAuth, BASE_URL } from '../client';
import type { Person, Subject } from './types';
import { parseMendeluResults, parseGlobalPeopleResults } from './peopleParser';
import { parseMendeluProfileResult } from './peopleParserProfile';
import { parseSubjectResults } from './subjectParser';

const BASE_LIDE_URL = `${BASE_URL}/auth/lide/`;
const HLEDANI_URL = `${BASE_URL}/auth/hledani/index.pl`;
const LIDE_INDEX_URL = `${BASE_URL}/auth/lide/index.pl`;

/**
 * Every POST here is form-urlencoded, and NONE of them sets its own
 * Content-Type. That is deliberate, not an omission: both transports already
 * supply it — DEFAULT_HEADERS on the extension, capacitorTransport's POST-only
 * default on native — and passing a capitalised `Content-Type` into
 * fetchWithAuth does not overwrite DEFAULT_HEADERS' lowercase one. Both keys
 * survive the object spread and `Headers` APPENDS, so IS would receive the
 * value twice, parse no body, and still answer 200. That defect is live in
 * outlookSync.ts:73; do not reintroduce it here.
 */
const FORM_POST = { method: 'POST' } as const;

/** Max records the catalog search returns per area. Higher = fewer truncated subject lists. */
export const SUBJECT_RESULT_CAP = 100;

/** Single POST to the IS catalog search (`hledani`) for the given areas, returning raw HTML. */
async function postHledani(
  query: string,
  lang: 'cz' | 'en',
  oblasti: string[],
  subjekt?: string
): Promise<string> {
  const formData = new URLSearchParams();
  formData.append('lang', lang);
  formData.append('vzorek', query);
  formData.append('vyhledat', 'Vyhledat');
  for (const o of oblasti) formData.append('oblasti', o);
  formData.append('pocet', String(SUBJECT_RESULT_CAP));
  if (subjekt) formData.append('subjekt', subjekt);

  const response = await fetchWithAuth(HLEDANI_URL, { ...FORM_POST, body: formData.toString() });
  return await response.text();
}

/**
 * Fetch a single person profile directly by their IS student ID.
 * More reliable than searchPeople() for known IDs (no ambiguous name results).
 */
export async function fetchPersonProfile(studentId: string): Promise<Person | null> {
  try {
    const url = `${BASE_LIDE_URL}clovek.pl?id=${studentId};lang=cz`;
    const response = await fetchWithAuth(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const results = parseMendeluProfileResult(doc, BASE_LIDE_URL);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

export async function searchPeople(personName: string): Promise<Person[]> {
  const formData = new URLSearchParams();
  formData.append('vzorek', personName);
  formData.append('cokoliv', '0');
  formData.append('lide', '1');
  formData.append('pocet', '1000');

  try {
    const response = await fetchWithAuth(LIDE_INDEX_URL, {
      ...FORM_POST,
      body: formData.toString(),
    });

    const html = await response.text();
    return parseMendeluResults(html);
  } catch {
    return [];
  }
}

export async function searchSubjects(query: string): Promise<Subject[]> {
  const formData = new URLSearchParams();
  formData.append('lang', 'cz');
  formData.append('vzorek', query);
  formData.append('vyhledat', 'Vyhledat');
  formData.append('oblasti', 'predmety');
  formData.append('pocet', '20');

  try {
    const response = await fetchWithAuth(HLEDANI_URL, {
      ...FORM_POST,
      body: formData.toString(),
    });
    return parseSubjectResults(await response.text());
  } catch {
    return [];
  }
}

/** Like searchSubjects but with a configurable result cap, for the catalog browser. */
export async function searchSubjectsCatalog(query: string, limit = 50): Promise<Subject[]> {
  const formData = new URLSearchParams();
  formData.append('lang', 'cz');
  formData.append('vzorek', query);
  formData.append('vyhledat', 'Vyhledat');
  formData.append('oblasti', 'predmety');
  formData.append('pocet', String(limit));

  try {
    const response = await fetchWithAuth(HLEDANI_URL, {
      ...FORM_POST,
      body: formData.toString(),
    });
    return parseSubjectResults(await response.text());
  } catch {
    return [];
  }
}

/**
 * Global catalog search for people + subjects.
 *
 * - `lang` selects the language of subject names ('cz' | 'en').
 * - `subjekt` (an IS workplace id) restricts SUBJECT results to one faculty. People are
 *   always searched university-wide, so faculty scoping never hides a person — when a
 *   faculty is given the two areas are fetched as separate parallel requests.
 */
export async function searchGlobal(
  query: string,
  lang: 'cz' | 'en' = 'cz',
  subjekt?: string
): Promise<{ people: Person[]; subjects: Subject[]; subjectsTruncated: boolean }> {
  try {
    if (!subjekt) {
      const html = await postHledani(query, lang, ['lide', 'predmety']);
      const subjects = parseSubjectResults(html);
      return {
        people: parseGlobalPeopleResults(html),
        subjects,
        subjectsTruncated: subjects.length >= SUBJECT_RESULT_CAP,
      };
    }

    const [peopleHtml, subjectHtml] = await Promise.all([
      postHledani(query, lang, ['lide']),
      postHledani(query, lang, ['predmety'], subjekt),
    ]);
    const subjects = parseSubjectResults(subjectHtml);
    return {
      people: parseGlobalPeopleResults(peopleHtml),
      subjects,
      subjectsTruncated: subjects.length >= SUBJECT_RESULT_CAP,
    };
  } catch {
    const people = await searchPeople(query);
    return { people, subjects: [], subjectsTruncated: false };
  }
}
