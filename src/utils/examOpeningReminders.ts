import type { ExamSubject } from '../types/exams';
import type { Language } from '../store/types';
import { parseRegistrationStart } from './termUtils';

/** Tags exam-opening notifications, so nothing else cancels or reschedules them. */
export const EXAM_OPENING_KIND = 'exam-opening';

/** How long before registration opens the reminder fires. */
export const REMIND_BEFORE_MS = 60 * 60 * 1000;

export interface ExamOpeningReminder {
  /** Stable 31-bit id: the scheduler tells "already scheduled" from "new" by it. */
  id: number;
  /** subject code | section id | opening, local time. */
  key: string;
  subjectName: string;
  sectionName: string;
  opensAt: Date;
  fireAt: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** FNV-1a, kept to 31 bits: Android takes a notification id as a Java int. */
function idOf(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff;
}

/**
 * "Za chvíli se otvírá zkouška" — the reminders the phone should hold right now
 * (spec docs/superpowers/specs/2026-10-20-exam-opening-reminders-design.md).
 *
 * One per section the student is not registered in, for the earliest opening
 * still ahead among the terms they may register for, an hour before it. Terms
 * that open together therefore share a reminder. A term from "Kam se přihlásit
 * nemohu?" keeps IS's dates but never opens for this student, so it is skipped,
 * as in `getSectionState`. A reminder whose time has passed is not returned: the
 * bell already shows that opening.
 */
export function examOpeningReminders(
  exams: readonly ExamSubject[],
  now: Date,
  language: Language
): ExamOpeningReminder[] {
  const isEn = language === 'en';
  const result: ExamOpeningReminder[] = [];
  for (const subject of exams) {
    for (const section of subject.sections) {
      if (section.status === 'registered') continue;
      const opensAt = section.terms
        .filter((t) => !t.cannotRegister && t.registrationStart)
        .map((t) => parseRegistrationStart(t.registrationStart!))
        .filter((d): d is Date => d !== null && d.getTime() > now.getTime())
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (!opensAt) continue;
      const fireAt = new Date(opensAt.getTime() - REMIND_BEFORE_MS);
      if (fireAt.getTime() <= now.getTime()) continue;
      const key = `${subject.code}|${section.id}|${localStamp(opensAt)}`;
      result.push({
        id: idOf(key),
        key,
        subjectName: (isEn ? subject.nameEn : subject.nameCs) ?? subject.name,
        sectionName: (isEn ? section.nameEn : section.nameCs) ?? section.name,
        opensAt,
        fireAt,
      });
    }
  }
  return result;
}
