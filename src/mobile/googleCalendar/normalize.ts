import type { BlockLesson, CalendarCustomEvent } from '../../types/calendarTypes';
import type { ExamSubject } from '../../types/exams';
import type { AppLanguage, NormalizedEvent } from './types';

/**
 * Fixed strings, NOT i18n JSON: a translation tweak must not silently change
 * every event hash and rewrite every future event in Google.
 */
export const LABELS = {
  cz: { lecture: 'přednáška', seminar: 'cvičení', exam: 'Zkouška' },
  en: { lecture: 'lecture', seminar: 'seminar', exam: 'Exam' },
} as const;

const FOOTER = 'reIS';
const DEFAULT_EXAM_MINUTES = 90; // same fallback as useCalendarData

const isoDate = (yyyymmdd: string) =>
  `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/**
 * HH:mm, wrapping past midnight (toGoogleEvent moves an end earlier than the
 * start to the next day). Also pads "9:00", which Google rejects in a date-time.
 */
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h ?? 0) * 60 + (m ?? 0) + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const hhmm = (t: string) => addMinutes(t, 0);

export function normalizeLessons(lessons: BlockLesson[], lang: AppLanguage): NormalizedEvent[] {
  return lessons
    .filter((l) => !l.isExam && !l.isCustom)
    .map((l) => {
      const name = (lang === 'en' ? l.courseNameEn : l.courseNameCs) || l.courseName;
      const room = (lang === 'en' ? l.roomEn : l.roomCs) || l.room || '';
      const type = l.isSeminar === 'true' ? LABELS[lang].seminar : LABELS[lang].lecture;
      const teachers = l.teachers
        .map((t) => t.fullName)
        .filter(Boolean)
        .join(', ');
      return {
        kind: 'lesson' as const,
        key: `${l.id}|${l.date}|${l.startTime}`,
        date: isoDate(l.date),
        start: hhmm(l.startTime),
        end: hhmm(l.endTime),
        title: `${name} – ${type}`,
        location: room,
        description: teachers ? `${teachers}\n${FOOTER}` : FOOTER,
      };
    });
}

export function normalizeExams(subjects: ExamSubject[], lang: AppLanguage): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const s of subjects) {
    const subjectName = (lang === 'en' ? s.nameEn : s.nameCs) || s.name;
    for (const sec of s.sections) {
      const t = sec.registeredTerm;
      if (sec.status !== 'registered' || !t) continue;
      const [dd, mm, yyyy] = t.date.split('.');
      const sectionName = (lang === 'en' ? sec.nameEn : sec.nameCs) || sec.name;
      out.push({
        kind: 'exam',
        key: t.id || `${s.id}|${sec.id}`,
        date: `${yyyy}-${mm}-${dd}`,
        start: hhmm(t.time),
        end: addMinutes(t.time, t.durationMinutes ?? DEFAULT_EXAM_MINUTES),
        title: `${LABELS[lang].exam}: ${subjectName}`,
        location: (lang === 'en' ? t.roomEn : t.roomCs) || t.room || '',
        description: `${sectionName}\n${FOOTER}`,
      });
    }
  }
  return out;
}

export function normalizeCustom(events: CalendarCustomEvent[]): NormalizedEvent[] {
  return events.map((e) => ({
    kind: 'custom' as const,
    key: e.id,
    date: isoDate(e.date),
    start: hhmm(e.startTime),
    end: hhmm(e.endTime),
    title: e.title,
    location: e.room ?? '',
    description: FOOTER,
  }));
}
