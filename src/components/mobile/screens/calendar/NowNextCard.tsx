import type { NowNext } from '../../../../utils/mobile/nowNext';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAppStore } from '../../../../store/useAppStore';
import { localizedCourseName } from '../../../../utils/localizedLesson';
import { lessonPlace } from '../../../../utils/mobile/lessonPlace';

export function NowNextCard({ data, onRoute }: { data: NowNext; onRoute: () => void }) {
  const { t, language } = useTranslation();
  const { current, next, elapsedPct, minutesLeft } = data;
  // Teacher has fullName/shortName, not `.name` — the prototype's placeholder
  // data used a plain `.name` field that doesn't exist on the real type.
  const teacher = current.teachers[0]?.fullName ?? '';
  const mapEvents = useAppStore((s) => s.mapEvents);
  const onMapLabel = t('map.venueOnMap');
  const currentName = localizedCourseName(current, language);
  const currentRoom = lessonPlace(current, language, mapEvents, onMapLabel).label;
  const nextName = next ? localizedCourseName(next, language) : '';
  const nextPlace = next ? lessonPlace(next, language, mapEvents, onMapLabel) : null;
  // "Kam jít" points at a place, so it is offered only when there is one to
  // point at — a lesson held online, or a room MENDELU's map does not
  // publish, would otherwise take the student to an empty campus overview.
  const routable = !!nextPlace?.onMap;

  return (
    <div
      data-testid="now-next-card"
      className="mx-4 mt-3.5 flex flex-shrink-0 flex-col gap-2 rounded-2xl border border-primary/25 bg-base-100 px-4 py-3"
    >
      {/* The countdown rides the progress bar's line. Its own row above the
          title left a band of empty card; on the title's line it pushed the
          course name onto two lines at 390px. Beside the bar it says the same
          thing the bar shows, in the words a student wants. */}
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-lg font-bold tracking-tight">{currentName}</span>
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
        <div className="flex items-start justify-between gap-2">
          {/* The whole time it runs, not just when it starts: "until when?"
              was the question the start time on its own left open. */}
          <span className="min-w-0 flex-1 text-sm font-medium text-base-content/60">
            <span className="font-bold text-base-content/80">{t('mobile.calendar.nextLabel')}</span>{' '}
            {[nextName, nextPlace?.label, `${next.startTime} – ${next.endTime}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {routable && (
            <button
              onClick={onRoute}
              className="flex-shrink-0 whitespace-nowrap pl-3 text-sm font-semibold text-primary"
            >
              {t('mobile.calendar.route')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
