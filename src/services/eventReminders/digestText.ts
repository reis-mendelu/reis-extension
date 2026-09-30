import type { MapEvent } from '../../types/events';
import type { Language } from '../../store/types';
import type { DigestLabels } from './plan';
import { translate } from '../../i18n/translate';
import { pluralSuffix } from '../../utils/plural';

/**
 * The digest strings in one language. Each count-bearing key has `One` /
 * `Few` / `Other` variants, picked by `utils/plural.ts` like every other count
 * in the app (CLDR: 1 / 2–4 / everything else, so "22 akcí").
 *
 * `leadLabel` is the RSVP ping's body prefix and must stay byte-identical:
 * those pings are already pending on devices, and a changed text would make
 * every one of them reschedule.
 */
export function digestLabels(lang: Language): DigestLabels {
  const tr = (k: string, p?: Record<string, string | number>) => translate(lang, k, p);
  return {
    tomorrow: (titles) => tr('notify.digestTomorrow', { titles }),
    tomorrowMany: (n, titles) =>
      tr(`notify.digestTomorrowMany${pluralSuffix(lang, n)}`, { n, titles }),
    newOnly: (n, titles) => tr(`notify.digestNewOnly${pluralSuffix(lang, n)}`, { titles }),
    plusNew: (n, societies) => tr(`notify.digestPlusNew${pluralSuffix(lang, n)}`, { n, societies }),
    leadLabel: tr('map.reminderLead'),
  };
}

/**
 * The title and body for one evening digest, given tomorrow's events and the
 * ones that were published since the previous digest.
 *
 * Returns null for an empty digest — `planNotifications` uses that to skip
 * the day entirely rather than schedule a notification with nothing to say.
 *
 * The body always names the "new" count when there are new events, even when
 * the title itself is already the new-only headline: the title is what's
 * skimmed off a lock screen, the body is the one extra number a student
 * checks before opening the app.
 */
export function digestText(
  tomorrow: MapEvent[],
  fresh: MapEvent[],
  shortName: (societyId: string) => string,
  labels: DigestLabels
): { title: string; body: string } | null {
  if (tomorrow.length === 0 && fresh.length === 0) return null;
  const societies = (es: MapEvent[]) =>
    [...new Set(es.map((e) => shortName(e.societyId)))].join(', ');
  const first2 = (es: MapEvent[]) =>
    es
      .slice(0, 2)
      .map((e) => e.title)
      .join(', ');
  const title =
    tomorrow.length === 0
      ? labels.newOnly(fresh.length, `${first2(fresh)} (${societies(fresh)})`)
      : tomorrow.length <= 2
        ? labels.tomorrow(`${first2(tomorrow)} (${societies(tomorrow)})`)
        : labels.tomorrowMany(tomorrow.length, first2(tomorrow));
  const body = fresh.length > 0 ? labels.plusNew(fresh.length, societies(fresh)) : '';
  return { title, body };
}
