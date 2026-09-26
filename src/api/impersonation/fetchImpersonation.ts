import { fetchWithAuth } from '../client';
import { mergeDualLanguageLessons } from '../schedule';
import type { BlockLesson } from '../../types/schedule';
import type { SubjectInfo } from '../../types/documents';
import {
  ImpersonationError,
  type FacultyOptions,
  type ImpersonationResult,
  type ImpersonationSelection,
  type ProgrammeOption,
} from './types';
import { parseDoc } from './text';
import { intakeLabel, targetSemester } from './intake';
import {
  parseRanges,
  pickCurrentRange,
  parseRozvrhRows,
  parseCriteria,
  parseGroupNumbers,
} from './timetableForm';
import {
  TIMETABLE_URL,
  criteriaBody,
  timetableBody,
  readTimetableAnswer,
  type TimetableFilter,
} from './timetableQuery';
import {
  CATALOG_URL,
  FACULTY_IDS,
  typStudiaFor,
  findPeriodPoc,
  programmeUrl,
  findLeafUrl,
} from './catalogNav';
import { parseCatalogPlan, subjectsToAttend, toStudyPlan, type CatalogRow } from './catalogPlan';
import { firstSlotOnly } from './pickSlots';

/**
 * Everything here goes through `fetchWithAuth`, which already reaches IS from
 * every host: the extension iframe via the content script's REIS_FETCH proxy,
 * Capacitor natively, the content script directly.
 */
const text = async (url: string, init?: RequestInit) => (await fetchWithAuth(url, init)).text();
const post = (body: string) => text(TIMETABLE_URL, { method: 'POST', body });

/** Timetable POSTs are expensive for IS (reis-scraper keeps its crawl at 3). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    })
  );
  return out;
}

/** Programmes of the current prezenční rozvrhy, one criteria form per rozvrh. */
export async function loadOptions(now = new Date()): Promise<FacultyOptions[]> {
  const index = parseDoc(await text(`${TIMETABLE_URL}?konf=1;lang=cz`));
  const range = pickCurrentRange(parseRanges(index), now);
  if (!range) throw new ImpersonationError('options');
  const rangePage = await text(`${TIMETABLE_URL}?konf=1;z=${range.z};k=${range.k};lang=cz`);
  const rozvrhy = parseRozvrhRows(parseDoc(rangePage), range).filter(
    (r) => r.form === 'prezenční' && r.faculty in FACULTY_IDS
  );
  const byFaculty = new Map<string, ProgrammeOption[]>();
  for (const r of rozvrhy) {
    const form = parseCriteria(parseDoc(await post(criteriaBody(r))));
    const list = byFaculty.get(r.faculty) ?? [];
    for (const p of form.programmes) {
      if (!typStudiaFor(p.shortCode) || list.some((x) => x.programId === p.programId)) continue;
      list.push({ ...p, faculty: r.faculty, rozvrh: r, years: form.years });
    }
    byFaculty.set(r.faculty, list);
  }
  return [...byFaculty].map(([faculty, programmes]) => ({ faculty, programmes }));
}

/** Year-1 study groups: only the list format names them (the JSON has no group field). */
export async function loadYear1Groups(p: ProgrammeOption): Promise<number[]> {
  const html = await post(
    timetableBody(p.rozvrh, { program: p.programId, rocnik: 1 }, 'cz', 'list')
  );
  return parseGroupNumbers(parseDoc(html), 1);
}

/** Both languages or failure — a half-fetched timetable is never applied. */
async function lessonsFor(
  sel: ImpersonationSelection,
  f: TimetableFilter,
  pickFirst: boolean
): Promise<BlockLesson[]> {
  const [cz, en] = await Promise.all(
    (['cz', 'en'] as const).map(async (lang) =>
      readTimetableAnswer(await post(timetableBody(sel.rozvrh, f, lang, 'json')))
    )
  );
  if (!cz || !en || cz.kind === 'failed' || en.kind === 'failed')
    throw new ImpersonationError('timetable');
  const czL = cz.kind === 'lessons' ? cz.lessons : [];
  const enL = en.kind === 'lessons' ? en.lessons : [];
  return mergeDualLanguageLessons(pickFirst ? firstSlotOnly(czL) : czL, enL);
}

