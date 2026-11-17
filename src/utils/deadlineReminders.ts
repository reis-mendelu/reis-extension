import type { ExamSubject } from '../types/exams';
import type { Odevzdavarna } from '../api/odevzdavarny';
import type { AppState, Language } from '../store/types';
import { translate } from '../i18n/translate';
import { courseDisplayName, type CourseNicknames } from './courseDisplayName';
import { latestRegistrationChance } from './exams/examAlerts';
import { isGroupSignupSection } from './exams/isGroupSignup';
import { pragueToInstant } from './examOpeningReminders';
import { isPastSubject, pastSubjectCodesOf } from './pastSubjects';
import { boxCourseCode, boxState } from './submissionBoxes';

/** Tags these notifications, so nothing else cancels or reschedules them. */
export const DEADLINE_REMINDER_KIND = 'deadline-reminder';

/** The evening before an exam, Prague time. */
const EVENING_HOUR = 18;

export interface DeadlineReminder {
  /** Stable id below 10⁹: the scheduler tells "already scheduled" from "new" by it. */
  id: number;
  key: string;
  group: 'exam' | 'closing' | 'box';
  fireAt: Date;
  /** When the thing itself happens; a reminder past its time is kept until then. */
  eventAt: Date;
  title: string;
  body: string;
  courseCode?: string;
}

export interface DeadlineReminderInputs {
  exams: ExamSubject[];
  odevzdavarny: Odevzdavarna[];
  subjects: Record<string, { subjectId?: string; nameCs?: string; nameEn?: string }> | undefined;
  nicknames: CourseNicknames;
  studyPlan: AppState['studyPlanDual'];
  language: Language;
}

/** IS's "DD.MM.YYYY" and "HH:MM", as the wall clock in Prague. */
function wall(date: string, time = '00:00'): Date | null {
  const [d, m, y] = date.split('.').map(Number);
  const [h, min] = time.split(':').map(Number);
  if (!d || !m || !y || h === undefined || Number.isNaN(h) || Number.isNaN(min ?? 0)) return null;
  return new Date(y, m - 1, d, h, min ?? 0);
}

const stamp = (s: string | undefined) => {
  const [date, time] = (s ?? '').split(' ');
  return date ? wall(date, time) : null;
};

/** FNV-1a below 10⁹, like the opening reminders: clear of the epoch-second ids. */
function idOf(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 1_000_000_000;
}

/** The same wall clock a calendar day earlier: Prague's day, not the phone's 24 hours. */
const dayBefore = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, d.getHours(), d.getMinutes());

/**
 * "Now" as Prague's wall clock, in the same shape as an IS time read by
 * `wall()`: comparing IS times with it is right on a phone in any zone.
 */
function pragueWallNow(now: Date): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Prague',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  } catch {
    return now;
  }
}

const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * The reminders the phone should hold now (agreed 2026-11-17): your exam at
 * 18:00 the evening before; a day before the last chance to register closes,
 * in a section you are not in; a day before a box closes, unless it is handed
 * in. Times are IS's, meant in Prague. A reminder whose time has passed is not
 * returned — the Novinky row already says it — unless `includeDue`, for a
 * scheduler deciding what to keep while the event is still ahead.
 */
export function deadlineReminders(
  i: DeadlineReminderInputs,
  now: Date,
  { includeDue = false }: { includeDue?: boolean } = {}
): DeadlineReminder[] {
  const t = (key: string, p?: Record<string, string>) => translate(i.language, key, p);
  const isEn = i.language === 'en';
  const past = pastSubjectCodesOf(i.studyPlan);
  const out: DeadlineReminder[] = [];
  const add = (r: Omit<DeadlineReminder, 'id'>) => {
    if (r.eventAt.getTime() <= now.getTime()) return;
    if (!includeDue && r.fireAt.getTime() <= now.getTime()) return;
    // The language is in the id: switching it replaces what is pending, text and all.
    out.push({ ...r, id: idOf(`${i.language}|${r.key}`) });
  };

  for (const subject of i.exams) {
    if (isPastSubject(past, subject.code)) continue;
    const name = courseDisplayName(
      i.nicknames,
      subject.code,
      (isEn ? subject.nameEn : subject.nameCs) ?? subject.name
    );
    for (const section of subject.sections) {
      if (isGroupSignupSection(section)) continue;
      const sectionName = (isEn ? section.nameEn : section.nameCs) ?? section.name;
      const mine = section.registeredTerm;
      if (section.status === 'registered' && mine) {
        const when = wall(mine.date, mine.time);
        if (!when) continue;
        const evening = new Date(
          when.getFullYear(),
          when.getMonth(),
          when.getDate() - 1,
          EVENING_HOUR
        );
        const room = (isEn ? mine.roomEn : mine.roomCs) ?? mine.room;
        add({
          key: `exam|${subject.code}|${mine.id ?? section.id}|${mine.date} ${mine.time}`,
          group: 'exam',
          fireAt: pragueToInstant(evening),
          eventAt: pragueToInstant(when),
          title: t('deadlineReminders.examTitle', { subject: name }),
          body: [clock(when), sectionName, room].filter(Boolean).join(' · '),
          courseCode: subject.code,
        });
        continue;
      }
      if (section.status === 'registered') continue;
      const last = latestRegistrationChance(section, pragueWallNow(now).getTime());
      const end = last && stamp(last.t.registrationEnd);
      if (!last || !end) continue;
      add({
        key: `closing|${subject.code}|${last.t.id}|${last.t.registrationEnd}`,
        group: 'closing',
        fireAt: pragueToInstant(dayBefore(end)),
        eventAt: pragueToInstant(end),
        title: t('deadlineReminders.closingTitle', { subject: name }),
        body: t('deadlineReminders.closingBody', { section: sectionName, time: clock(end) }),
        courseCode: subject.code,
      });
    }
  }

  for (const b of i.odevzdavarny) {
    const code = boxCourseCode(b, i.subjects);
    if (isPastSubject(past, code)) continue;
    if (boxState(b) === 'confirmed' || b.isOpen === false) continue;
    const end = stamp(b.deadline);
    if (!end) continue;
    add({
      key: `box|${b.odevzdavarnaId || b.name}|${b.deadline}`,
      group: 'box',
      fireAt: pragueToInstant(dayBefore(end)),
      eventAt: pragueToInstant(end),
      title: t('deadlineReminders.boxTitle', {
        subject: courseDisplayName(
          i.nicknames,
          code ?? undefined,
          isEn ? b.courseNameEn : b.courseNameCs
        ),
      }),
      body: t('deadlineReminders.boxBody', { box: b.name, time: clock(end) }),
      courseCode: code ?? undefined,
    });
  }
  return out;
}
