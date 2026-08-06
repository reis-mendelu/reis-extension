import { fetchWithAuth } from '../client';
import type { Person, Subject } from './types';
import { parseMendeluResults, parseGlobalPeopleResults } from './peopleParser';
import { parseMendeluProfileResult } from './peopleParserProfile';
import { parseSubjectResults } from './subjectParser';

const BASE_LIDE_URL = 'https://is.mendelu.cz/auth/lide/';
const HLEDANI_URL = 'https://is.mendelu.cz/auth/hledani/index.pl';

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

  // No `Content-Type` and no `credentials` here: fetchWithAuth's DEFAULT_HEADERS
  // already sends the form-urlencoded content-type in lowercase, and passing one
  // too would survive the spread as a second key that `Headers` APPENDS — IS then
  // parses no body and returns an ok-looking page with zero results.
  const response = await fetchWithAuth(HLEDANI_URL, {
    method: 'POST',
    body: formData.toString(),
  });
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
    // See postHledani on why no Content-Type is passed.
    const response = await fetchWithAuth('https://is.mendelu.cz/auth/lide/index.pl', {
      method: 'POST',
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
    // See postHledani on why no Content-Type is passed.
    const response = await fetchWithAuth('https://is.mendelu.cz/auth/hledani/index.pl', {
      method: 'POST',
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
    // See postHledani on why no Content-Type is passed.
    const response = await fetchWithAuth('https://is.mendelu.cz/auth/hledani/index.pl', {
      method: 'POST',
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
