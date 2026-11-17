import { EyeOff, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * The phone's way back from a hide (`HideLessonSheet`), in Nastavení — where
 * the first-time hint says it is: "Skryté položky lze obnovit v Profil →
 * Nastavení", the extension's words, true on both now.
 *
 * Not the extension's `HiddenItemsSection`: that is a collapsed list of 24px
 * `btn-xs` restores in its own 152px scroller, sized for a mouse in a popup.
 * Here every row is a 44px target and the sheet itself scrolls. Renders
 * nothing while nothing is hidden, so Nastavení is unchanged for most.
 */
export function HiddenLessonsRows() {
  const { t } = useTranslation();
  const { courses, events } = useAppStore((s) => s.hiddenItems);
  const unhideCourse = useAppStore((s) => s.unhideCourse);
  const unhideEvent = useAppStore((s) => s.unhideEvent);
  if (courses.length === 0 && events.length === 0) return null;

  const kindLabel = (type?: 'lecture' | 'seminar' | 'all') =>
    type === 'seminar'
      ? t('course.badge.seminar')
      : type === 'lecture'
        ? t('course.badge.lecture')
        : t('calendar.hide.all');

  return (
    <section aria-label={t('calendar.hide.hiddenItems')} className="pt-2">
      <div className="flex items-center gap-3 px-4 pb-1 pt-2">
        <EyeOff size={16} className="flex-shrink-0 text-base-content/50" />
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('calendar.hide.hiddenItems')}
        </span>
      </div>
      {courses.map((course) => (
        <Row
          key={`${course.courseCode}-${course.type}`}
          name={course.courseName}
          detail={kindLabel(course.type)}
          restoreLabel={t('calendar.hide.restore')}
          onRestore={() => void unhideCourse(course.courseCode, course.type)}
        />
      ))}
      {events.map((event) => (
        <Row
          key={`${event.id}-${event.date}`}
          name={event.courseName}
          detail={`${t('calendar.hide.single')} · ${Number(event.date.slice(6, 8))}. ${Number(event.date.slice(4, 6))}.`}
          restoreLabel={t('calendar.hide.restore')}
          onRestore={() => void unhideEvent(event.id, event.date)}
        />
      ))}
    </section>
  );
}

function Row({
  name,
  detail,
  restoreLabel,
  onRestore,
}: {
  name: string;
  detail: string;
  restoreLabel: string;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1 pl-11 pr-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-md font-medium">{name}</span>
        <span className="truncate text-xs text-base-content/60">{detail}</span>
      </div>
      <button
        type="button"
        onClick={onRestore}
        aria-label={`${restoreLabel}: ${name}`}
        className="flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[var(--tone-primary)] active:bg-base-300"
      >
        <RotateCcw size={15} />
        {restoreLabel}
      </button>
    </div>
  );
}
