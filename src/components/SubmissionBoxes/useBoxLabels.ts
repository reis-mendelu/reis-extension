import { useTranslation } from '../../hooks/useTranslation';
import { pluralSuffix } from '../../utils/plural';

const DAY_MS = 86_400_000;

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Whole calendar days from `now` to `deadline`; 0 = today. */
export function daysUntil(deadline: Date, now: number): number {
  return Math.round((startOfDay(deadline.getTime()) - startOfDay(now)) / DAY_MS);
}

/** The strings every submission-box view shares, in the active language. */
export function useBoxLabels() {
  const { t, language } = useTranslation();
  const locale = language === 'cz' ? 'cs' : 'en';
  const hhmm = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return {
    t,
    language,
    files: (n: number) => t(`odevzdavarny.files${pluralSuffix(language, n)}`, { n }),
    openCount: (n: number) => t(`odevzdavarny.open${pluralSuffix(language, n)}`, { n }),
    /** "do ne 8. 11. 23:59" */
    until: (d: Date) =>
      t('odevzdavarny.until', {
        date: `${d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' })} ${hhmm(d)}`,
      }),
    /** "26. 4." */
    shortDate: (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' }),
    /** "Dnes" / "Zítra" / "za 5 d" */
    relative: (d: Date, now: number) => {
      const days = daysUntil(d, now);
      if (days <= 0) return t('deadlines.today');
      if (days === 1) return t('deadlines.tomorrow');
      return t('deadlines.inDays', { n: days });
    },
    courseName: (b: { courseNameCs: string; courseNameEn: string }) =>
      language === 'en' ? b.courseNameEn || b.courseNameCs : b.courseNameCs,
  };
}
