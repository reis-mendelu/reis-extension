/**
 * A subject's syllabus page in IS — the page both trees open from the
 * subject's title, and the syllabus tab links as its source.
 *
 * `lang` takes the app's own codes, which are IS's too; anything that is not
 * Czech gets the English page, so a stray BCP-47 'cs' cannot reach IS.
 */
export function syllabusUrl(courseId: string, language: string): string {
  const lang = language === 'cz' ? 'cz' : 'en';
  return `https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=${courseId};lang=${lang}`;
}
