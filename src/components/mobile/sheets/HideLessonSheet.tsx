import { Calendar, CalendarRange } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { BlockLesson } from '../../../types/calendarTypes';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { useHideLesson } from '../../../hooks/ui/useHideLesson';
import { localizedCourseName } from '../../../utils/localizedLesson';
import { lessonDisplayName } from '../../../utils/courseDisplayName';

export interface HideLessonSheetProps {
  lesson: BlockLesson;
  onClose: () => void;
}

/**
 * What a held lesson in Týden or Den opens: take it off the calendar.
 *
 * Suggestion #43: "I'm only retaking the exam, so I don't attend the seminars,
 * but every seminar option shows in my timetable and I can only rename them."
 * The extension's two lesson-sized choices — this lesson, or every seminar
 * (lecture) of the subject. Not its third, the whole subject: a phone student
 * who wants that hides the seminars and the lectures, and a menu a thumb opens
 * by accident should not hold the biggest hide.
 *
 * The way back is in Profil → Nastavení (`HiddenLessonsRows`), and the
 * first hide says so once — the extension's hint, word for word.
 */
export function HideLessonSheet({ lesson, onClose }: HideLessonSheetProps) {
  const { t, language } = useTranslation();
  const nicknames = useAppStore((s) => s.courseNicknames);
  const hide = useHideLesson();
  const fullName = localizedCourseName(lesson, language);
  const title = lessonDisplayName(nicknames, lesson, fullName);
  const day = `${Number(lesson.date.slice(6, 8))}. ${Number(lesson.date.slice(4, 6))}.`;
  const seminar = lesson.isSeminar === 'true';

  const choose = (action: 'occurrence' | 'kind') => {
    if (action === 'occurrence') hide.hideOccurrence(lesson, fullName);
    else hide.hideKind(lesson, fullName);
    onClose();
  };

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        title={title}
        subtitle={`${day} · ${lesson.startTime} – ${lesson.endTime}`}
        onClose={onClose}
      />
      <div className="flex flex-col pb-6">
        <Choice
          icon={Calendar}
          label={t('calendar.hide.occurrence')}
          onClick={() => choose('occurrence')}
        />
        <Choice
          icon={CalendarRange}
          label={seminar ? t('calendar.hide.seminars') : t('calendar.hide.lectures')}
          onClick={() => choose('kind')}
        />
      </div>
    </Sheet>
  );
}

function Choice({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-base-300"
    >
      <Icon size={17} className="flex-shrink-0 text-base-content/60" />
      <span className="flex-1 text-md font-medium text-base-content">{label}</span>
    </button>
  );
}
