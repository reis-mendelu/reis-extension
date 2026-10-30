import { MapPin } from 'lucide-react';
import type { BlockLesson } from '../../../types/calendarTypes';
import { useTranslation } from '../../../hooks/useTranslation';
import { lessonPlace } from '../../../utils/lessonPlace';
import { formatHeaderDate } from '../../../utils/mobile/formatHeaderDate';
import { useShowLessonOnMap } from '../screens/calendar/useShowLessonOnMap';

/**
 * Where and when the Týden block that opened this subject is, with Trasa
 * (spec 2026-10-30, decision 6). A tap on a lesson always opens its subject,
 * so this is how Týden reaches the room — one tap more than the strip's "Teď",
 * for the times a student does not know the room yet.
 *
 * Rendered only for `weekLesson`, which only the week grid sets: from Den it
 * would repeat the row just tapped. Trasa follows the Now/Next card's rule —
 * only for a room the map can walk to.
 */
export function WeekLessonPlace({ lesson }: { lesson: BlockLesson }) {
  const { t, language } = useTranslation();
  const showOnMap = useShowLessonOnMap();
  const place = lessonPlace(lesson, language);
  const iso = `${lesson.date.slice(0, 4)}-${lesson.date.slice(4, 6)}-${lesson.date.slice(6, 8)}`;
  const day = formatHeaderDate(
    new Date(`${iso}T00:00:00`),
    language === 'cz' ? 'cs' : language,
    'short'
  );

  return (
    <div
      data-testid="week-lesson-place"
      aria-label={t('mobile.calendar.thisLesson')}
      className="mx-4 mb-2 mt-1 flex items-center gap-3 rounded-2xl border border-primary/25 bg-base-100 py-2 pl-3 pr-2"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 text-[var(--tone-primary)]">
        <MapPin size={20} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-md font-bold">{place.label}</span>
        <span className="truncate text-sm text-base-content/70">
          {day} · {lesson.startTime}–{lesson.endTime}
        </span>
      </div>
      {place.routable && (
        <button
          type="button"
          onClick={() => showOnMap(lesson)}
          className="flex min-h-11 flex-shrink-0 items-center whitespace-nowrap px-2 text-sm font-semibold text-[var(--tone-primary)]"
        >
          {t('mobile.calendar.route')}
        </button>
      )}
    </div>
  );
}
