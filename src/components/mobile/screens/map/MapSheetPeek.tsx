import { CATEGORY_EMOJI_SRC } from '../../../../data/eventCategories';
import { relativeDayLabel, sortByDate } from '../../../CampusMap/eventHelpers';
import { useVisibleMapEvents } from '../../../../hooks/useVisibleMapEvents';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * What the map sheet shows while it is closed: the next thing happening.
 *
 * The band used to read "Akce na kampusu" and nothing else, over the ~96px it
 * reserves for the floating BottomNav — a heading for content it did not show,
 * on a sheet whose whole job at rest is to answer "is anything on?". Answering
 * it costs one row, and the row is the same first row the list opens with, so
 * tapping the band never contradicts what it promised.
 *
 * Deliberately NOT `EventRow`: that row is a link into an event (it focuses the
 * pin and opens the card) and carries a third line for the venue. Here the
 * whole band is one target with one meaning — open the list — so the venue
 * line, the selection state and the nested button all have to go.
 */
export function MapSheetPeek() {
  const { t, language } = useTranslation();
  const events = useVisibleMapEvents();
  const next = sortByDate(events)[0];

  if (!next) {
    // Not "no events": the band is the only place this sheet says what it is
    // for, so the empty line has to carry the subject as well as the fact.
    return (
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-base-content/70">
        {t('mobile.map.peekEmpty')}
      </span>
    );
  }

  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const when = `${relativeDayLabel(next.date, locale, t)}${next.time ? ` · ${next.time}` : ''}`;

  return (
    <>
      {/* Below 360px the band also carries the route button, and the tile is
          the first thing worth giving up: without this the title and the time
          were both truncated — "Kvíz v ..." over "Úterý · 1...", a time cut
          mid-digit, which is worse than no time. Same breakpoint BottomNav
          tightens at, for the same reason. */}
      <span className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl max-[359px]:hidden">
        {next.imageUrl ? (
          <img src={next.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-base-content/5">
            <img src={CATEGORY_EMOJI_SRC[next.category]} alt="" className="h-6 w-6" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-base-content">
          {next.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-base-content/60">{when}</span>
      </span>
    </>
  );
}
