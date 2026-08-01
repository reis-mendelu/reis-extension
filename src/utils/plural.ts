/** The i18n key suffixes a countable string needs. Czech uses all three;
 *  English only ever resolves to `One` or `Other`. */
export type PluralSuffix = 'One' | 'Few' | 'Other';

/**
 * Picks the plural form for `count` in the active UI language.
 *
 * `useTranslation`'s `t()` does straight `{param}` substitution with no plural
 * support, so a countable Czech string baked as one invariant form renders as
 * broken grammar for most values — "2 kreditů" instead of "2 kredity". Callers
 * declare `<key>One` / `<key>Few` / `<key>Other` in both locale files and index
 * into them with this.
 *
 * Categories come from `Intl.PluralRules`, so the 2-4 vs 5+ split is the
 * CLDR one rather than a hand-rolled range check.
 *
 * @param language `'cs'` / `'cz'` / `'en'` — the store's language value. Anything
 *                 unrecognised falls back to Czech, matching `useTranslation`.
 */
export function pluralSuffix(language: string, count: number): PluralSuffix {
  const locale = language === 'en' ? 'en' : 'cs';
  const category = new Intl.PluralRules(locale).select(count);
  if (category === 'one') return 'One';
  if (category === 'few') return 'Few';
  return 'Other';
}
