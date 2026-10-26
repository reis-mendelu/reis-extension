import { fetchWithAuth, BASE_URL } from './client';

export const SPOLUZACI_URL = `${BASE_URL}/auth/student/spoluzaci.pl`;

/** 40 rows a page: 60 pages is 2,400 students, past any MENDELU lecture. */
const MAX_PAGES = 60;
/** Pages fetched at once — a 519-student lecture is 13 pages. */
const CONCURRENCY = 4;

/**
 * Every page of one spoluzaci.pl list, in IS order, each fetched once.
 *
 * `query` is the list's own parameters without `lang`, e.g.
 * `predmet=X;;studium=Y;obdobi=Z` (the whole subject) or the same with
 * `;skupina=W` (one seminar group). Page N is the same URL with `on=N`.
 *
 * What a real capture of a 519-student lecture showed (fixtures
 * `spoluzaci-predmet.on*.cz.html`), and why this is a crawl and not "follow
 * the links on page one":
 *  - the page bar is printed twice, above and below the table;
 *  - the bar is windowed: page on=0 links by number only up to on=8, and the
 *    rest is reachable through the arrows, which have no text;
 *  - the language switch links carry `on=` too, with `lang=en`/`lang=sk`.
 * So a page is identified by its `on=` value, never by link text, and only
 * Czech links that stay on this list (same predmet, same skupina) count.
 */
export async function fetchClassmatesListingPages(query: string): Promise<Document[]> {
  const predmet = query.match(/predmet=(\d+)/)?.[1];
  const skupina = query.match(/skupina=(\d+)/)?.[1];
  const pages = new Map<number, Document>();
  const seen = new Set<number>([0]);
  let wave = [0];

  while (wave.length > 0) {
    const found: number[] = [];
    for (let i = 0; i < wave.length; i += CONCURRENCY) {
      const batch = wave.slice(i, i + CONCURRENCY);
      const docs = await Promise.all(batch.map((on) => fetchPage(query, on)));
      batch.forEach((on, j) => {
        const doc = docs[j]!;
        pages.set(on, doc);
        for (const next of pageNumbersLinkedFrom(doc, predmet, skupina)) {
          if (seen.has(next) || seen.size >= MAX_PAGES) continue;
          seen.add(next);
          found.push(next);
        }
      });
    }
    wave = found;
  }

  return [...pages.keys()].sort((a, b) => a - b).map((on) => pages.get(on)!);
}

async function fetchPage(query: string, on: number): Promise<Document> {
  const url = `${SPOLUZACI_URL}?${query}${on > 0 ? `;on=${on}` : ''};lang=cz`;
  const html = await (await fetchWithAuth(url)).text();
  return new DOMParser().parseFromString(html, 'text/html');
}

function pageNumbersLinkedFrom(
  doc: Document,
  predmet: string | undefined,
  skupina: string | undefined
): number[] {
  const out: number[] = [];
  for (const a of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="spoluzaci.pl"]'))) {
    const href = a.getAttribute('href') ?? '';
    const on = href.match(/[?;]on=(\d+)/)?.[1];
    if (!on || !href.includes('lang=cz')) continue;
    if (href.includes('vyucujici=') || href.includes('email=')) continue;
    if (href.match(/predmet=(\d+)/)?.[1] !== predmet) continue;
    if (href.match(/skupina=(\d+)/)?.[1] !== skupina) continue;
    out.push(Number(on));
  }
  return out;
}
