import { EyeOff, Calendar, CalendarRange } from 'lucide-react';
import type { CardLesson } from '../types/calendarTypes';
import { useTranslation } from '../hooks/useTranslation';
import { useHideLesson } from '../hooks/ui/useHideLesson';

/**
 * The hover menu that takes a lesson off the calendar.
 *
 * Its own file because it is its own job — a dropdown, three store actions and
 * a first-time hint — and because the card it hangs in the corner of had grown
 * past the 200-line convention carrying it. Raised in review.
 *
 * It is the extension's only route to `hideEvent` and `hideCourse` (the phone
 * has its hold menu, `HideLessonSheet`), which is why the card renders it
 * however little room the block has: a 50-minute lesson is drawn in one line,
 * and a lesson in a clash (`maxColumns > 1`) in half a column, and both can be
 * hidden like any other. The clash case is suggestion #43: parallel seminar
 * options are exactly what a student retaking only the exam wants gone.
 */
export function CalendarEventCardHideMenu({
  lesson,
  /** The name the hide is RECORDED against, so the restore list reads right. */
  fullName,
  /** The name the menu heads itself with — the nickname, where there is one. */
  baseName,
}: {
  lesson: CardLesson;
  fullName: string;
  baseName: string;
}) {
  const { t } = useTranslation();
  const hide = useHideLesson();

  const hideOccurrence = (e: React.MouseEvent) => {
    e.stopPropagation();
    hide.hideOccurrence(lesson, fullName);
  };

  const hideType = (e: React.MouseEvent) => {
    e.stopPropagation();
    hide.hideKind(lesson, fullName);
  };

  const hideAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    hide.hideAll(lesson, fullName);
  };

  return (
    <div
      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="btn btn-ghost btn-xs btn-circle bg-base-100/50 hover:bg-base-100 shadow-sm"
        >
          <EyeOff size={14} className="text-base-content/70" />
        </div>
        <ul
          tabIndex={0}
          className="dropdown-content z-[100] menu p-1 shadow-xl bg-base-100 border border-base-300 rounded-lg w-52 text-xs font-medium mt-1"
        >
          <li className="menu-title px-2 py-1 text-[10px] opacity-40 uppercase tracking-widest border-b border-base-200 mb-1 line-clamp-2 whitespace-normal leading-tight">
            {baseName}
          </li>
          <li>
            <button onClick={hideOccurrence} className="flex items-center gap-2 py-2">
              <Calendar size={14} />
              {t('calendar.hide.occurrence')}
            </button>
          </li>
          <li>
            <button onClick={hideType} className="flex items-center gap-2 py-2">
              <CalendarRange size={14} />
              {lesson.isSeminar === 'true'
                ? t('calendar.hide.seminars')
                : t('calendar.hide.lectures')}
            </button>
          </li>
          <div className="h-px bg-base-300 my-1 opacity-50" />
          <li>
            <button onClick={hideAll} className="flex items-center gap-2 py-2 opacity-70">
              <EyeOff size={14} />
              {t('calendar.hide.allLessons')}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
