import type { Odevzdavarna } from '../api/odevzdavarny';
import type { DeadlineAlert } from '../hooks/useDeadlineAlerts';
import type { SubjectInfo } from '../types/documents';
import type { Language } from '../store/types';
import { courseDisplayName, type CourseNicknames } from './courseDisplayName';
import { boxCourseCode, boxDeadline } from './submissionBoxes';
import { actionable, boxKey } from './newSubmissionBoxes';

/** A new box's row id is this plus its boxKey. */
export const NEW_BOX_ID_PREFIX = 'odev-new-';

const URGENT_HOURS = 48;

/**
 * "Nová odevzdávárna" as Novinky rows, one per box, on both trees. A row opens
 * its subject's Záznamník, where the boxes are, and stays until that tab is
 * on screen (markBoxesSeen). Its date shows rather than a count of hours,
 * which would read "za 1234 h"; only a box due within the same 48 hours as the
 * deadline rows gets the clock, since it stands in for that box's deadline row.
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
    const deadline = boxDeadline(box) ?? undefined;
    const hours = deadline && (deadline.getTime() - now) / 3_600_000;
    return [
      {
        id: `${NEW_BOX_ID_PREFIX}${boxKey(box)}`,
        type: 'assignment-new' as const,
        title: courseDisplayName(
          nicknames,
          code,
          (isEn ? s?.nameEn : s?.nameCs) ||
            s?.displayName ||
            (isEn ? box.courseNameEn || box.courseNameCs : box.courseNameCs)
        ),
        body: box.name,
        deadline,
        hoursUntil: hours !== undefined && hours <= URGENT_HOURS ? hours : undefined,
        courseCode: code,
        courseId: s?.subjectId ?? box.courseId,
      },
    ];
  });
}
