import { BASE_URL } from '../client';
import { NO_RESULTS_MARKERS } from '../schedule';
import type { BlockLesson } from '../../types/schedule';
import type { RozvrhRef } from './types';

export const TIMETABLE_URL = `${BASE_URL}/auth/katalog/rozvrhy_view.pl`;

export interface TimetableFilter {
  program?: string;
  rocnik?: number;
  skupina?: number;
  predmet?: string;
}

/** The criteria form POST; the triple must match how the rozvrh was reached. */
export function criteriaBody(r: RozvrhRef): string {
  return new URLSearchParams({
    lang: 'cz',
    z: r.z,
    k: r.k,
    f: '0',
    studijni_zpet: '0',
    rozvrh: r.id,
  }).toString();
}

/**
 * `format=json` is not offered by the form, but IS honours it (verified
 * 2026-09-26): with `typ_vypisu=konani` it returns the same dated `blockLessons`
 * the student's own timetable does, holidays already removed.
 */
export function timetableBody(
  r: RozvrhRef,
  f: TimetableFilter,
  lang: 'cz' | 'en',
  format: 'json' | 'list'
): string {
  const p = new URLSearchParams({
    lang,
    z: r.z,
    k: r.k,
    f: '0',
    studijni_zpet: '0',
    rozvrh: r.id,
    mistnost: '0',
    garant: '0',
    ucitel: '0',
    predmet: f.predmet ?? '0',
    ustav: '0',
    den: '0',
    stupen: '0',
    program: f.program ?? '0',
    obor: '0',
    rocnik: String(f.rocnik ?? 0),
    skupina: String(f.skupina ?? 0),
    zobraz: 'Zobrazit',
    format,
  });
  if (format === 'json') {
    p.set('typ_vypisu', 'konani');
    p.set('konani_od', r.start);
    p.set('konani_do', r.end);
  }
  return p.toString();
}

export type TimetableAnswer =
  | { kind: 'lessons'; lessons: BlockLesson[] }
  | { kind: 'empty' }
  | { kind: 'failed' };

/**
 * By BODY, not content-type: the extension's proxy labels every response
 * text/html. Same failure/emptiness rule as schedule.ts — the no-results
 * sentence is the only thing that makes non-JSON an honest "nothing".
 *
 * `studyId`/`periodId` are blanked on EVERY lesson: IS stamps the viewer's own
 * studium on lessons the admin is enrolled in themselves (seen 2026-09-26), and
 * it must never ride into an impersonated timetable.
 */
export function readTimetableAnswer(text: string): TimetableAnswer {
  if (text.trimStart().startsWith('{')) {
    try {
      const d = JSON.parse(text) as { blockLessons?: BlockLesson[] };
      const lessons = (d.blockLessons ?? []).map((l) => ({ ...l, studyId: '', periodId: '' }));
      return { kind: 'lessons', lessons };
    } catch {
      return { kind: 'failed' };
    }
  }
  return NO_RESULTS_MARKERS.some((m) => text.includes(m)) ? { kind: 'empty' } : { kind: 'failed' };
}
