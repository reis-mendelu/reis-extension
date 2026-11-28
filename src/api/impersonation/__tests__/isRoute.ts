import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadOptions } from '../options';
import type { ImpersonationSelection } from '../types';

/**
 * The IS answers the impersonation fetch tests replay: real pages saved on
 * 2026-09-26, plus the shapes the live persona check found on 2026-11-27,
 * switched on per test through `shapes`. Shared by fetchImpersonation.test.ts
 * and fetchImpersonationYear1.test.ts, each of which mocks `../../client`.
 */
const FX = 'src/api/impersonation/__tests__/fixtures/';
export const raw = (n: string) => readFileSync(resolve(process.cwd(), FX + n), 'utf8');
const noResults = readFileSync(
  resolve(process.cwd(), 'src/api/__tests__/fixtures/is-rozvrh-no-results.html'),
  'utf8'
);

export const shapes = {
  /** AF (live 2026-11-27): the programme + group query returns a subject's seminars, not its lectures. */
  mtLecturesUntagged: false,
  /** ZF B-RASZ (live 2026-11-27): the group is taught BOTAZ, which the plan omits. */
  botazTaught: false,
  /** ZABAH (ZF, live 2026-11-27): two seminar parallels on each of two dates, no group. */
  parallelsUntagged: false,
};
export const resetShapes = () => {
  shapes.mtLecturesUntagged = false;
  shapes.botazTaught = false;
  shapes.parallelsUntagged = false;
};

const withParallels = (json: string) => {
  const d = JSON.parse(json) as { blockLessons: Record<string, unknown>[] };
  const base = { ...d.blockLessons[0]!, courseCode: 'ZABAH', isSeminar: 'true' };
  const extra = ['20260929', '20261013'].flatMap((date) =>
    ['09:00', '11:00'].map((startTime) => ({
      ...base,
      date,
      startTime,
      id: `z-${date}-${startTime}`,
    }))
  );
  return JSON.stringify({ ...d, blockLessons: [...d.blockLessons, ...extra] });
};
const withBotaz = (json: string) => {
  const d = JSON.parse(json) as { blockLessons: Record<string, unknown>[] };
  const l = {
    ...d.blockLessons[0]!,
    courseCode: 'BOTAZ',
    courseName: 'Botanika',
    courseId: '170001',
    id: 'x1',
  };
  return JSON.stringify({ ...d, blockLessons: [...d.blockLessons, l] });
};
type Answer = { blockLessons: { courseCode: string; isSeminar: string }[] };
const edit = (json: string, keep: (l: Answer['blockLessons'][number]) => boolean) => {
  const d = JSON.parse(json) as Answer;
  return JSON.stringify({ ...d, blockLessons: d.blockLessons.filter(keep) });
};
const withoutMtLectures = (json: string) =>
  edit(json, (l) => !(l.courseCode === 'EBC-MT' && l.isSeminar === 'false'));
const onlyMt = (json: string) => edit(json, (l) => l.courseCode === 'EBC-MT');

/**
 * The Erasmus persona's five English-taught courses (ids from PEF's course
 * select, live 2026-11-28; their options in rozvrh-criteria.html are copied
 * verbatim from that page, so `parseCourses` reads real IS markup). Each answers like EBC-FT, renamed: a lecture slot
 * and two seminar parallels. Asked WITH a year, IS would answer lectures only,
 * so a fetch that sent `rocnik` would come back without seminars.
 */
export const EXCHANGE_COURSES: Record<string, string> = {
  '164024': 'EBA-MAR',
  '164120': 'EBA-MI',
  '164118': 'EBA-MT',
  '164119': 'EBA-PE',
  '164023': 'EBA-FT',
};
const asCourse = (json: string, predmet: string) =>
  json.replaceAll('EBC-FT', EXCHANGE_COURSES[predmet]!).replaceAll('164066', predmet);

