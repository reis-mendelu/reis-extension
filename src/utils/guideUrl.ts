/**
 * The how-to guides on reisapp.cz, as Nápověda opens them: the index only.
 * The student picks a guide there, so the list is kept in one place, the site.
 *
 * `z=app` hides the site's store badges (the student already has reIS).
 * Nothing about the student rides along.
 *
 * `language` takes the app's own codes ('cz' | 'en'); anything that is not
 * Czech gets the English index, as in syllabusUrl.
 */
export function guidesIndexUrl(language: string): string {
  return language === 'cz'
    ? 'https://reisapp.cz/navody?z=app'
    : 'https://reisapp.cz/en/guides?z=app';
}
