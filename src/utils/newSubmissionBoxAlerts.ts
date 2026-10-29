import type { Odevzdavarna } from '../api/odevzdavarny';
import type { DeadlineAlert } from '../hooks/useDeadlineAlerts';
import type { SubjectInfo } from '../types/documents';
import type { Language } from '../store/types';
import { courseDisplayName, type CourseNicknames } from './courseDisplayName';
import { boxCourseCode, boxDeadline } from './submissionBoxes';
import { actionable, boxKey } from './newBoxDetection';

/** A new box's row id is this plus its boxKey. */
export const NEW_BOX_ID_PREFIX = 'odev-new-';

/**
 * The id of a new box's row once it is due within 48 hours. Its own id: the
 * bell counts the row again when it turns urgent, and only having seen THIS
 * row stands in for the box's deadline row (useDeadlineAlerts).
 */
export const urgentNewBoxId = (key: string) => `${NEW_BOX_ID_PREFIX}${key}@48h`;

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
    const urgent = hours !== undefined && hours <= URGENT_HOURS;
    return [
      {
        id: urgent ? urgentNewBoxId(boxKey(box)) : `${NEW_BOX_ID_PREFIX}${boxKey(box)}`,
        type: 'assignment-new' as const,
        boxKey: boxKey(box),
        title: courseDisplayName(
          nicknames,
          code,
          (isEn ? s?.nameEn : s?.nameCs) ||
            s?.displayName ||
            (isEn ? box.courseNameEn || box.courseNameCs : box.courseNameCs)
        ),
        body: box.name,
        deadline,
        hoursUntil: urgent ? hours : undefined,
        courseCode: code,
        courseId: s?.subjectId ?? box.courseId,
      },
    ];
  });
}
