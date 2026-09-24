import type { NowNext } from '../../../../utils/mobile/nowNext';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAppStore } from '../../../../store/useAppStore';
import { localizedCourseName } from '../../../../utils/localizedLesson';
import { lessonPlace } from '../../../../utils/lessonPlace';

export function NowNextCard({ data, onRoute }: { data: NowNext; onRoute: () => void }) {
  const { t, language } = useTranslation();
  const { current, next, elapsedPct, minutesLeft } = data;
  const mapEvents = useAppStore((s) => s.mapEvents);
  const onMapLabel = t('map.venueOnMap');
  const currentPlace = lessonPlace(current, language, mapEvents, onMapLabel);
  const currentName = localizedCourseName(current, language);
  // The agenda row's rule (AgendaEvent): the short name, so no titles; an
  // answered society event has no teacher, and who runs it goes there instead.
  const teacher = current.teachers[0]?.shortName || current.teachers[0]?.fullName || currentPlace.host;
  const currentLine = [currentPlace.label, teacher].filter(Boolean).join(' · ');
  const nextName = next ? localizedCourseName(next, language) : '';
  const nextPlace = next ? lessonPlace(next, language, mapEvents, onMapLabel) : null;
  // "Kam jít" points at the RUNNING lesson's room — the lesson this card is
  // about. It used to point at the next one, so a student opening the app
  // late for the lecture on now was walked to the one after it instead.
  //
  // Offered only when there is a place to point at: a lesson held online, or a
  // room MENDELU's map does not publish, would otherwise take the student to
  // an empty campus overview. An answered society event has one whenever it
  // has a coordinate.
  const routable = currentPlace.onMap;

  return (
    <div
      data-testid="now-next-card"
      className="mx-4 mt-3.5 flex flex-shrink-0 flex-col gap-2 rounded-2xl border border-primary/25 bg-base-100 px-4 py-3"
    >
      {/* The card renders only on today, right above today's agenda, whose
          row for this lesson already carries its room, time range and
          teacher. The time range stays off the card because the bar and the
          countdown answer it, which freed the room's line for the countdown.
          The teacher was dropped with it and brought back on request, short
          ("I. Grellneth", not the titled full name that made the card wordy),
          and truncating before the countdown does at 320px. */}
      {/* The button sits with the lesson it routes to. On the "Následuje" row
          it read as a promise about the lesson after. */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 font-display text-lg font-bold tracking-tight">
            {currentName}
          </span>
          {routable && (
            <button
              onClick={onRoute}
              className="flex-shrink-0 whitespace-nowrap pl-3 pt-1 text-sm font-semibold text-primary"
            >
              {t('mobile.calendar.route')}
            </button>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-semibold text-base-content/80">{currentLine}</span>
          <span className="flex-shrink-0 whitespace-nowrap font-semibold text-base-content/60">
            {t('mobile.calendar.endsIn', { minutes: minutesLeft })}
          </span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-base-300">
        <div className="h-full rounded-full bg-primary" style={{ width: `${elapsedPct}%` }} />
      </div>
      {next && (
        <div className="flex items-start gap-2">
          {/* When it starts, not the whole range: the range wrapped this row
              onto a second line at 390px, and the lesson's own agenda row
              right beneath says until when. */}
          <span className="min-w-0 flex-1 text-sm font-medium text-base-content/60">
            <span className="font-bold text-base-content/80">{t('mobile.calendar.nextLabel')}</span>{' '}
            {[nextName, nextPlace?.label, next.startTime].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}
    </div>
  );
}
