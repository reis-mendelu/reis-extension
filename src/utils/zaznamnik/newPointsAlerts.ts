import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import type { SubjectInfo } from '../../types/documents';
import { courseDisplayName, type CourseNicknames } from '../courseDisplayName';
import type { NewPoint } from './newPoints';
import { listPoints } from './newPointsText';

/**
 * "Nové body" as Novinky rows, one per subject, on both trees: Novinky is where
 * a message lives in reIS, and the bell's badge counts it.
 *
 * The id carries the points themselves, so a subject that gets more points
 * after the student saw its row is counted by the bell again. The row stays
 * until that subject's Záznamník is opened (markZaznamnikSeen).
 */
export function newPointsAlerts(
  newPoints: Record<string, NewPoint[]>,
  subjects: Record<string, Partial<SubjectInfo>> | undefined,
  nicknames: CourseNicknames,
  isEn: boolean
): DeadlineAlert[] {
  return Object.entries(newPoints)
    .filter(([, points]) => points.length > 0)
    .map(([code, points]) => {
      const s = subjects?.[code];
      return {
        id: `zaznamnik-${code}-${points.map((p) => `${p.label}=${p.value}`).join('|')}`,
        type: 'zaznamnik-points' as const,
        title: courseDisplayName(nicknames, code, (isEn ? s?.nameEn : s?.nameCs) ?? s?.displayName),
        body: listPoints(points),
        courseCode: code,
        courseId: s?.subjectId,
      };
    });
}