/**
 * One subject, one parallel. `rocnik` narrows it to the slots open to this
 * year where IS tags events with years (PEF: EBC-FT 60 → 36), but at AF, FRRMS,
 * ZF and in most masters nothing is tagged, and rocnik=N answers empty while the
 * unfiltered subject has 24–48 lessons (live check, 2026-09-26). Empty with the
 * filter → ask again without it.
 */
async function subjectLessons(
  sel: ImpersonationSelection,
  predmet: string
): Promise<BlockLesson[]> {
  const narrowed = await lessonsFor(sel, { predmet, rocnik: sel.year }, true);
  return narrowed.length ? narrowed : lessonsFor(sel, { predmet }, true);
}

async function fetchPlanLeaf(sel: ImpersonationSelection, now: Date): Promise<string> {
  const fakulta = FACULTY_IDS[sel.faculty];
  const typ = typStudiaFor(sel.shortCode);
  if (!fakulta || !typ) throw new ImpersonationError('noPlan');
  const periods = parseDoc(await text(`${CATALOG_URL}?fakulta=${fakulta};lang=cz`));
  const poc = findPeriodPoc(periods, intakeLabel(sel.year, now));
  if (!poc) throw new ImpersonationError('noPlan');
  const leaf = findLeafUrl(parseDoc(await text(programmeUrl(fakulta, poc, typ, sel.programId))));
  if (!leaf) throw new ImpersonationError('noPlan');
  return leaf;
}

export async function fetchImpersonation(
  sel: ImpersonationSelection,
  now = new Date()
): Promise<ImpersonationResult> {
  const leaf = await fetchPlanLeaf(sel, now);
  const [czSems, enSems] = await Promise.all(
    [leaf, leaf.replace('lang=cz', 'lang=en')].map(async (u) =>
      parseCatalogPlan(parseDoc(await text(u)))
    )
  );
  const target = targetSemester(sel.year, now);
  const semester = czSems?.find((s) => s.number === target);
  if (!czSems || !enSems || !semester) throw new ImpersonationError('noSemester');
  const attend = subjectsToAttend(semester);

  // Year 1: the programme + group query, which knows the student's group. It
  // misses subjects that hang off no programme (AF OTAJAE; every subject of some
  // N- programmes), and from year 2 on IS answers it with no results at all —
  // so every plan subject it did not cover is asked for on its own.
  let schedule: BlockLesson[] = [];
  if (sel.year === 1) {
    const f = { program: sel.programId, rocnik: 1, skupina: sel.group ?? 0 };
    schedule = await lessonsFor(sel, f, false);
  }
  const covered = new Set(schedule.map((l) => l.courseCode));
  const missing = attend.filter(
    (r): r is CatalogRow & { predmetId: string } => r.predmetId !== null && !covered.has(r.code)
  );
  const per = await mapLimit(missing, 3, (r) => subjectLessons(sel, r.predmetId));
  schedule = schedule.concat(per.flat());

  const title = `${sel.shortCode} ${sel.name} · ${intakeLabel(sel.year, now)}`;
  const enrolled = { semester: target, codes: new Set(attend.map((r) => r.code)) };
  const enNames = new Map(
    enSems.flatMap((s) => s.groups.flatMap((g) => g.rows.map((r) => [r.code, r.name] as const)))
  );
  const fetchedAt = new Date().toISOString();
  const data: Record<string, SubjectInfo> = {};
  for (const r of attend) {
    data[r.code] = {
      displayName: r.name,
      fullName: `${r.code} ${r.name}`,
      nameCs: r.name,
      nameEn: enNames.get(r.code) ?? r.name,
      subjectCode: r.code,
      ...(r.predmetId ? { subjectId: r.predmetId } : {}),
      folderUrl: '',
      fetchedAt,
    };
  }
  return {
    plan: { cz: toStudyPlan(czSems, title, enrolled), en: toStudyPlan(enSems, title, enrolled) },
    schedule,
    subjects: { version: 1, lastUpdated: fetchedAt, data },
    fetchedAt: Date.now(),
  };
}
