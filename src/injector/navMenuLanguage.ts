import { mergeDual, fetchNavMenuIn, type RawCategory } from './menuScraper';
import type { PageCategory } from '../data/pages/types';
import type { Language } from '../store/types';

/**
 * The IS nav menu, carrying the student's language and no request more.
 *
 * It is scraped off the page the extension runs on, in whatever language IS is
 * showing. That page's labels fill both fields until the student's language is
 * known to differ; only then is the menu fetched once more, in their language.
 * It used to fetch the other language on every page load regardless.
 */
let source: { categories: RawCategory[]; lang: Language } | null = null;
let fetchedLang: Language | null = null;
let menu: PageCategory[] | null = null;

export function getNavMenu(): PageCategory[] | null {
  return menu;
}

export function setScrapedNavMenu(scraped: { categories: RawCategory[]; lang: Language }): void {
  source = scraped;
  fetchedLang = null;
  menu = mergeDual(scraped.categories, scraped.lang, null);
}

/** Make the menu carry `lang`, fetching it only if the page was in the other one. */
export async function ensureNavMenuLanguage(
  lang: Language,
  send: (menu: PageCategory[]) => void
): Promise<void> {
  if (!source || source.lang === lang || fetchedLang === lang) return;
  const scraped = source;
  const labels = await fetchNavMenuIn(lang);
  if (!labels || source !== scraped) return;
  fetchedLang = lang;
  menu = mergeDual(scraped.categories, scraped.lang, labels);
  send(menu);
}
