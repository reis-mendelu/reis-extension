import { EyeOff, Calendar, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import type { LessonWithRow } from '../types/calendarTypes';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';
import { useHintStatus } from '../hooks/ui/useHintStatus';

/**
 * The hover menu that takes a lesson off the calendar.
 *
 * Its own file because it is its own job — a dropdown, three store actions and
 * a first-time hint — and because the card it hangs in the corner of had grown
 * past the 200-line convention carrying it. Raised in review.
 *
 * It is the ONLY route to `hideEvent` and `hideCourse`, which is why the card
 * renders it regardless of how little room the block has: a lesson drawn short
 * is a lesson with another one underneath it, and that is exactly when someone
 * wants one of them gone.
 */
export function CalendarEventCardHideMenu({
  lesson,
  /** The name the hide is RECORDED against, so the restore list reads right. */
  fullName,
  /** The name the menu heads itself with — the nickname, where there is one. */
  baseName,
}: {
  lesson: LessonWithRow;
  fullName: string;
  baseName: string;
}) {
  const { t } = useTranslation();
  const { isSeen, markSeen } = useHintStatus('calendar_hide_first_time');
  const hideEvent = useAppStore((s) => s.hideEvent);
  const hideCourse = useAppStore((s) => s.hideCourse);

  // Shown once, ever: hiding is reversible and the student has no way to know
  // where from, but a toast on every hide would be noise by the third one.
  const showHint = () => {
    if (!isSeen) {
      toast.info(t('calendar.hide.hint'), { duration: 5000 });
      markSeen();
    }
  };

  const hideOccurrence = (e: React.MouseEvent) => {
    e.stopPropagation();
    hideEvent(lesson.id, lesson.courseCode, fullName, lesson.date);
    showHint();
  };

  const hideType = (e: React.MouseEvent) => {
    e.stopPropagation();
    hideCourse(lesson.courseCode, fullName, lesson.isSeminar === 'true' ? 'seminar' : 'lecture');
    showHint();
  };

  const hideAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    hideCourse(lesson.courseCode, fullName, 'all');
    showHint();
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
