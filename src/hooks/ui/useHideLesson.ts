import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../useTranslation';
import { HintService } from '../../services/hints/HintService';

const HINT_ID = 'calendar_hide_first_time';

/** What a hide needs of a lesson — a `CardLesson` and a `BlockLesson` both fit. */
export interface HideableLesson {
  id: string;
  courseCode: string;
  date: string;
  isSeminar?: string;
  isExam?: boolean;
  isCustom?: boolean;
}

/**
 * Exams and the student's own or society events have no hide: an exam is a
 * term the student registered for, and an own event is deleted, not hidden.
 */
export function canHideLesson(lesson: HideableLesson): boolean {
  return !lesson.isCustom && !lesson.isExam;
}

/**
 * The three hides, shared by the extension's hover menu and the phone's hold
 * menu, with the one-time hint after the first of them: hiding is reversible,
 * and the student has no way to know where from, but a toast on every hide
 * would be noise by the third one.
 *
 * The hint's status is read when the hide HAPPENS, not when the menu mounts:
 * a per-component `useHintStatus` starts as "seen" until IndexedDB answers, so
 * a quick first hide skipped the hint, and every mounted card held its own
 * copy of the answer (PR #638 review).
 *
 * `name` is what the hide is RECORDED against, so the restore list reads right.
 */
export function useHideLesson() {
  const { t } = useTranslation();
  const hideEvent = useAppStore((s) => s.hideEvent);
  const hideCourse = useAppStore((s) => s.hideCourse);

  const showHint = () => {
    void HintService.isSeen(HINT_ID).then((seen) => {
      if (seen) return;
      toast.info(t('calendar.hide.hint'), { duration: 5000 });
      void HintService.markSeen(HINT_ID);
    });
  };

  return {
    /** This one lesson, on this one date. */
    hideOccurrence: (lesson: HideableLesson, name: string) => {
      void hideEvent(lesson.id, lesson.courseCode, name, lesson.date);
      showHint();
    },
    /** Every seminar, or every lecture, of the subject — whichever this is. */
    hideKind: (lesson: HideableLesson, name: string) => {
      void hideCourse(lesson.courseCode, name, lesson.isSeminar === 'true' ? 'seminar' : 'lecture');
      showHint();
    },
    /** The whole subject. The extension offers it; the phone does not. */
    hideAll: (lesson: HideableLesson, name: string) => {
      void hideCourse(lesson.courseCode, name, 'all');
      showHint();
    },
  };
}
