import { ImpersonationError, type ImpersonationResult, type ImpersonationSelection } from './types';
import { lessonsFor } from './lessonsFor';
import { firstSlotOnly } from './pickSlots';
import { mapLimit } from './transport';
import { taughtSubjects } from './taughtSubjects';
import { EXCHANGE_PROGRAMME } from '../../utils/eventAudience';

/**
 * The Erasmus persona (design 2026-11-27 §4, step C): an exchange student at
 * PEF taking the pinned English-taught courses. IS's catalogue has no plan for
 * Z-EXC, so there is none: the plan screen shows what a student without one
 * sees.
 *
 * Each course is asked for on its own, WITHOUT a year: an exchange student is
 * in no year of the programmes these courses belong to, and the course list
 * was picked from the year-less answer (live 2026-11-28). One lecture slot and
 * the first seminar parallel each (`firstSlotOnly`), as for a year-2+ subject.
 * Subjects come from the timetable, both names included; a course with no
 * lesson this term has none, which `npm run personas:check` reports.
 */
export async function fetchExchange(sel: ImpersonationSelection): Promise<ImpersonationResult> {
  const courses = sel.courses ?? [];
  if (!courses.length) throw new ImpersonationError('noPlan');
  const per = await mapLimit(courses, 3, ({ predmetId, rozvrh }) =>
    lessonsFor({ rozvrh: rozvrh ?? sel.rozvrh }, { predmet: predmetId }, firstSlotOnly)
  );
  const schedule = per.flat();
  const fetchedAt = new Date().toISOString();
  const data = taughtSubjects(schedule, new Set(), fetchedAt);
  // The subject id the selection resolved, not the lesson's: the same thing
  // today, and the one the course select named.
  for (const c of courses) {
    const subject = data[c.code];
    if (subject) data[c.code] = { ...subject, subjectId: c.predmetId };
  }
  return {
    resolved: { programId: sel.programId, shortCode: EXCHANGE_PROGRAMME, rozvrh: sel.rozvrh },
    plan: null,
    schedule,
    subjects: { version: 1, lastUpdated: fetchedAt, data },
    fetchedAt: Date.now(),
  };
}
