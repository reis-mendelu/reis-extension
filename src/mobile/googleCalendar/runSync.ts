import type { BlockLesson, CalendarCustomEvent } from '../../types/calendarTypes';
import type { ExamSubject } from '../../types/exams';
import type { CalendarApi } from './calendarApi';
import { AuthRevokedError, CalendarGoneError } from './calendarHttp';
import { normalizeCustom, normalizeExams, normalizeLessons } from './normalize';
import { planKind } from './plan';
import { runPool } from './runPool';
import { pragueMidnight, pragueToday } from './pragueDate';
import { toDesired } from './toGoogleEvent';
import type { AppLanguage, DesiredEvent, ReisKind } from './types';

export interface SyncState {
  calendarId: string | null;
  held: Partial<Record<ReisKind, string>>;
  lastSyncAt: number | null;
  /** The creating run hasn't finished writing history yet. */
  pastFillPending: boolean;
  /** Events reIS itself deleted (id → date). Only these are restored when IS brings them back. */
  reisDeleted: Record<string, string>;
  /** Events the student deleted or moved in Google, with the hash they had then. */
  skipped: Record<string, { hash: string; date: string }>;
}

export interface SyncSources {
  language: AppLanguage;
  lessons: BlockLesson[];
  lessonsConfirmed: boolean;
  exams: ExamSubject[];
  examsConfirmed: boolean;
  custom: CalendarCustomEvent[];
  customConfirmed: boolean;
}

export type SyncOutcome =
  | { kind: 'ok'; state: SyncState; written: number }
  | { kind: 'calendarGone' }
  | { kind: 'revoked' };

const CALENDAR_NAME = 'Rozvrh';
const KINDS = ['lesson', 'exam', 'custom'] as const;
/**
 * Writes in flight at once. Measured on the Pixel 9a, 2026-10-08: one at a time
 * wrote ~2 events/s (136 in about a minute); four at a time ~3/s, because each
 * Google write takes ~1.2 s server-side. Eight stays under Google's 600
 * requests/minute/user even at the 150 ms pace in calendarHttp.ts.
 */
const WRITE_CONCURRENCY = 8;

function futureOnly<T>(
  map: Record<string, T>,
  dateOf: (v: T) => string,
  today: string
): Record<string, T> {
  return Object.fromEntries(Object.entries(map).filter(([, v]) => dateOf(v) >= today));
}

/**
 * One sync of the "Rozvrh" calendar. The student wins in Google (Dominik,
 * 2026-10-08): an event they deleted stays deleted, and one they moved stays
 * put until IS actually changes it. Only events reIS deleted are restored.
 */
export async function runSync(o: {
  api: CalendarApi;
  state: SyncState;
  sources: SyncSources;
  now: Date;
  persist: (s: SyncState) => Promise<void>; // around createCalendar, and before deleting
  onProgress?: (done: number, total: number) => void;
}): Promise<SyncOutcome> {
  const { api, sources, now } = o;
  const today = pragueToday(now);
  const reisDeleted = { ...o.state.reisDeleted };
  const skipped = { ...o.state.skipped };
  try {
    let calendarId = o.state.calendarId;
    // Only the creating device writes history, and it keeps trying until a run
    // finishes: a ~500-event first fill takes minutes, and phones get killed.
    let includePast = o.state.pastFillPending;
    if (!calendarId) {
      calendarId = await api.findReisCalendar();
      if (!calendarId) {
        // Pending BEFORE create: a run killed in between would otherwise leave a
        // "Rozvrh" the next run finds and takes for another device's, and the
        // past would never be written.
        await o.persist({ ...o.state, pastFillPending: true });
        calendarId = await api.createCalendar(CALENDAR_NAME);
        includePast = true;
        await o.persist({ ...o.state, calendarId, pastFillPending: true });
      }
    }
    await api.assertCalendar(calendarId);
    const cal = calendarId;

    const desiredOf = (kind: ReisKind) => {
      if (kind === 'lesson') return normalizeLessons(sources.lessons, sources.language);
      if (kind === 'exam') return normalizeExams(sources.exams, sources.language);
      return normalizeCustom(sources.custom);
    };
    const confirmed: Record<ReisKind, boolean> = {
      lesson: sources.lessonsConfirmed,
      exam: sources.examsConfirmed,
      custom: sources.customConfirmed,
    };

    // The id is taken: moved out of the listed window, or deleted (Google keeps
    // deleted ids reserved). Decide who did it before writing anything.
    async function insertOrResolve(d: DesiredEvent): Promise<void> {
      if ((await api.insert(cal, d)) === 'inserted') return;
      if (reisDeleted[d.id]) {
        await api.put(cal, d);
        delete reisDeleted[d.id];
        return;
      }
      const ev = await api.getEvent(cal, d.id);
      if (!ev.cancelled && ev.hash !== d.hash) {
        await api.put(cal, d); // moved by the student, but IS has changed it since
        delete skipped[d.id];
        return;
      }
      skipped[d.id] = { hash: d.hash, date: d.date };
    }

    const timeMin = includePast ? null : pragueMidnight(now);
    const held: SyncState['held'] = {};
    const work: (() => Promise<void>)[] = [];
    for (const kind of KINDS) {
      const desired = await Promise.all(desiredOf(kind).map(toDesired));
      const existing = await api.listEvents(cal, kind, timeMin);
      const dateById = new Map(existing.map((e) => [e.id, e.date]));
      const plan = planKind({
        kind,
        today,
        includePast,
        desired,
        existing,
        sourceConfirmed: confirmed[kind],
        previousHeld: o.state.held[kind] ?? null,
        skipped: Object.fromEntries(Object.entries(skipped).map(([id, s]) => [id, s.hash])),
      });
      if (plan.held) held[kind] = plan.held;
      plan.insert.forEach((d) => work.push(() => insertOrResolve(d)));
      plan.update.forEach((d) => work.push(() => api.put(cal, d)));
      plan.remove.forEach((id) => {
        reisDeleted[id] = dateById.get(id) ?? today;
        work.push(() => api.remove(cal, id));
      });
    }
    // Saved before deleting: a delete whose record died with a killed or failed
    // run would read as the student's next time, and IS could never restore it.
    // A record for a delete that then failed is harmless (restore = PUT).
    if (Object.keys(reisDeleted).length > Object.keys(o.state.reisDeleted).length) {
      await o.persist({ ...o.state, calendarId: cal, pastFillPending: includePast, reisDeleted });
    }

    await runPool(work, WRITE_CONCURRENCY, (n) => o.onProgress?.(n, work.length));
    return {
      kind: 'ok',
      written: work.length,
      state: {
        calendarId: cal,
        held,
        lastSyncAt: now.getTime(),
        // A timetable that hadn't loaded yet wrote no past lessons; keep trying.
        pastFillPending: includePast && !sources.lessonsConfirmed,
        reisDeleted: futureOnly(reisDeleted, (date) => date, today),
        skipped: futureOnly(skipped, (s) => s.date, today),
      },
    };
  } catch (e) {
    if (e instanceof CalendarGoneError) return { kind: 'calendarGone' };
    if (e instanceof AuthRevokedError) return { kind: 'revoked' };
    throw e;
  }
}
