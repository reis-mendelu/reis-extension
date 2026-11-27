import { mergeDualLanguageLessons } from '../schedule';
import type { BlockLesson } from '../../types/schedule';
import type { SubjectInfo } from '../../types/documents';
import {
  ImpersonationError,
  type ImpersonationResult,
  type ImpersonationSelection,
  type ProgrammeVariant,
} from './types';
import { parseDoc } from './text';
import { intakeLabel, targetSemester } from './intake';
import { timetableBody, readTimetableAnswer, type TimetableFilter } from './timetableQuery';
import {
  CATALOG_URL,
  FACULTY_IDS,
  typStudiaFor,
  findPeriodPoc,
  programmeUrl,
  findLeafUrl,
} from './catalogNav';
import { parseCatalogPlan, subjectsToAttend, toStudyPlan } from './catalogPlan';
import { firstSlotOnly, oneSeminarParallel } from './pickSlots';
import { text, post, mapLimit } from './transport';
import { taughtSubjects } from './taughtSubjects';

/** Both languages or failure — a half-fetched timetable is never applied. */
async function lessonsFor(
  sel: ImpersonationSelection,
  f: TimetableFilter,
  pick: (lessons: BlockLesson[]) => BlockLesson[]
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
  return mergeDualLanguageLessons(pick(czL), enL);
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
  const narrowed = await lessonsFor(sel, { predmet, rocnik: sel.year }, firstSlotOnly);
  return narrowed.length ? narrowed : lessonsFor(sel, { predmet }, firstSlotOnly);
}

/**
 * Only the lectures of a subject, for one whose seminars came with the group.
 * At AF the year-tagged answer holds the seminars and no lecture (live
 * 2026-11-27), so "not empty" is not enough to skip the year-less ask.
 */
async function subjectLectures(
  sel: ImpersonationSelection,
  predmet: string
): Promise<BlockLesson[]> {
  const lectures = (ls: BlockLesson[]) => ls.filter((l) => l.isSeminar !== 'true');
  const narrowed = lectures(await lessonsFor(sel, { predmet, rocnik: sel.year }, firstSlotOnly));
  return narrowed.length ? narrowed : lectures(await lessonsFor(sel, { predmet }, firstSlotOnly));
}

/**
 * The plan leaf of the first programme version that has one for this intake.
 * An outgoing version answers "Nejsou definovány žádné formy studia" for the
 * new intake, a new one for the old intakes (real IS, 2026-09-26).
 */
async function fetchPlanLeaf(
  sel: ImpersonationSelection,
  now: Date
): Promise<{ leaf: string; variant: ProgrammeVariant }> {
  const fakulta = FACULTY_IDS[sel.faculty];
  if (!fakulta) throw new ImpersonationError('noPlan');
  const periods = parseDoc(await text(`${CATALOG_URL}?fakulta=${fakulta};lang=cz`));
  const poc = findPeriodPoc(periods, intakeLabel(sel.year, now));
  if (!poc) throw new ImpersonationError('noPlan');
  const variants = sel.variants?.length
    ? sel.variants
    : [{ programId: sel.programId, shortCode: sel.shortCode, rozvrh: sel.rozvrh }];
  for (const variant of variants) {
    const typ = typStudiaFor(variant.shortCode);
    if (!typ) continue;
    const page = await text(programmeUrl(fakulta, poc, typ, variant.programId));
    const leaf = findLeafUrl(parseDoc(page));
    if (leaf) return { leaf, variant };
  }
  throw new ImpersonationError('noPlan');
}

export async function fetchImpersonation(
  requested: ImpersonationSelection,
  now = new Date()
): Promise<ImpersonationResult> {
  const { leaf, variant } = await fetchPlanLeaf(requested, now);
  // From here on, the version that has the plan: its id drives the timetable.
  const sel = { ...requested, ...variant };
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
    schedule = await lessonsFor(sel, f, oneSeminarParallel);
  }
  // A subject the group answer has seminars of but no lecture (AF: AGRMT, BZRV,
  // DMEP, BZZV, live 2026-11-27) has its lectures tagged to no programme: they
  // are asked for on their own too, and only the lectures are taken.
  const covered = new Set(schedule.map((l) => l.courseCode));
  const lectured = new Set(schedule.filter((l) => l.isSeminar !== 'true').map((l) => l.courseCode));
  const ask = attend.flatMap((r) =>
    r.predmetId === null || lectured.has(r.code)
      ? []
      : [{ predmetId: r.predmetId, lecturesOnly: covered.has(r.code) }]
  );
  const per = await mapLimit(ask, 3, ({ predmetId, lecturesOnly }) =>
    lecturesOnly ? subjectLectures(sel, predmetId) : subjectLessons(sel, predmetId)
  );
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
  const planned = new Set(semester.groups.flatMap((g) => g.rows.map((r) => r.code)));
  Object.assign(data, taughtSubjects(schedule, planned, fetchedAt));
  return {
    resolved: variant,
    plan: { cz: toStudyPlan(czSems, title, enrolled), en: toStudyPlan(enSems, title, enrolled) },
    schedule,
    subjects: { version: 1, lastUpdated: fetchedAt, data },
    fetchedAt: Date.now(),
  };
}
