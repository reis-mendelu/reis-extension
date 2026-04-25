import type { SemesterBlock } from '@/types/studyPlan';

export type SemesterState = 'past' | 'current' | 'future';

// IS Mendelu sentinel: 999 credits = "uznaný předmět", don't sum.
export const isRealCredits = (c: number) => c < 999;

export function getSemesterState(block: SemesterBlock): SemesterState {
  const all = block.groups.flatMap(g => g.subjects);
  if (all.length === 0) return 'future';
  const hasEnrolled = all.some(s => s.isEnrolled);
  if (hasEnrolled) return 'current';
  const allFulfilled = all.every(s => s.isFulfilled);
  if (allFulfilled) return 'past';
  const hasFulfilled = all.some(s => s.isFulfilled);
  return hasFulfilled ? 'past' : 'future';
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
