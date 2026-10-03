import { fetchWithAuth, BASE_URL } from './client';
import { logError } from '../utils/reportError';
import { fetchClassmatesListingPages, SPOLUZACI_URL } from './classmatesListing';
import type { Classmate } from '../types/classmates';

/**
 * Parse one page of the #tmtab_1 classmates table.
 *
 * Mirrors the battle-tested logic from reis-scraper/scripts/debug-classmates.ts:
 *  - Find rows with a non-empty clovek.pl link to get personId + name
 *  - Photo from img[src*="foto.pl"]
 *  - Message URL from a[href*="nova_zprava.pl"]
 *  - Study info from a td whose text looks like a study programme label
 *
 * Guard: if the table exists with multiple rows but zero classmates are parsed,
 * that's a signal IS Mendelu changed the row structure — report it via telemetry
 * so we can debug from data instead of intuition. Per CLAUDE.md parser rules,
 * we do NOT relax the parser; we report and return [].
 */
export function parseClassmatesPage(doc: Document): Classmate[] {
  const table = doc.querySelector('#tmtab_1');
  if (!table) return [];

  const results: Classmate[] = [];
  const rows = table.querySelectorAll('tr');

  rows.forEach((row, i) => {
    if (i === 0) return; // skip header

    // Each row has two clovek.pl links: [0] wraps the photo (empty text), [1] is the name
    const profileLinks = Array.from(
      row.querySelectorAll<HTMLAnchorElement>('a[href*="clovek.pl"]')
    );
    const nameLink = profileLinks.find((a) => (a.textContent?.trim() ?? '').length > 0) ?? null;
    if (!nameLink) return;

    const idMatch = nameLink.getAttribute('href')?.match(/id=(\d+)/);
    if (!idMatch) return;

    const personId = parseInt(idMatch[1], 10);
    const name = nameLink.textContent!.trim();

    const photoUrl = `${BASE_URL}/auth/lide/foto.pl?id=${personId};lang=cz`;

    const msgLink = row.querySelector<HTMLAnchorElement>('a[href*="nova_zprava.pl"]');
    const messageUrl = msgLink?.getAttribute('href') ?? undefined;

    // Study info: find a td whose text matches a study programme pattern
    // e.g. "PEF B-OI-ZBOI prez [sem 2, roč 1]"
    const studyInfo =
      Array.from(row.querySelectorAll('td'))
        .map((td) => td.textContent?.trim() ?? '')
        .find((t) => /[A-Z]{2,}.*(?:prez|komb|\[sem|\[roč|B-|N-|D-)/.test(t)) ?? '';

    results.push({ personId, name, photoUrl, studyInfo, messageUrl });
  });

  // Guard: table present with content rows, but parser extracted nothing.
  // Distinguishes "empty seminar" (no rows) from "parser broken" (rows present,
  // none parsed). Reports once per call; does not throw.
  if (results.length === 0 && rows.length > 1) {
    const hasContent = Array.from(rows)
      .slice(1)
      .some((r) => (r.textContent?.trim().length ?? 0) > 0);
    if (hasContent) {
      logError(
        'Parser.parseClassmatesPage',
        new Error('table#tmtab_1 has rows but zero classmates parsed'),
        { rowCount: rows.length }
      );
    }
  }

  return results;
}

/**
 * Map of predmetId → skupinaId from the spoluzaci overview page.
 * Memoized per (studiumId,obdobi) with a 60s TTL plus inflight dedup so
 * refreshing N subjects in a row doesn't re-fetch the same global page N times.
 */
interface GroupMapEntry {
  expiresAt: number;
  promise: Promise<Record<string, string>>;
}
const groupMapCache = new Map<string, GroupMapEntry>();
const GROUP_MAP_TTL_MS = 60_000;

export function __resetSeminarGroupCache(): void {
  groupMapCache.clear();
}

export async function fetchSeminarGroupIds(
  studiumId: string,
  obdobi: string
): Promise<Record<string, string>> {
  const cacheKey = `${studiumId}|${obdobi}`;
  const existing = groupMapCache.get(cacheKey);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.promise;
  }

  const promise = fetchSeminarGroupIdsImpl(studiumId, obdobi).catch((e) => {
    groupMapCache.delete(cacheKey);
    throw e;
  });
  groupMapCache.set(cacheKey, { expiresAt: Date.now() + GROUP_MAP_TTL_MS, promise });
  return promise;
}

async function fetchSeminarGroupIdsImpl(
  studiumId: string,
  obdobi: string
): Promise<Record<string, string>> {
  const url = `${SPOLUZACI_URL}?studium=${studiumId};obdobi=${obdobi};lang=cz`;
  try {
    const response = await fetchWithAuth(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const result: Record<string, string> = {};

    // Links look like: spoluzaci.pl?predmet=162570;;studium=...;skupina=178894;lang=cz
    // We only want links that have both predmet= and skupina= (seminar group links).
    const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="skupina="]'));

    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      // Skip teacher and email views
      if (href.includes('vyucujici=') || href.includes('email=')) continue;

      const skupinaMatch = href.match(/skupina=(\d+)/);
      const predmetMatch = href.match(/predmet=(\d+)/);
      if (!skupinaMatch || !predmetMatch) continue;

      const predmetId = predmetMatch[1];
      const skupinaId = skupinaMatch[1];

      // Only keep the first skupina found per predmet (the student's seminar group)
      if (!result[predmetId]) {
        result[predmetId] = skupinaId;
      }
    }

    return result;
  } catch (e) {
    logError('Api.fetchSeminarGroupIds', e, { studiumId, obdobi });
    throw e;
  }
}

/** Every person in a list once, in IS order. */
function rosterFrom(pages: Document[]): Classmate[] {
  const byId = new Map<number, Classmate>();
  for (const c of pages.flatMap(parseClassmatesPage)) {
    if (!byId.has(c.personId)) byId.set(c.personId, c);
  }
  return [...byId.values()];
}

/**
 * Everyone in the student's seminar group, every page.
 *
 *   /auth/student/spoluzaci.pl?predmet=X;;studium=Y;obdobi=Z;skupina=W;lang=cz
 *
 * The double ;; after predmet is intentional — it matches what IS generates
 * in its own anchor hrefs and is required for legacy compatibility.
 */
export async function fetchClassmates(
  predmetId: string,
  studiumId: string,
  obdobi: string,
  skupinaId: string
): Promise<Classmate[]> {
  const query = `predmet=${predmetId};;studium=${studiumId};obdobi=${obdobi};skupina=${skupinaId}`;
  try {
    return rosterFrom(await fetchClassmatesListingPages(query));
  } catch (e) {
    logError('Api.fetchClassmates', e, { predmetId, skupinaId });
    throw e;
  }
}

/**
 * Everyone taking the subject this semester, lectures included — the list IS
 * links from Moji spolužáci as the subject's own row (no skupina). Hundreds of
 * students at 40 a page, so it is fetched only when the student asks for it.
 */
export async function fetchSubjectClassmates(
  predmetId: string,
  studiumId: string,
  obdobi: string
): Promise<Classmate[]> {
  try {
    return rosterFrom(
      await fetchClassmatesListingPages(
        `predmet=${predmetId};;studium=${studiumId};obdobi=${obdobi}`
      )
    );
  } catch (e) {
    logError('Api.fetchSubjectClassmates', e, { predmetId });
    throw e;
  }
}
