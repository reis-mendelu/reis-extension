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

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const clamped = Math.min(total, 23 * 60 + 59);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

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
        start: l.startTime,
        end: l.endTime,
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
        start: t.time,
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
    start: e.startTime,
    end: e.endTime,
    title: e.title,
    location: e.room ?? '',
    description: FOOTER,
  }));
}
