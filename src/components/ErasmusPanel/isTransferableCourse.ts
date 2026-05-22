import type { SubjectStatus } from '@/types/studyPlan';

/**
 * Universal rule to filter out "rubbish" from Erasmus selection:
 * 1. 0 credit subjects are milestones, state exams, or markers (not transferable).
 * 2. Explicit "zaměření" (specialization) markers.
 */
export const isTransferableCourse = (s: SubjectStatus) => {
  if (!s) return false;
  if (s.credits === 0) return false;
  const name = (s.name || '').toLowerCase();
  if (name.startsWith('zaměření:') || name.startsWith('specialization:')) return false;
  return true;
};
