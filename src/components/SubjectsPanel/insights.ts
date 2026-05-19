import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';
import type { SubjectSuccessRate } from '@/types/documents';
import { isRealCredits } from './utils';

const MIN_SAMPLE = 30;
const RECENT_SEMESTERS = 3;

export interface SubjectStat {
  rate: number;       // 0-100 fail %
  n: number;          // total students across recent semesters
  semesters: number;  // how many semesters of data we used
}

/** Recent fail rate + honest sample size. Returns null if no data. */
export function subjectStat(sr: SubjectSuccessRate | undefined): SubjectStat | null {
  if (!sr?.stats?.length) return null;
  const recent = sr.stats.slice(0, RECENT_SEMESTERS);
  let pass = 0, fail = 0;
  for (const sem of recent) {
    const all = sem.terms.find(t => t.term === 'Všechny termíny');
    if (all) { pass += all.pass; fail += all.fail; }
    else { pass += sem.totalPass; fail += sem.totalFail; }
  }
  const n = pass + fail;
  if (n === 0) return null;
  return { rate: Math.round((fail / n) * 100), n, semesters: recent.length };
}

export interface HardestEntry {
  subject: SubjectStatus;
  stat: SubjectStat;
  semesters: string[]; // plan semester numbers
}

/** Top hardest upcoming subjects in the plan. Skips fulfilled, already attempted, and low-sample. */
export function topHardestUpcoming(
  plan: StudyPlan,
  successRates: Record<string, SubjectSuccessRate>,
  subjectSemesters: Map<string, string[]>,
  limit = 5,
): HardestEntry[] {
  const seen = new Set<string>();
  const entries: HardestEntry[] = [];
  for (const block of plan.blocks) for (const group of block.groups) for (const s of group.subjects) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    if (s.isFulfilled || s.enrollmentCount > 0) continue;
    const stat = subjectStat(successRates[s.code]);
    if (!stat || stat.n < MIN_SAMPLE) continue;
    entries.push({ subject: s, stat, semesters: subjectSemesters.get(s.code) ?? [] });
  }
  return entries.sort((a, b) => b.stat.rate - a.stat.rate).slice(0, limit);
}

export interface ZameraniInsight {
  name: string;
  description?: string;
  subjects: { code: string; id: string; name: string; credits: number; stat: SubjectStat | null }[];
  weightedFailRate: number | null; // credit-weighted avg fail %, null if no data
  worstSubject: { code: string; rate: number } | null;
  lowSampleCount: number;           // # subjects with stat.n < MIN_SAMPLE OR no data
  totalCredits: number;
}

/** Credit-weighted difficulty per zaměření, plus its weakest signal. */
export function zameraniInsights(
  plan: StudyPlan,
  successRates: Record<string, SubjectSuccessRate>,
): ZameraniInsight[] {
  if (!plan.zameranis?.length) return [];
  const creditByCode = new Map<string, number>();
  const nameByCode = new Map<string, string>();
  const idByCode = new Map<string, string>();
  for (const block of plan.blocks) for (const group of block.groups) for (const s of group.subjects) {
    creditByCode.set(s.code, s.credits);
    nameByCode.set(s.code, s.name);
    idByCode.set(s.code, s.id);
  }
  return plan.zameranis.map(z => {
    const subjects = z.subjects.map(r => {
      const credits = creditByCode.get(r.code) ?? 0;
      const stat = subjectStat(successRates[r.code]);
      return { code: r.code, id: idByCode.get(r.code) ?? '', name: nameByCode.get(r.code) ?? r.name, credits, stat };
    });
    let weightedNum = 0, weightedDen = 0, worst: { code: string; rate: number } | null = null, lowSample = 0;
    let totalCredits = 0;
    for (const s of subjects) {
      if (isRealCredits(s.credits)) totalCredits += s.credits;
      if (!s.stat || s.stat.n < MIN_SAMPLE) { lowSample++; continue; }
      const w = isRealCredits(s.credits) ? s.credits : 1;
      weightedNum += s.stat.rate * w;
      weightedDen += w;
      if (!worst || s.stat.rate > worst.rate) worst = { code: s.code, rate: s.stat.rate };
    }
    return {
      name: z.name,
      description: z.description,
      subjects,
      weightedFailRate: weightedDen > 0 ? Math.round(weightedNum / weightedDen) : null,
      worstSubject: worst,
      lowSampleCount: lowSample,
      totalCredits,
    };
  }).sort((a, b) => {
    const ra = a.weightedFailRate ?? 999;
    const rb = b.weightedFailRate ?? 999;
    return ra - rb;
  });
}
