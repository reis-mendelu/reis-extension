import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { parseDate } from '../utils/date';
import { courseDisplayName } from '../utils/courseDisplayName';
import { boxCourseCode, boxState } from '../utils/submissionBoxes';
import { newPointsAlerts } from '../utils/zaznamnik/newPointsAlerts';
import { boxKey } from '../utils/newBoxDetection';
import { newBoxAlerts, urgentNewBoxId } from '../utils/newSubmissionBoxAlerts';

export interface DeadlineAlert {
  id: string;
  type:
    | 'exam-reg-opens'
    | 'exam-reg'
    | 'assignment'
    | 'assignment-new'
    | 'cvicny-test'
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
  const cvicneTests = useAppStore((s) => s.cvicneTests);
  const subjects = useAppStore((s) => s.subjects?.data);
  const nicknames = useAppStore((s) => s.courseNicknames);
  const language = useAppStore((s) => s.language);
  const seenIds = useAppStore((s) => s.notifications.seenDeadlineAlertIds);
  const markDeadlineAlertsSeen = useAppStore((s) => s.markDeadlineAlertsSeen);
  const pulseNow = useAppStore((s) => s.now);
  const newPoints = useAppStore((s) => s.zaznamnikNewPoints);
  const newBoxes = useAppStore((s) => s.odevzdavarnyNew);

  const markAllSeen = useCallback(
    (ids: string[]) => {
      markDeadlineAlertsSeen(ids);
    },
    [markDeadlineAlertsSeen]
  );

  const alerts = useMemo(() => {
    const now = pulseNow.getTime();
    const isEn = language === 'en';
    const result: DeadlineAlert[] = [];

    for (const subject of exams) {
      const subjectName = courseDisplayName(
        nicknames,
        subject.code,
        (isEn ? subject.nameEn : subject.nameCs) ?? subject.name
      );

      for (const section of subject.sections) {
        const sectionName = (isEn ? section.nameEn : section.nameCs) ?? section.name;

        if (section.status === 'available') {
          for (const term of section.terms) {
            // "Kam se přihlásit nemohu?": IS's dates, but they never open for
            // this student, so there is nothing to alert them to.
            if (term.cannotRegister) continue;
            if (term.registrationStart) {
              const start = parseCzDateTime(term.registrationStart);
              if (start) {
                const h = (start.getTime() - now) / H;
                if (h > 0 && h <= 24)
                  result.push({
                    id: `exam-opens-${term.id}`,
                    type: 'exam-reg-opens',
                    title: subjectName,
                    body: sectionName,
                    deadline: start,
                    hoursUntil: h,
                  });
              }
            }
            if (term.registrationEnd) {
              const end = parseCzDateTime(term.registrationEnd);
              if (end) {
                const h = (end.getTime() - now) / H;
                const startTime = term.registrationStart
                  ? parseCzDateTime(term.registrationStart)?.getTime()
                  : undefined;
                const isOpen = !startTime || startTime <= now;
                if (h > 0 && h <= 48 && isOpen)
                  result.push({
                    id: `exam-reg-${term.id}`,
                    type: 'exam-reg',
                    title: subjectName,
                    body: sectionName,
                    deadline: end,
                    hoursUntil: h,
                  });
              }
            }
          }
        }
      }
    }

    const freshBoxes = newBoxAlerts(newBoxes, odevzdavarny, subjects, nicknames, language, now);
    const announced = new Set(freshBoxes.map((a) => a.boxKey));

    for (const a of odevzdavarny) {
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

    for (const test of cvicneTests) {
      if (test.status !== 'accessible') continue;
      const id = `cvicny-${test.courseId}-${test.name}`;
      const courseName = isEn ? test.courseNameEn : test.courseNameCs;
      result.push({ id, type: 'cvicny-test', title: courseName, body: test.name, link: test.url });
    }

    result.sort((a, b) => (a.hoursUntil ?? Infinity) - (b.hoursUntil ?? Infinity));
    // Points and new boxes first: they already happened, the deadlines are still ahead.
    return [...newPointsAlerts(newPoints, subjects, nicknames, isEn), ...freshBoxes, ...result];
  }, [
    exams,
    odevzdavarny,
    cvicneTests,
    language,
    pulseNow,
    subjects,
    nicknames,
    newPoints,
    newBoxes,
  ]);

  const unseenCount = useMemo(
    () =>
      alerts.filter((a) => !seenIds.has(a.id) && !(a.seenWith && seenIds.has(a.seenWith))).length,
    [alerts, seenIds]
  );

  return { alerts, markAllSeen, unseenCount };
}
