import type { SemesterBlock } from '@/types/studyPlan';

export type SemesterState = 'past' | 'current' | 'future';

// IS Mendelu sentinel: 999 credits = "uznaný předmět", don't sum.
export const isRealCredits = (c: number) => c < 999;

export function getSemesterState(block: SemesterBlock): SemesterState {
  const all = block.groups.flatMap(g => g.subjects);
  if (all.length === 0) return 'future';
  const hasEnrolled = all.some(s => s.isEnrolled);
  if (hasEnrolled) return 'current';
  const isNotActivated = /neaktiv/i.test(block.title) || /not\s+(?:yet\s+|been\s+)?activated/i.test(block.title);
  if (isNotActivated) return 'future';
  const allFulfilled = all.every(s => s.isFulfilled);
  if (allFulfilled) return 'past';
  const hasFulfilled = all.some(s => s.isFulfilled);
  if (!hasFulfilled) return 'future';
  // Some fulfilled, some not — past only if unfulfilled subjects were attempted (enrollmentCount > 0).
  // Without that signal the semester is ambiguous (e.g. stale IDB before enrollment) → treat as current.
  const unfulfilledAttempted = all.some(s => !s.isFulfilled && s.enrollmentCount > 0);
  return unfulfilledAttempted ? 'past' : 'current';
}

export function normalizeZameraniName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^zaměření:\s*/i, '')
    .replace(/^specialization:\s*/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function buildSubjectSemesters(plan: { blocks: SemesterBlock[] } | null | undefined): Map<string, string[]> {
  if (!plan) return new Map();
  const map = new Map<string, Set<number>>();
  for (const block of plan.blocks) {
    const numMatch = block.title.match(/^(\d+)/);
    if (!numMatch) continue;
    const num = Number(numMatch[1]);
    for (const g of block.groups) for (const s of g.subjects) {
      const existing = map.get(s.code) ?? new Set<number>();
      existing.add(num);
      map.set(s.code, existing);
    }
  }
  return new Map(
    [...map.entries()].map(([code, sems]) => [code, [...sems].sort((a, b) => a - b).map(String)]),
  );
}
