import type { ExamSection, ExamSubject } from '../../types/exams';
import type { AppState } from '../../store/types';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { parseDate } from '../date';
import { courseDisplayName } from '../courseDisplayName';
import { examAlerts } from '../exams/examAlerts';
import { newTermAlerts } from '../exams/newTermAlerts';
import { boxCourseCode, boxState } from '../submissionBoxes';
import { newPointsAlerts } from '../zaznamnik/newPointsAlerts';
import { boxKey } from '../newBoxDetection';
import { newBoxAlerts, urgentNewBoxId } from '../newSubmissionBoxAlerts';
import { isPastSubject, pastSubjectCodesOf, withoutPastSubjects } from '../pastSubjects';

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

/** What Novinky's alert rows are built from: the store's own fields. */
export interface DeadlineAlertInputs {
  exams: ExamSubject[];
  odevzdavarny: AppState['odevzdavarny'];
  subjects: NonNullable<AppState['subjects']>['data'] | undefined;
  nicknames: AppState['courseNicknames'];
  language: AppState['language'];
  pulseNow: Date;
  newPoints: AppState['zaznamnikNewPoints'];
  newBoxes: AppState['odevzdavarnyNew'];
  newTerms: AppState['examTermsNew'];
  studyPlan: AppState['studyPlanDual'];
}

/** The same inputs, read from a store snapshot: for code outside React (src/mobile). */
export const deadlineAlertInputsOf = (s: AppState): DeadlineAlertInputs => ({
  exams: s.exams.data,
  odevzdavarny: s.odevzdavarny,
  subjects: s.subjects?.data,
  nicknames: s.courseNicknames,
  language: s.language,
  pulseNow: s.now,
  newPoints: s.zaznamnikNewPoints,
  newBoxes: s.odevzdavarnyNew,
  newTerms: s.examTermsNew,
  studyPlan: s.studyPlanDual,
});

/**
 * Novinky's alert rows, on both trees. One function, so the bell, the phone's
 * sheet and the phone's system notifications (src/mobile/novinkyNotifications)
 * show one list — never two that drift apart.
 */
export function buildDeadlineAlerts({
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
}: DeadlineAlertInputs): DeadlineAlert[] {
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
}

/**
 * Has the student seen this row in Novinky? One rule for the bell's count and
 * the phone's system notifications, which skip what was already seen.
 */
export function isAlertSeen(a: DeadlineAlert, seenIds: ReadonlySet<string>): boolean {
  if (a.parts) return a.parts.every((p) => seenIds.has(p));
  return seenIds.has(a.id) || (!!a.seenWith && seenIds.has(a.seenWith));
}
