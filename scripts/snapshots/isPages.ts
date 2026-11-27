/**
 * The IS pages a snapshot reads: a fixed list, GET only, never a link found
 * on a page. IS has plain links that act (logout.pl, the home page's
 * "jiz_nezobrazovat_zasadku" that hides a notice for good), so following
 * links is not safe.
 *
 * Built on the parser dump's list (scripts/lib/isHtmlPages.ts) minus what is
 * not the student's own record: classmates and exam sign-up lists (other
 * students' names) and the catalogue.
 */
import { firstPages, type Page, type StudyIds } from '../lib/isHtmlPages';

const KEEP = new Set([
  'index',
  'vyveska',
  'studium',
  'moje-studium',
  'clovek',
  'study-plan',
  'exam-terms',
  'odevzdavarny',
  'list',
  'list-periods',
  'pruchod-stat',
  'pruchod-percentil',
  'pruchod-podrobne',
  'prehled-tydnu',
  'seznam-osnov',
  'strom-od',
]);

export function isFirstPages(base: string, ids: StudyIds): Page[] {
  return firstPages(base, ids).filter(([name]) => KEEP.has(name));
}

/** Every current subject's folder and záznamník, read off list.pl. */
export function isSubjectPages(base: string, ids: StudyIds, listHtml: string): Page[] {
  const pages: Page[] = [];
  const folders = new Set(
    [...listHtml.matchAll(/slozka\.pl\?(?:ds=1;)?id=(\d+)/g)].map((m) => m[1])
  );
  folders.forEach((id) =>
    pages.push([`slozka-${id}`, `${base}/auth/dok_server/slozka.pl?id=${id}`])
  );
  const list = `${base}/auth/student/list.pl?studium=${ids.studium};obdobi=${ids.obdobi}`;
  const seen = new Set<string>();
  for (const m of listHtml.matchAll(/predmet=(\d+);[^"']*?(prubezne|test)=1/g)) {
    const [, predmet, kind] = m;
    const name = `zaznamnik-${predmet}-${kind}`;
    if (seen.has(name)) continue;
    seen.add(name);
    pages.push([name, `${list};predmet=${predmet};${kind}=1`]);
  }
  return pages;
}

/** Whether a page name from a saved dump belongs in a snapshot (offline runs). */
export function isKept(name: string): boolean {
  return KEEP.has(name) || /^(slozka|zaznamnik)-\d/.test(name);
}
