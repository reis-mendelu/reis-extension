import type { Language } from '../store/types';

/**
 * Which IS languages a fetch asks for.
 *
 * The sync passes the student's own language, so a Czech student never sends
 * `lang=en` (see fetchLanguageRequests.test.ts for what each fetcher does with
 * it). `'both'` is the dev scraper's: its snapshot stays dual so the dev
 * webapp can switch language with no IS behind it.
 */
export type FetchLanguage = Language | 'both';

export const asksCzech = (lang: FetchLanguage): boolean => lang !== 'en';
export const asksEnglish = (lang: FetchLanguage): boolean => lang !== 'cz';
