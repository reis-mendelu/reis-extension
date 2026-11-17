import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import type { ExamSection, ExamSubject, ExamTerm } from '../../types/exams';
import { parseDate } from '../date';
import { examTermKey } from '../newExamTerms';
import { isGroupSignupSection } from './isGroupSignup';

function at(date: string, time = '00:00'): Date | null {
  try {
    return parseDate(date, time);
  } catch {
    return null;
  }
}

/** "01.12.2026 08:00" → Date. */
function stamp(s: string | undefined): Date | null {
  if (!s) return null;
  const [date, time] = s.split(' ');
  return date ? at(date, time) : null;
}

/** "14.12.2026" → "14. 12." */
const shortDate = (d: string) => {
  const [day, month] = d.split('.');
  return `${Number(day)}. ${Number(month)}.`;
};

/**
 * A new term is still news while the student could do something with it: the
 * exam is ahead, IS lets them in ("Kam nemohu" is not), registration has not
 * closed, and they have no term in that section yet. A full term stays: its
 * date is still news, and a place can free up.
 */
function stillUseful(t: ExamTerm, now: number): boolean {
  if (t.cannotRegister) return false;
  const when = at(t.date, t.time);
  if (!when || when.getTime() <= now) return false;
  const end = stamp(t.registrationEnd);
  return !end || end.getTime() > now;
}

/**
 * "Nový termín" rows, one per section, on both trees: the new terms the
 * student has not seen yet (`examTermsNew`), their dates soonest first. The id
 * carries the terms, so another new date in the same section is counted by the
 * bell again.
 */
export function newTermAlerts(
  subjects: readonly ExamSubject[],
  unseen: readonly string[],
  now: number,
  names: { subject: (s: ExamSubject) => string; section: (s: ExamSection) => string }
): DeadlineAlert[] {
  if (unseen.length === 0) return [];
  const wanted = new Set(unseen);
  return subjects.flatMap((subject) =>
    subject.sections
      .filter((section) => section.status !== 'registered' && !isGroupSignupSection(section))
      .flatMap((section): DeadlineAlert[] => {
        const fresh = section.terms
          .filter((t) => wanted.has(examTermKey(subject.code, t.id)))
          .filter((t) => stillUseful(t, now))
          .sort(
            (a, b) => (at(a.date, a.time)?.getTime() ?? 0) - (at(b.date, b.time)?.getTime() ?? 0)
          );
        if (fresh.length === 0) return [];
        const keys = fresh.map((t) => examTermKey(subject.code, t.id));
        return [
          {
            id: `exam-new-${keys.join('|')}`,
            type: 'exam-new-term',
            title: names.subject(subject),
            body: `${names.section(section)} · ${fresh.map((t) => shortDate(t.date)).join(', ')}`,
            courseCode: subject.code,
          },
        ];
      })
  );
}