/** Answers each request with the real IS page that request got on 2026-09-26. */
export function route(url: string, init?: RequestInit): string {
  const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
  if (url.includes('rozvrhy_view.pl?konf=1;lang=cz')) return raw('rozvrh-index.html');
  if (url.includes('rozvrhy_view.pl?konf=1;z=')) return raw('rozvrh-range.html');
  if (url.includes('rozvrhy_view.pl') && !body.has('format')) return raw('rozvrh-criteria.html');
  if (body.get('format') === 'list') return raw('rozvrh-list-bf-y1.html');
  const exchange = body.get('predmet') ?? '';
  if (body.get('format') === 'json' && exchange in EXCHANGE_COURSES) {
    const ft = asCourse(raw(`rozvrh-predmet-ft.${body.get('lang')}.json`), exchange);
    return body.get('rocnik') === '0' ? ft : edit(ft, (l) => l.isSeminar === 'false');
  }
  if (
    body.get('format') === 'json' &&
    body.get('predmet') === '164066' &&
    body.get('rocnik') === '2'
  )
    return raw(`rozvrh-predmet-ft.${body.get('lang')}.json`);
  // EBC-AZD (162664) behaves like AF/FRRMS/ZF subjects live: nothing under
  // rocnik=2, a full timetable without the year filter (observed 2026-09-26).
  if (
    body.get('format') === 'json' &&
    body.get('predmet') === '162664' &&
    body.get('rocnik') === '0'
  )
    return raw(`rozvrh-predmet-ft.${body.get('lang')}.json`).replaceAll('EBC-FT', 'EBC-AZD');
  // "All groups" (skupina 0) answers the same page, parallels included. The
  // programme query only: a per-subject ask sends program 0 and a predmet.
  if (
    shapes.parallelsUntagged &&
    body.get('format') === 'json' &&
    body.get('skupina') === '0' &&
    body.get('program') !== '0' &&
    body.get('predmet') === '0'
  )
    return withParallels(raw(`rozvrh-bf-y1-g2.${body.get('lang')}.json`));
  if (body.get('format') === 'json' && body.get('skupina') === '2')
    return (
      shapes.parallelsUntagged ? withParallels : shapes.botazTaught ? withBotaz : (j: string) => j
    )(
      shapes.mtLecturesUntagged
        ? withoutMtLectures(raw(`rozvrh-bf-y1-g2.${body.get('lang')}.json`))
        : raw(`rozvrh-bf-y1-g2.${body.get('lang')}.json`)
    );
  // EBC-MT asked on its own (catalogue id 157993 in the 801 plan). As at AF:
  // with the year filter, its seminars only; without it, its lectures too.
  if (body.get('format') === 'json' && body.get('predmet') === '157993') {
    const mt = onlyMt(raw(`rozvrh-bf-y1-g2.${body.get('lang')}.json`));
    return body.get('rocnik') === '1' ? edit(mt, (l) => l.isSeminar === 'true') : mt;
  }
  if (body.get('format') === 'json') return noResults;
  if (url.includes('plany.pl?fakulta=2;lang=cz')) return raw('catalog-periods-pef.html');
  // An outgoing programme version: IS's own "no forms of study" page.
  if (url.includes('program=9999') && !url.includes('stud_plan'))
    return raw('catalog-programme-no-forms.html');
  if (url.includes('program=1889') && !url.includes('stud_plan'))
    return raw('catalog-programme-bf-801.auth.html');
  if (url.includes('stud_plan=12490') && url.includes('lang=en'))
    return raw('catalog-plan-bf-801.en.html');
  if (url.includes('stud_plan=12490')) return raw('catalog-plan-bf-801.cz.html');
  throw new Error(`unrouted ${url}`);
}

export const SEPT = new Date(2026, 8, 26);

export async function bfSelection(year: number): Promise<ImpersonationSelection> {
  const bf = (await loadOptions(SEPT))
    .find((f) => f.faculty === 'PEF')!
    .programmes.find((p) => p.shortCode === 'B-F')!;
  return {
    variants: bf.variants,
    programId: bf.programId,
    shortCode: bf.shortCode,
    name: bf.name,
    faculty: 'PEF',
    year,
    group: year === 1 ? 2 : null,
    rozvrh: bf.rozvrh,
    periodLabel: 'ZS 2026/2027',
  };
}

/** The Erasmus persona's request, the way `personaRequest` builds it from `loadOptions`. */
export async function erasmusSelection(): Promise<ImpersonationSelection> {
  const pef = (await loadOptions(SEPT)).find((f) => f.faculty === 'PEF')!;
  const courses = (pef.courses ?? [])
    .filter((c) => Object.values(EXCHANGE_COURSES).includes(c.code))
    .map(({ code, predmetId }) => ({ code, predmetId }));
  return {
    programId: '',
    shortCode: 'Z-EXC',
    name: '',
    faculty: 'PEF',
    year: 1,
    group: null,
    rozvrh: pef.courses![0]!.rozvrh,
    periodLabel: 'ZS 2026/2027',
    erasmus: true,
    courses,
    personaId: 'erasmus',
  };
}
