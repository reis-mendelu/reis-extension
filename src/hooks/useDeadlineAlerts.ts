import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { buildDeadlineAlerts, isAlertSeen } from '../utils/novinky/buildDeadlineAlerts';

export interface DeadlineAlert {
  id: string;
  type:
    | 'exam-new-term'
    | 'exam-registered'
    | 'exam-reg-opens'
    | 'exam-reg'
    | 'assignment'
    | 'assignment-new'
    | 'zaznamnik-points';
  title: string;
  body: string;
  deadline?: Date;
  hoursUntil?: number;
  link?: string;
  /** Set on a row that opens a subject in reIS rather than a page in IS. */
  courseCode?: string;
  courseId?: string;
  /** On a "Nová odevzdávárna" row: the box it is about (boxKey). */
  boxKey?: string;
  /** Counted as seen when this id is: a deadline row whose box's new-box row was seen. */
  seenWith?: string;
  /**
   * Ids of what the row is made of (a "Nový termín" row's dates). Seeing the
   * row sees every part, and the row counts as seen while every part has
   * been — so a date dropping out of it does not light the bell again.
   */
  parts?: string[];
}

export function useDeadlineAlerts() {
  const exams = useAppStore((s) => s.exams.data);
  const odevzdavarny = useAppStore((s) => s.odevzdavarny);
  const subjects = useAppStore((s) => s.subjects?.data);
  const nicknames = useAppStore((s) => s.courseNicknames);
  const language = useAppStore((s) => s.language);
  const seenIds = useAppStore((s) => s.notifications.seenDeadlineAlertIds);
  const markDeadlineAlertsSeen = useAppStore((s) => s.markDeadlineAlertsSeen);
  const pulseNow = useAppStore((s) => s.now);
  const newPoints = useAppStore((s) => s.zaznamnikNewPoints);
  const newBoxes = useAppStore((s) => s.odevzdavarnyNew);
  const newTerms = useAppStore((s) => s.examTermsNew);
  const studyPlan = useAppStore((s) => s.studyPlanDual);

  const alerts = useMemo(
    () =>
      buildDeadlineAlerts({
        exams,
        odevzdavarny,
        subjects,
        nicknames,
        language,
        pulseNow,
        newPoints,
        newBoxes,
        newTerms,
        studyPlan,
      }),
    [
      exams,
      odevzdavarny,
      language,
      pulseNow,
      subjects,
      nicknames,
      newPoints,
      newBoxes,
      newTerms,
      studyPlan,
    ]
  );
  const markAllSeen = useCallback(
    (ids: string[]) => {
      const wanted = new Set(ids);
      const parts = alerts.filter((a) => wanted.has(a.id)).flatMap((a) => a.parts ?? []);
      markDeadlineAlertsSeen([...ids, ...parts]);
    },
    [alerts, markDeadlineAlertsSeen]
  );

  const unseenCount = useMemo(
    () => alerts.filter((a) => !isAlertSeen(a, seenIds)).length,
    [alerts, seenIds]
  );

  return { alerts, markAllSeen, unseenCount };
}
