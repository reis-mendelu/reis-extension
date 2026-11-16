/**
 * The how-to guides on reisapp.cz, as the app links to them.
 *
 * `z=app` hides the site's install buttons (the student already has reIS) and
 * `utm_source=reis-app` tells the site's own analytics where the visit came
 * from. Nothing about the student rides along — no id, faculty or screen.
 * The hash names a section, which the page opens.
 *
 * `language` takes the app's own codes ('cz' | 'en'); anything that is not
 * Czech gets the English guide, as in syllabusUrl.
 */
export type Guide = 'index' | 'eduroam' | 'exams' | 'subjects' | 'isic' | 'map' | 'dorms';
export type GuideSection = 'troubleshoot' | 'official';

type Lang = 'cz' | 'en';

const PATHS: Record<Lang, Record<Guide, string>> = {
  cz: {
    index: 'navody',
    eduroam: 'navody/eduroam',
    exams: 'navody/prihlaseni-na-zkousku',
    subjects: 'navody/predmety',
    isic: 'navody/dobiti-isic',
    map: 'navody/mapa-kampusu',
    dorms: 'navody/koleje',
  },
  en: {
    index: 'en/guides',
    eduroam: 'en/guides/eduroam',
    exams: 'en/guides/exam-registration',
    subjects: 'en/guides/subjects',
    isic: 'en/guides/isic-top-up',
    map: 'en/guides/campus-map',
    dorms: 'en/guides/dorms',
  },
};

/** The site's own section ids. A guide without one gets no hash. */
const TROUBLESHOOT: Record<Lang, Partial<Record<Guide, string>>> = {
  cz: { eduroam: 'nefunguje', isic: 'nefunguje', exams: 'nejde', subjects: 'nejde' },
  en: {
    eduroam: 'not-working',
    isic: 'not-working',
    exams: 'cant-register',
    subjects: 'no-files',
  },
};
const OFFICIAL: Record<Lang, string> = { cz: 'oficialne', en: 'official' };

export function guideUrl(guide: Guide, language: string, section?: GuideSection): string {
  const lang: Lang = language === 'cz' ? 'cz' : 'en';
  const id =
    section === 'troubleshoot'
      ? TROUBLESHOOT[lang][guide]
      : section === 'official' && guide !== 'index'
        ? OFFICIAL[lang]
        : undefined;
  return `https://reisapp.cz/${PATHS[lang][guide]}?z=app&utm_source=reis-app${id ? `#${id}` : ''}`;
}
