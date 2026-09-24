import type { PageCategory, PageItem } from './types';

/**
 * Filtering the IS page directory, shared by both trees: the extension's
 * `IsPortalPopover` and the phone search sheet's "Starý IS" segment. It lived
 * inline in the popover until the phone needed the same answer.
 */

/** Lowercased, trimmed, diacritics stripped — "Přihlášky " and "prihlasky" match. */
export function normalizePageQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** The label a student reads in `language` — English only where one exists. */
export function pageLabel(entry: PageCategory | PageItem, language: string): string {
  return language === 'en' && entry.labelEn ? entry.labelEn : entry.label;
}

/**
 * The categories that match `query`.
 *
 * - An empty query returns `categories` itself, untouched.
 * - A category whose NAME matches is kept whole, every child included: typing
 *   "studium" should show all of Moje studium, not just the pages that
 *   happen to say "studium" too.
 * - Otherwise a category is kept with only its matching children, or dropped.
 */
export function filterPageCategories(
  categories: PageCategory[],
  query: string,
  language: string
): PageCategory[] {
  const needle = normalizePageQuery(query);
  if (!needle) return categories;

  const matches = (entry: PageCategory | PageItem) =>
    normalizePageQuery(pageLabel(entry, language)).includes(needle);

  return categories.flatMap((category) => {
    if (matches(category)) return [category];
    const children = category.children.filter(matches);
    return children.length > 0 ? [{ ...category, children }] : [];
  });
}
