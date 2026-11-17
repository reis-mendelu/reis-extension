import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import type { ExamSection, ExamSubject, ExamTerm } from '../../types/exams';
import { parseDate } from '../date';
import { isGroupSignupSection } from './isGroupSignup';

const H = 3_600_000;
/** Registration opening: the day before. */
const OPENS_WITHIN_H = 24;
/** Registration closing: the last day of the last chance. */
const CLOSES_WITHIN_H = 24;
/** The student's own exams: the coming week. */
const MINE_WITHIN_H = 7 * 24;

function at(date: string, time = '00:00'): Date | null {
  try {
    return parseDate(date, time);
  } catch {
    return null;
  }
}

/** "01.12.2026 18:00" → Date. */
function stamp(s: string | undefined): Date | null {
  if (!s) return null;
  const [date, time] = s.split(' ');
  return date ? at(date, time) : null;
}

interface Names {
  subject: string;
  section: string;
  room: (r: NonNullable<ExamSection['registeredTerm']>) => string | undefined;
}

/** A term IS lets this student register for at some point: not "Kam nemohu", not full. */
const registrable = (t: ExamTerm) => !t.cannotRegister && !t.full;

/**
 * One row per section, at most, in each of three kinds:
 *
 * - **exam-registered**: the student's own exam in the coming week, with date and room.
 * - **exam-reg-opens**: registration opens within a day, in a section they are not in.
 * - **exam-reg**: the LAST registrable term's registration closes within a day. While a
 *   later term still takes registrations nothing is closing, and a row per term
 *   was a stack of six "Uzavírá se" for one zápočet.
 *
 * The parser's statuses are `open` and `registered`; this used to wait for
 * `available`, which IS never produces, so the registration rows never showed.
 */
export function examSectionAlerts(
  section: ExamSection,
  names: Names,
  now: number
): DeadlineAlert[] {
  if (isGroupSignupSection(section)) return [];
  const base = { title: names.subject, body: names.section };

  if (section.status === 'registered') {
    const mine = section.registeredTerm;
    const when = mine && at(mine.date, mine.time);
    if (!mine || !when) return [];
    const h = (when.getTime() - now) / H;
    if (h <= 0 || h > MINE_WITHIN_H) return [];
    const room = names.room(mine);
    return [
      {
        ...base,
        id: `exam-mine-${mine.id ?? `${section.id}-${mine.date}`}`,
        type: 'exam-registered',
        body: room ? `${names.section} · ${room}` : names.section,
        deadline: when,
        hoursUntil: h,
      },
    ];
  }

  const out: DeadlineAlert[] = [];
  const terms = section.terms.filter((t) => !t.cannotRegister);

  const openings = terms
    .map((t) => ({ t, start: stamp(t.registrationStart) }))
    .filter((x): x is { t: ExamTerm; start: Date } => !!x.start && x.start.getTime() > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const first = openings[0];
  if (first) {
    const h = (first.start.getTime() - now) / H;
    if (h <= OPENS_WITHIN_H)
      out.push({
        ...base,
        id: `exam-opens-${first.t.id}`,
        type: 'exam-reg-opens',
        deadline: first.start,
        hoursUntil: h,
      });
  }

  const takingNow = terms.filter(registrable).filter((t) => {
    const start = stamp(t.registrationStart);
    const end = stamp(t.registrationEnd);
    return (!start || start.getTime() <= now) && !!end && end.getTime() > now;
  });
  const last = takingNow
    .map((t) => ({ t, end: stamp(t.registrationEnd)! }))
    .sort((a, b) => b.end.getTime() - a.end.getTime())[0];
  if (last) {
    const h = (last.end.getTime() - now) / H;
    if (h <= CLOSES_WITHIN_H)
      out.push({
        ...base,
        id: `exam-reg-${last.t.id}`,
        type: 'exam-reg',
        deadline: last.end,
        hoursUntil: h,
      });
  }
  return out;
}

/** Every exam row for the subjects given (the caller drops past semesters). */
export function examAlerts(
  subjects: ExamSubject[],
  now: number,
  nameOf: (s: ExamSubject) => string,
  sectionNameOf: (s: ExamSection) => string,
  roomOf: Names['room']
): DeadlineAlert[] {
  return subjects.flatMap((subject) =>
    subject.sections.flatMap((section) =>
      examSectionAlerts(
        section,
        { subject: nameOf(subject), section: sectionNameOf(section), room: roomOf },
        now
      )
    )
  );
}
