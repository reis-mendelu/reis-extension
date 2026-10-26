import type { Language } from '../store/types';

const PROFILE_BASE = 'https://is.mendelu.cz/auth/lide/clovek.pl';

/**
 * A person's own page in IS (`clovek.pl`), for a student to open — the
 * extension's hover card and the phone's person sheet both link here.
 *
 * Not for fetching: the scrapers in `api/personProfile.ts` and
 * `api/search/searchService.ts` build their own URLs, because the `lang=` they
 * send decides which HTML their parsers read.
 *
 * `language` passes straight through: the app's `'cz' | 'en'` is the same
 * vocabulary IS's `lang=` takes.
 */
export function isPersonProfileUrl(personId: string | number, language: Language): string {
  return `${PROFILE_BASE}?id=${personId};lang=${language}`;
}
