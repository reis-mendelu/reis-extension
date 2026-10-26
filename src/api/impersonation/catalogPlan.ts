import type { StudyPlan, SemesterBlock, SubjectGroup } from '../../types/studyPlan';
import { txt } from './text';

export interface CatalogRow {
  code: string;
  name: string;
  completion: string;
  credits: number;
  /** This period's IS subject id — present only for semesters taught now. */
  predmetId: string | null;
}

export interface CatalogGroup {
  name: string;
  minCredits?: number;
  minCount?: number;
  rows: CatalogRow[];
}

export interface CatalogSemester {
  number: number;
  title: string;
  groups: CatalogGroup[];
}

/** "1. semestr ZS 2025/2026 - PEF" / "3rd semester WS 2026/2027 - FBE" */
const SEMESTER_RE = /^(\d+)(?:\.|st|nd|rd|th)\s*(?:semestr|semester)\b/i;
/** Placeholder rows ("Uznaný předmět ze zahraničního výjezdu") carry 999 credits. */
const PLACEHOLDER_CREDITS = 999;
/** A group with no minimum that is still optional ("volitelných" / "elective"). */
const OPTIONAL_RE = /volitel|elective|optional/i;

function parseMinimum(name: string): Pick<CatalogGroup, 'minCredits' | 'minCount'> {
  const credits = /min\.\s*(\d+)\s*(?:kr|crd)/i.exec(name);
  if (credits) return { minCredits: Number(credits[1]) };
  const count = /min\.\s*(\d+)\s*(?:př|cours|subj)/i.exec(name);
  return count ? { minCount: Number(count[1]) } : {};
}

/**
 * The catalogue plan leaf (`/auth/katalog/plany.pl?…;stud_plan=N`).
 * Same structure reis-scraper's `parsePlan` reads, verified on the 801 B-F leaf
 * in both languages (fixtures/catalog-plan-bf-801.*.html): a semester opens with
 * a bold `colspan=4` row, a group with a bold `colspan=3` row, and subject rows
 * carry class `predmety_vse` with code/name/completion/credits cells.
 */
export function parseCatalogPlan(doc: Document): CatalogSemester[] {
  const out: CatalogSemester[] = [];
  let sem: CatalogSemester | null = null;
  let group: CatalogGroup | null = null;
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const cls = tr.getAttribute('class') ?? '';
    if (cls.includes('zahlavi')) continue;
    if (!cls.includes('predmety_vse')) {
      const t = txt(tr);
      const m = SEMESTER_RE.exec(t);
      if (m && tr.querySelector('td[colspan="4"] b')) {
        sem = { number: Number(m[1]), title: t, groups: [] };
        out.push(sem);
        group = null;
      } else if (sem && tr.querySelector('td[colspan="3"] b')) {
        group = { name: t, rows: [], ...parseMinimum(t) };
        sem.groups.push(group);
      }
      continue;
    }
    if (!group) continue;
    const cells = Array.from(tr.querySelectorAll('td')).filter(
      (td) => !(td.getAttribute('class') ?? '').includes('UISTMNumberCellHidden')
    );
    if (cells.length < 4) continue;
    const code = txt(cells[0]);
    if (!code) continue;
    const credits = Number(txt(cells[3]).replace(',', '.'));
    const href = cells[0]!.querySelector('a')?.getAttribute('href') ?? '';
    const predmet = /predmet=(\d+)/.exec(href);
    group.rows.push({
      code,
      name: txt(cells[1]),
      completion: txt(cells[2]),
      credits: Number.isFinite(credits) ? credits : 0,
      predmetId: predmet?.[1] ?? null,
    });
  }
  return out;
}

/** What a real student of this semester attends: all required, electives up to the minimum. */
export function subjectsToAttend(sem: CatalogSemester): CatalogRow[] {
  const out: CatalogRow[] = [];
  for (const g of sem.groups) {
    const rows = g.rows.filter((r) => r.credits < PLACEHOLDER_CREDITS);
    if (g.minCredits !== undefined) {
      let sum = 0;
      for (const r of rows) {
        if (sum >= g.minCredits) break;
        out.push(r);
        sum += r.credits;
      }
    } else if (g.minCount !== undefined) {
      out.push(...rows.slice(0, g.minCount));
    } else if (!OPTIONAL_RE.test(g.name)) {
      out.push(...rows);
    }
  }
  return out;
}

/**
 * ECTS: 30 credits a semester, so 180 for a 6-semester bachelor. The plan's own
 * sum is lower (B-F: 160) — required credits plus elective minimums — because
 * students fill the rest with free electives outside the plan.
 */
const CREDITS_PER_SEMESTER = 30;

export function toStudyPlan(
  semesters: CatalogSemester[],
  title: string,
  enrolled: { semester: number; codes: Set<string> }
): StudyPlan {
  const blocks: SemesterBlock[] = semesters.map((s) => ({
    title: s.title,
    groups: s.groups.map((g): SubjectGroup => ({
      name: g.name,
      statusDescription: '',
      ...(g.minCount !== undefined ? { minCount: g.minCount } : {}),
      ...(g.minCredits !== undefined ? { minCredits: g.minCredits } : {}),
      subjects: g.rows.map((r) => ({
        id: r.predmetId ?? r.code,
        code: r.code,
        name: r.name,
        credits: r.credits,
        type: r.completion,
        isEnrolled: s.number === enrolled.semester && enrolled.codes.has(r.code),
        isFulfilled: false,
        enrollmentCount: 0,
        rawStatusText: '',
      })),
    })),
  }));
  const creditsRequired = CREDITS_PER_SEMESTER * semesters.length;
  return { title, isFulfilled: false, creditsAcquired: 0, creditsRequired, blocks };
}
