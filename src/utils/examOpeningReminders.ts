import type { ExamSubject } from '../types/exams';
import type { Language } from '../store/types';
import { parseRegistrationStart } from './termUtils';

/** Tags exam-opening notifications, so nothing else cancels or reschedules them. */
export const EXAM_OPENING_KIND = 'exam-opening';

/** How long before registration opens the reminder fires. */
export const REMIND_BEFORE_MS = 60 * 60 * 1000;

export interface ExamOpeningReminder {
  /** Stable id below 10⁹: the scheduler tells "already scheduled" from "new" by it. */
  id: number;
  /** subject code | section id | opening, local time. */
  key: string;
  subjectName: string;
  sectionName: string;
  /** IS's own "13:00" — Prague time, as the student reads it in IS. */
  opensAtClock: string;
  opensAt: Date;
  fireAt: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** How far Prague is ahead of UTC at `at`, in milliseconds. */
function pragueOffsetMs(at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - at;
}

/**
 * The moment an IS time happens. `parseRegistrationStart` builds the Date from
 * IS's wall clock in the PHONE's time zone; IS means Prague. On a phone abroad
 * that put the reminder an hour or more off — in London it fired as
 * registration opened. Falls back to the phone's reading without zone data.
 */
export function pragueToInstant(wallClock: Date): Date {
  try {
    const asUtc = Date.UTC(
      wallClock.getFullYear(),
      wallClock.getMonth(),
      wallClock.getDate(),
      wallClock.getHours(),
      wallClock.getMinutes()
    );
    // Twice: the first guess can sit across a DST switch from the answer.
    const first = asUtc - pragueOffsetMs(asUtc);
    return new Date(asUtc - pragueOffsetMs(first));
  } catch {
    return wallClock;
  }
}

/**
 * FNV-1a, kept below 10⁹: an int32 for the plugin, and clear of the záznamník's
 * ids, which are epoch seconds (above 10⁹ for good) — a shared id would replace
 * one notification with the other.
 */
function idOf(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 1_000_000_000;
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
      const next = section.terms
        .filter((t) => !t.cannotRegister && t.registrationStart)
        .map((t) => parseRegistrationStart(t.registrationStart!))
        .filter((d): d is Date => d !== null)
        .map((wall) => ({ wall, at: pragueToInstant(wall) }))
        .filter(({ at }) => at.getTime() > now.getTime())
        .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
      if (!next) continue;
      const opensAt = next.at;
      const fireAt = new Date(opensAt.getTime() - REMIND_BEFORE_MS);
      if (fireAt.getTime() <= now.getTime()) continue;
      // From IS's wall clock, so the id is the same on every phone, anywhere.
      const key = `${subject.code}|${section.id}|${localStamp(next.wall)}`;
      result.push({
        id: idOf(key),
        key,
        subjectName: (isEn ? subject.nameEn : subject.nameCs) ?? subject.name,
        sectionName: (isEn ? section.nameEn : section.nameCs) ?? section.name,
        opensAtClock: `${next.wall.getHours()}:${pad(next.wall.getMinutes())}`,
        opensAt,
        fireAt,
      });
    }
  }
  return result;
}
