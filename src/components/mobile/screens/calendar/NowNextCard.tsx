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
  // Teacher has fullName/shortName, not `.name` — the prototype's placeholder
  // data used a plain `.name` field that doesn't exist on the real type. An
  // answered society event has none; who runs it goes there instead.
  const teacher = current.teachers[0]?.fullName || currentPlace.host;
  const currentName = localizedCourseName(current, language);
  const currentRoom = currentPlace.label;
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
      {/* The countdown rides the progress bar's line. Its own row above the
          title left a band of empty card; on the title's line it pushed the
          course name onto two lines at 390px. Beside the bar it says the same
          thing the bar shows, in the words a student wants. */}
      {/* The button sits with the lesson it routes to. On the "Následuje" row
          it read as a promise about the lesson after. It shares the title's
          line only: beside the whole block it narrowed the room/teacher line
          too, and that wrapped at 390. */}
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
        <span className="text-sm text-base-content/70">
          {[currentRoom, `${current.startTime} – ${current.endTime}`, teacher]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-300">
          <div className="h-full rounded-full bg-primary" style={{ width: `${elapsedPct}%` }} />
        </div>
        <span className="flex-shrink-0 whitespace-nowrap text-sm font-semibold text-base-content/60">
          {t('mobile.calendar.endsIn', { minutes: minutesLeft })}
        </span>
      </div>
      {next && (
        <div className="flex items-start gap-2">
          {/* The whole time it runs, not just when it starts: "until when?"
              was the question the start time on its own left open. */}
          <span className="min-w-0 flex-1 text-sm font-medium text-base-content/60">
            <span className="font-bold text-base-content/80">{t('mobile.calendar.nextLabel')}</span>{' '}
            {[nextName, nextPlace?.label, `${next.startTime} – ${next.endTime}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      )}
    </div>
  );
}
