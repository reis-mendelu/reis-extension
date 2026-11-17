import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { ExamSection, ExamSubject } from '../types/exams';
import { parseDate } from '../utils/date';
import { courseDisplayName } from '../utils/courseDisplayName';
import { examAlerts } from '../utils/exams/examAlerts';
import { newTermAlerts } from '../utils/exams/newTermAlerts';
import { boxCourseCode, boxState } from '../utils/submissionBoxes';
import { newPointsAlerts } from '../utils/zaznamnik/newPointsAlerts';
import { boxKey } from '../utils/newBoxDetection';
import { newBoxAlerts, urgentNewBoxId } from '../utils/newSubmissionBoxAlerts';
import { isPastSubject, pastSubjectCodesOf, withoutPastSubjects } from '../utils/pastSubjects';

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

function parseCzDateTime(s: string): Date | null {
  if (!s) return null;
  const [datePart, timePart] = s.split(' ');
  try {
    return parseDate(datePart!, timePart ?? '00:00'); // safe: split always yields >=1 part
  } catch {
    return null;
  }
}

const H = 3_600_000;

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

  const alerts = useMemo(() => {
    const now = pulseNow.getTime();
    const isEn = language === 'en';
    const result: DeadlineAlert[] = [];
    // Nothing about an earlier semester's subject: see utils/pastSubjects.
    const past = pastSubjectCodesOf(studyPlan);
    const isPast = (code: string | null | undefined) => isPastSubject(past, code);

    const subjectName = (subject: ExamSubject) =>
      courseDisplayName(
        nicknames,
        subject.code,
        (isEn ? subject.nameEn : subject.nameCs) ?? subject.name
      );
    const sectionName = (section: ExamSection) =>
      (isEn ? section.nameEn : section.nameCs) ?? section.name;
    result.push(
      ...examAlerts(
        exams.filter((subject) => !isPast(subject.code)),
        now,
        subjectName,
        sectionName,
        (term) => (isEn ? term.roomEn : term.roomCs) ?? term.room
      )
    );

    const boxes = odevzdavarny.filter((b) => !isPast(boxCourseCode(b, subjects)));
    const freshBoxes = newBoxAlerts(newBoxes, boxes, subjects, nicknames, language, now);
    const announced = new Set(freshBoxes.map((a) => a.boxKey));

    for (const a of boxes) {
      // Its "Nová odevzdávárna" row already says when it is due.
      if (announced.has(boxKey(a))) continue;
      // The list also holds boxes IS will not take files for ("Kam nemohu").
      // Files alone do not silence it: until the student confirms in IS, the
      // box is not handed in (see boxState).
      if (boxState(a) === 'confirmed' || !a.deadline || a.isOpen === false) continue;
      const deadline = parseCzDateTime(a.deadline);
      if (!deadline) continue;
      const h = (deadline.getTime() - now) / H;
      if (h > 0 && h <= 48) {
        const courseName = courseDisplayName(
          nicknames,
          boxCourseCode(a, subjects) ?? undefined,
          isEn ? a.courseNameEn : a.courseNameCs
        );
        result.push({
          id: `odev-${a.odevzdavarnaId || a.name}`,
          type: 'assignment',
          title: courseName,
          body: a.name,
          deadline,
          hoursUntil: h,
          link: a.uploadUrl,
          // Its urgent "Nová odevzdávárna" row stood in for it, and was seen:
          // the bell must not count the same box twice. A new-box row seen
          // weeks earlier does not count: this warning is news of its own.
          seenWith: urgentNewBoxId(boxKey(a)),
        });
      }
    }

    result.sort((a, b) => (a.hoursUntil ?? Infinity) - (b.hoursUntil ?? Infinity));
    // Points and new boxes first: they already happened, the deadlines are still ahead.
    const points = newPointsAlerts(withoutPastSubjects(newPoints, past), subjects, nicknames, isEn);
    // New terms lead the coming dates: they are news, and have no clock of their own.
    const terms = newTermAlerts(
      exams.filter((subject) => !isPast(subject.code)),
      newTerms,
      now,
      { subject: subjectName, section: sectionName }
    );
    return [...points, ...freshBoxes, ...terms, ...result];
  }, [
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
  ]);

  const markAllSeen = useCallback(
    (ids: string[]) => {
      const wanted = new Set(ids);
      const parts = alerts.filter((a) => wanted.has(a.id)).flatMap((a) => a.parts ?? []);
      markDeadlineAlertsSeen([...ids, ...parts]);
    },
    [alerts, markDeadlineAlertsSeen]
  );

  const unseenCount = useMemo(
    () =>
      alerts.filter((a) =>
        a.parts
          ? !a.parts.every((p) => seenIds.has(p))
          : !seenIds.has(a.id) && !(a.seenWith && seenIds.has(a.seenWith))
      ).length,
    [alerts, seenIds]
  );

  return { alerts, markAllSeen, unseenCount };
}
