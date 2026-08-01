import type { ExamSubject } from '../../types/exams';

export interface TimelinePoint {
  id: string;
  subjectCode: string;
  date: Date;
  daysLeft: number;
  /** Full "DD.MM.YYYY HH:MM". */
  label: string;
  /** Day and month only ("5.4."), for the timeline itself: several points
   *  share one phone width, where full timestamps collide. */
  shortLabel: string;
}

/** "DD.MM.YYYY" + "HH:MM" → Date, or null when the string is not that shape. */
export function parseCzechDateTime(date: string, time: string): Date | null {
  const m = date.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (!m) return null;
  const [h, min] = (time.match(/^(\d{1,2}):(\d{2})$/) ? time.split(':') : ['0', '0']).map(Number);
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), h, min);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Dots for the exam screen's timeline — one per registered term, nearest first.
 * Terms with unparseable dates are dropped rather than throwing: IS occasionally
 * emits placeholder text where a date should be.
 */
export function buildExamTimeline(exams: ExamSubject[], now: Date): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (const exam of exams) {
    for (const section of exam.sections) {
      const reg = section.registeredTerm;
      if (!reg) continue;
      const date = parseCzechDateTime(reg.date, reg.time);
      if (!date) continue;
      points.push({
        id: reg.id ?? `${exam.code}-${reg.date}-${reg.time}`,
        subjectCode: exam.code,
        date,
        daysLeft: daysBetween(now, date),
        label: `${reg.date} ${reg.time}`,
        shortLabel: `${date.getDate()}.${date.getMonth() + 1}.`,
      });
    }
  }
  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}
