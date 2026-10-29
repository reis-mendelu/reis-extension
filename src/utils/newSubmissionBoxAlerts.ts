import type { Odevzdavarna } from '../api/odevzdavarny';
import type { DeadlineAlert } from '../hooks/useDeadlineAlerts';
import type { SubjectInfo } from '../types/documents';
import type { Language } from '../store/types';
import { courseDisplayName, type CourseNicknames } from './courseDisplayName';
import { boxCourseCode, boxDeadline } from './submissionBoxes';
import { actionable, boxKey } from './newSubmissionBoxes';

/**
 * "Nová odevzdávárna" as Novinky rows, one per box, on both trees. A row opens
 * its subject's Záznamník, where the boxes are, and stays until that tab is
 * on screen (markBoxesSeen). A deadline but no `hoursUntil`: a clock would
 * print hundreds of hours and sort the row among the deadlines, when it is news
 * like "Nové body". The row shows the date instead.
 */
export function newBoxAlerts(
  unseen: string[],
  boxes: Odevzdavarna[],
  subjects: Record<string, Partial<SubjectInfo>> | undefined,
  nicknames: CourseNicknames,
  language: Language,
  now: number
): DeadlineAlert[] {
  if (unseen.length === 0) return [];
  const wanted = new Set(unseen);
  const isEn = language === 'en';
  return boxes.flatMap((box) => {
    if (!wanted.has(boxKey(box)) || !actionable(box, now)) return [];
    const code = boxCourseCode(box, subjects);
    // A row that cannot open its subject would be a dead end.
    if (!code) return [];
    const s = subjects?.[code];
    return [
      {
        id: `odev-new-${boxKey(box)}`,
        type: 'assignment-new' as const,
        title: courseDisplayName(
          nicknames,
          code,
          (isEn ? s?.nameEn : s?.nameCs) ||
            s?.displayName ||
            (isEn ? box.courseNameEn || box.courseNameCs : box.courseNameCs)
        ),
        body: box.name,
        deadline: boxDeadline(box) ?? undefined,
        courseCode: code,
        courseId: s?.subjectId ?? box.courseId,
      },
    ];
  });
}
