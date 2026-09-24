import { BASE_URL, fetchWithAuth } from './client';
import { logError } from '../utils/reportError';
import { isTermDetailPage, parseTermNotePage, type TermNote } from './terminyInfo';
import { parseTermDurationPage } from './termDuration';

export interface TermDetail {
  note: TermNote | null;
  /** "Délka trvání akce"; null when IS left it empty or it did not parse. */
  durationMinutes: number | null;
}

/**
 * The teacher's Poznámka and the exam length from ONE terminy_info.pl request.
 *
 * Both facts live on the same detail page. The phone shows the length of any
 * term a student opens, not only the registered ones `examDurations` enriches
 * at sync — and fetching the page twice, once per fact, would double the load
 * on IS for nothing. Reuses the two existing parsers unchanged.
 *
 * Throws when the page is not a real detail page (session expired → login
 * redirect), so the caller never caches a miss as "no note, no length".
 */
export async function fetchTermDetail(
  terminId: string,
  studiumId: string,
  obdobiId: string,
  lang: 'cz' | 'en' = 'cz'
): Promise<TermDetail> {
  const url = `${BASE_URL}/auth/student/terminy_info.pl?termin=${terminId};studium=${studiumId};obdobi=${obdobiId};lang=${lang}`;
  try {
    const res = await fetchWithAuth(url);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    if (!isTermDetailPage(doc)) {
      throw new Error('terminy_info.pl did not return a detail page (likely auth redirect)');
    }
    return { note: parseTermNotePage(doc), durationMinutes: parseTermDurationPage(doc) };
  } catch (e) {
    logError('Api.fetchTermDetail', e, { terminId });
    throw e;
  }
}
