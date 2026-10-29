import type { Odevzdavarna } from '../api/odevzdavarny';
import type { DeadlineAlert } from '../hooks/useDeadlineAlerts';
import type { SubjectInfo } from '../types/documents';
import type { Language } from '../store/types';
import { translate } from '../i18n/translate';
import { courseDisplayName, type CourseNicknames } from './courseDisplayName';
import { boxCourseCode, boxDeadline } from './submissionBoxes';
import { actionable, boxKey } from './newSubmissionBoxes';

/** "do ne 20. 12. 23:59", the same words the box's own card uses. */
export function boxUntil(deadline: Date, language: Language): string {
  const locale = language === 'cz' ? 'cs' : 'en';
  const day = deadline.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });
  const time = deadline.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return translate(language, 'odevzdavarny.until', { date: `${day} ${time}` });
}

/**
 * "Nová odevzdávárna" as Novinky rows, one per box, on both trees. A row opens
 * its subject's Záznamník, where the boxes are, and stays until that tab is
 * on screen (markBoxesSeen). No clock: the deadline is in the text, so the row
 * sits with "Nové body" instead of sorting among the deadlines.
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
    const deadline = boxDeadline(box);
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
        body: deadline ? `${box.name} · ${boxUntil(deadline, language)}` : box.name,
        courseCode: code,
        courseId: s?.subjectId ?? box.courseId,
      },
    ];
  });
}
