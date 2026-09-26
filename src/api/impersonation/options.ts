import { ImpersonationError, type FacultyOptions, type ProgrammeOption } from './types';
import { parseDoc } from './text';
import {
  parseRanges,
  pickCurrentRange,
  parseRozvrhRows,
  parseCriteria,
  parseGroupNumbers,
} from './timetableForm';
import { TIMETABLE_URL, criteriaBody, timetableBody } from './timetableQuery';
import { FACULTY_IDS, typStudiaFor } from './catalogNav';
import { text, post } from './transport';

/**
 * One entry per programme, not per IS id. A re-accredited programme has two ids
 * while the old one is taught out — the timetable lists both (ZF B-RSZ and
 * B-RASZ, PEF B-EAM and B-EM, …), and each has plans only for its own intakes.
 * Same faculty, same name, same study type → one entry whose variants the fetch
 * tries in turn. Bachelor and master stay apart (B-F and N-F are both "Finance").
 */
function mergeVersions(list: ProgrammeOption[]): ProgrammeOption[] {
  const byKey = new Map<string, ProgrammeOption>();
  for (const p of list) {
    const key = `${typStudiaFor(p.shortCode)}|${p.name}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...p, variants: [...p.variants] });
      continue;
    }
    seen.variants.push(...p.variants);
    seen.years = [...new Set([...seen.years, ...p.years])].sort((a, b) => a - b);
  }
  return [...byKey.values()];
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
      const variant = { programId: p.programId, shortCode: p.shortCode, rozvrh: r };
      list.push({
        ...variant,
        name: p.name,
        faculty: r.faculty,
        years: form.years,
        variants: [variant],
      });
    }
    byFaculty.set(r.faculty, list);
  }
  return [...byFaculty].map(([faculty, list]) => ({ faculty, programmes: mergeVersions(list) }));
}

/**
 * Year-1 study groups: only the list format names them (the JSON has no group
 * field). Across every version — only the one with a current first year has any.
 */
export async function loadYear1Groups(p: ProgrammeOption): Promise<number[]> {
  const groups = new Set<number>();
  for (const v of p.variants) {
    const body = timetableBody(v.rozvrh, { program: v.programId, rocnik: 1 }, 'cz', 'list');
    for (const g of parseGroupNumbers(parseDoc(await post(body)), 1)) groups.add(g);
  }
  return [...groups].sort((a, b) => a - b);
}
