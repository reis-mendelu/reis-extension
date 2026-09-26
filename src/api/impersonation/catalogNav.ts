import { BASE_URL } from '../client';
import { txt } from './text';

/**
 * `/auth/`, not the public `/katalog/`: the same pages render for a guest with no
 * `logout.pl` in them, and the Capacitor transport reads HTML without it as an
 * expired session. The row structure is identical (verified 2026-09-26).
 */
export const CATALOG_URL = `${BASE_URL}/auth/katalog/plany.pl`;

/** Catalogue `fakulta=` ids by the timetable's Pracoviště short name (reis-scraper FACULTIES). */
export const FACULTY_IDS: Record<string, string> = {
  PEF: '2',
  AF: '14',
  FRRMS: '23',
  LDF: '38',
  ZF: '60',
};

/** typ_studia: 1 = bachelor, 4 = follow-up master (reis-scraper schema). */
export function typStudiaFor(shortCode: string): '1' | '4' | null {
  if (shortCode.startsWith('B-')) return '1';
  if (shortCode.startsWith('N-')) return '4';
  return null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The `poc_obdobi` of the row labelled exactly `label` ("ZS 2025/2026", not "… - CV"). */
export function findPeriodPoc(doc: Document, label: string): string | null {
  const re = new RegExp(`^${escape(label)}(?!\\s*-)`);
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const a = tr.querySelector('a[href*="poc_obdobi="]');
    if (!a || !re.test(txt(tr))) continue;
    const m = /poc_obdobi=(\d+)/.exec(a.getAttribute('href') ?? '');
    if (m?.[1]) return m[1];
  }
  return null;
}

/** IS separates parameters with `;` — `&` silently returns the faculty index. */
export function programmeUrl(
  fakulta: string,
  poc: string,
  typStudia: string,
  programId: string
): string {
  return `${CATALOG_URL}?fakulta=${fakulta};poc_obdobi=${poc};typ_ss=;typ_studia=${typStudia};program=${programId};misto_vyuky=;lang=cz`;
}

const absolute = (href: string): string =>
  href.startsWith('http')
    ? href
    : `${BASE_URL}${href.startsWith('/') ? '' : '/katalog/'}${href.replace(/^\.\//, '')}`;

/** The prezenční (`forma=1`) plan leaf; the `predmety_sz` link is the state-exam list. */
export function findLeafUrl(doc: Document): string | null {
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const href = a.getAttribute('href') ?? '';
    if (/forma=1;/.test(href) && /stud_plan=\d+/.test(href) && !href.includes('predmety_sz'))
      return absolute(href);
  }
  return null;
}
